from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.middleware.csrf import get_token
from django.utils import timezone
from django.db.models import Sum, Count, Q
from datetime import datetime, timedelta
import json
import random
import string
import io
import os
from django.db import OperationalError
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from django.conf import settings
from .models import Consumer, MeterReading, Bill, Payment, UserProfile, BillingSettings
from .forms import (ConsumerForm, MeterReadingForm, BillForm, PaymentForm, 
                    LoginForm, ConsumerRegistrationForm)   
from django.http import HttpResponse, FileResponse
from django.template.loader import render_to_string
from .pdf_generator import BillPDFGenerator
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Message
from .serializers import MessageSerializer
from rest_framework.authtoken.models import Token


from django.middleware.csrf import get_token
from django.http import JsonResponse

def get_csrf(request):
    get_token(request)
    return JsonResponse({'status': 'ok'})

@api_view(['GET'])
def get_messages(request):
    messages = Message.objects.all()
    serializer = MessageSerializer(messages, many=True)
    return Response(serializer.data)

def api_root(request):
    """Health check endpoint for /api/"""
    return JsonResponse({'status': 'ok', 'message': 'API is running', 'version': '1.0'})

def favicon_view(request):
    """Return an empty response for favicon.ico to prevent 404 errors"""
    return HttpResponse(status=204)

def login_view(request):
    """Handle user login"""
    if request.user.is_authenticated:
        return redirect('dashboard')
    
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        role = request.POST.get('role', 'admin')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            try:
                profile = user.profile
                if role == 'admin' and profile.role != 'admin':
                    messages.error(request, 'Invalid role selected for this user')
                    return render(request, 'login.html')
                login(request, user)
                
                if role == 'admin':
                    return redirect('admin_dashboard')
                elif role == 'meter_reader':
                    return redirect('meter_reader_dashboard')
                else:
                    return redirect('consumer_dashboard')
            except UserProfile.DoesNotExist:
                # Create profile if doesn't exist
                UserProfile.objects.create(user=user, role=role)
                login(request, user)
                return redirect('dashboard')
        else:
            messages.error(request, 'Invalid username or password')
    
    return render(request, 'login.html')


def logout_view(request):
    """Handle user logout"""
    logout(request)
    return redirect('login')

@csrf_exempt
def api_login(request):
    """JSON login endpoint for SPA clients"""
    print(f"DEBUG: api_login hit with method {request.method}")
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'Invalid JSON body'}, status=400)

    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'admin')
    print(f"DEBUG: Attempting login for {username} with requested role: {role}")

    if not username or not password:
        return JsonResponse({'detail': 'Username and password are required'}, status=400)

    user = authenticate(request, username=username, password=password)

    if user is None:
        print(f"DEBUG: Authentication failed for {username}")
        return JsonResponse({'detail': 'Invalid credentials'}, status=401)

    # Verify/assign role
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={'role': role})
    print(f"DEBUG: User {username} found with profile role: {profile.role}")
    if profile.role != role:
        print(f"DEBUG: Role mismatch! App sent '{role}', DB has '{profile.role}'")
        return JsonResponse({'detail': 'Role mismatch for this user'}, status=403)

    login(request, user)
    request.session.save()            # 👈 force session write
    csrf_token = get_token(request)
    token, created = Token.objects.get_or_create(user=user)
    print(f"DEBUG: Login successful for {user.username}. Token: {token.key}")
    return JsonResponse({
        'success': True,
        'username': user.username,
        'role': profile.role,
        'token': token.key,
        'csrftoken': csrf_token,
    })

# @login_required
# def api_me(request):
#     """Return current user and role for SPA auth guard"""
#     profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'role': 'consumer'})
#     return JsonResponse({
#         'authenticated': True,
#         'username': request.user.username,
#         'role': profile.role,
#     })
@csrf_exempt
def api_me(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=200)
    profile, _ = UserProfile.objects.get_or_create(
        user=request.user, defaults={'role': 'consumer'}
    )
    return JsonResponse({
        'authenticated': True,
        'username': request.user.username,
        'role': profile.role,
    })

# 1.
@csrf_exempt
@api_view(['GET'])
def api_dashboard_stats(request):
    """JSON stats for SPA dashboard"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    from django.utils import timezone
    now = timezone.now()
    
    total_consumers = Consumer.objects.count()
    total_bills = Bill.objects.count()
    total_readings = MeterReading.objects.count()
    
    total_revenue = Bill.objects.filter(status='paid').aggregate(total=Sum('total_amount'))['total'] or 0
    pending_amount = Bill.objects.filter(status='unpaid').aggregate(total=Sum('total_amount'))['total'] or 0
    
    current_month_units = Bill.objects.filter(
        billing_period__month=now.month, 
        billing_period__year=now.year
    ).aggregate(total=Sum('units'))['total'] or 0

    return JsonResponse({
        'total_consumers': total_consumers,
        'total_bills': total_bills,
        'total_readings': total_readings,
        'total_revenue': round(float(total_revenue), 2),
        'pending_amount': round(float(pending_amount), 2),
        'current_month_units': round(float(current_month_units), 1),
    })


@csrf_exempt
def api_reports_data(request):
    """API endpoint for reports charts data"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    try:
        # Top 10 Consumers by Usage (Units)
        top_consumers = Bill.objects.values('consumer__name').annotate(
            total_units=Sum('units')
        ).order_by('-total_units')[:10]
        
        top_consumers_data = [
            {'name': item['consumer__name'] or "Unknown", 'units': round(float(item['total_units'] or 0), 1)}
            for item in top_consumers
        ]
        
        # Monthly Usage (last 6 months)
        monthly_usage = Bill.objects.values('billing_period').annotate(
            total_units=Sum('units')
        ).order_by('-billing_period')[:6]
        
        monthly_usage_data = [
            {'month': item['billing_period'].strftime('%b') if item['billing_period'] else "N/A", 'units': round(float(item['total_units'] or 0), 1)}
            for item in monthly_usage
        ]
        monthly_usage_data.reverse()
        
        # Revenue Breakdown (Salary vs Non-Salary)
        revenue_breakdown = Bill.objects.filter(status='paid').values('consumer__connection_type').annotate(
            total_revenue=Sum('total_amount')
        )
        
        revenue_data = []
        for item in revenue_breakdown:
            label = 'Salary' if item['consumer__connection_type'] == 'salary' else 'Non Salary'
            revenue_data.append({'name': label, 'value': round(float(item['total_revenue'] or 0), 2)})
            
        return JsonResponse({
            'top_consumers': top_consumers_data,
            'monthly_usage': monthly_usage_data,
            'revenue_breakdown': revenue_data,
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
def dashboard(request):
    """Main dashboard view - redirects based on role"""
    try:
        profile = request.user.profile
        if profile.role == 'admin':
            return redirect('admin_dashboard')
        elif profile.role == 'meter_reader':
            return redirect('meter_reader_dashboard')
        else:
            return redirect('consumer_dashboard')
    except UserProfile.DoesNotExist:
        return redirect('consumer_dashboard')


@login_required
def admin_dashboard(request):
    """Admin dashboard with stats and management"""
    # Get statistics
    total_consumers = Consumer.objects.count()
    active_consumers = Consumer.objects.filter(status='active').count()
    total_bills = Bill.objects.count()
    paid_bills = Bill.objects.filter(status='paid').count()
    unpaid_bills = Bill.objects.filter(status='unpaid').count()
    overdue_bills = Bill.objects.filter(status='overdue').count()
    
    # Revenue calculation
    total_revenue = Bill.objects.filter(status='paid').aggregate(
        total=Sum('total_amount')
    )['total'] or 0
    
    # Recent readings
    recent_readings = MeterReading.objects.select_related('consumer').order_by('-created_at')[:5]
    
    # Recent consumers
    recent_consumers = Consumer.objects.order_by('-created_at')[:5]  # ← UNCOMMENTED
    
    # All active consumers for the Generate Bill dropdown
    consumers = Consumer.objects.filter(status='active')             # ← ADDED
    
    context = {
        'total_consumers': total_consumers,
        'active_consumers': active_consumers,
        'total_bills': total_bills,
        'paid_bills': paid_bills,
        'unpaid_bills': unpaid_bills,
        'overdue_bills': overdue_bills,
        'total_revenue': total_revenue,
        'recent_readings': recent_readings,
        'recent_consumers': recent_consumers,
        'consumers': consumers,                                       # ← ADDED
    }
    
    return render(request, 'admin-dashboard.html', context)


@login_required
def manage_consumers(request):
    """Manage all consumers"""
    search_query = request.GET.get('search', '')
    status_filter = request.GET.get('status', '')
    
    consumers = Consumer.objects.all().order_by('-created_at')
    
    if search_query:
        consumers = consumers.filter(
            Q(name__icontains=search_query) |
            Q(consumer_number__icontains=search_query) |
            Q(meter_number__icontains=search_query) |
            Q(email__icontains=search_query)
        )
    
    if status_filter:
        consumers = consumers.filter(status=status_filter)
    
    context = {
        'consumers': consumers,
        'search_query': search_query,
        'status_filter': status_filter,
    }
    
    # If HTMX requests the partial table, render only the list
    if request.headers.get('HX-Request') or request.headers.get('Hx-Request') or request.META.get('HTTP_HX_REQUEST'):
        return render(request, 'partials/consumers_list.html', {'consumers': consumers})

    return render(request, 'manage-consumers.html', context)

@login_required
def add_consumer(request):
    """Add new consumer"""
    if request.method == 'POST':
        form = ConsumerForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Consumer added successfully!')
            return redirect('manage_consumers')
    else:
        form = ConsumerForm()
    
    return render(request, 'add-consumer.html', {'form': form})




@login_required
def generate_bill(request):
    if request.method == 'POST':
        consumer_id = request.POST.get('consumer')
        units = float(request.POST.get('units', 0))
        rate = float(request.POST.get('rate_per_unit', 7.50))
        fixed_charges = float(request.POST.get('fixed_charges', 125.00))
        billing_period_str = request.POST.get('billing_period')
        due_date = request.POST.get('due_date')

        consumer = get_object_or_404(Consumer, id=consumer_id)

        # Parse billing_period string (format: YYYY-MM) to date
        if billing_period_str:
            try:
                billing_period = datetime.strptime(billing_period_str + '-01', '%Y-%m-%d').date()
            except ValueError:
                billing_period = datetime.now().date()
        else:
            billing_period = datetime.now().date()

        # Parse due_date string to date
        if due_date:
            try:
                due_date = datetime.strptime(due_date, '%Y-%m-%d').date()
            except ValueError:
                due_date = (datetime.now() + timedelta(days=15)).date()
        else:
            due_date = (datetime.now() + timedelta(days=15)).date()

        # Get previous reading
        last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date').first()
        previous_reading = last_reading.current_reading if last_reading else 0
        current_reading = previous_reading + units

        # Create meter reading
        meter_reading = MeterReading.objects.create(
            consumer=consumer,
            previous_reading=previous_reading,
            current_reading=current_reading,
            reading_date=datetime.now().date(),
            units_consumed=units,
            created_by=request.user
        )

        # Create bill
        bill = Bill.objects.create(
            consumer=consumer,
            meter_reading=meter_reading,
            units=units,
            rate_per_unit=rate,
            fixed_charges=fixed_charges,
            billing_period=billing_period,
            due_date=due_date
        )

        # If this is an HTMX request, return a small HTML fragment (no PDF)
        if request.headers.get('HX-Request') or request.headers.get('Hx-Request') or request.META.get('HTTP_HX_REQUEST'):
            html = render_to_string('partials/generate_bill_response.html', {'bill': bill}, request=request)
            return HttpResponse(html)
        # ── Generate PDF using new AMU eMeter Generator ──
        try:
            pdf_data = {
                'bill_number': bill.bill_number,
                'bill_date': bill.created_at.strftime('%d %b %Y') if bill.created_at else datetime.now().strftime('%d %b %Y'),
                'due_date': bill.due_date.strftime('%d %b %Y') if bill.due_date else 'N/A',
                'connection_type': bill.consumer.connection_type,
                'load_kw': bill.consumer.load_kw,
                'billing_period': bill.billing_period.strftime('%B %Y') if bill.billing_period else 'N/A',
                'consumer_name': bill.consumer.name,
                'consumer_number': bill.consumer.consumer_number,
                'meter_number': bill.consumer.meter_number,
                'address': bill.consumer.address,
                'previous_reading': bill.meter_reading.previous_reading if bill.meter_reading else 0,
                'current_reading': bill.meter_reading.current_reading if bill.meter_reading else 0,
                'units': bill.units,
                'rate_per_unit': bill.rate_per_unit,
                'energy_charges': bill.energy_charges,
                'fixed_charges': bill.fixed_charges,
                'duty_charge': bill.duty_charge,
                'meter_rent': bill.meter_rent,
                'meter_type': '1' if bill.consumer.meter_type == '10' else '3',
                'regulatory_surcharge': bill.regulatory_surcharge,
                'arrears': bill.arrears,
                'late_payment_surcharge': bill.late_payment_surcharge,
                'total_amount': bill.total_amount,
                'total_payable': int(round(bill.total_amount)),
                'current_year': datetime.now().year,
            }
            
            pdf_content = BillPDFGenerator.generate_bill_pdf(pdf_data)
            
            if pdf_content:
                response = HttpResponse(pdf_content, content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="AMU_Bill_{bill.bill_number}.pdf"'
                return response
            else:
                return HttpResponse("Error generating PDF", status=500)
        except Exception as e:
            return HttpResponse(f"PDF Generation Failed: {str(e)}", status=500)

    consumers = Consumer.objects.filter(status='active')
    return render(request, 'generate-bill.html', {'consumers': consumers})

@login_required
def meter_readings(request):
    """View all meter readings"""
    readings = MeterReading.objects.select_related('consumer').order_by('-reading_date')
    return render(request, 'meter-readings.html', {'readings': readings})


@login_required
def bills(request):
    """View all bills"""
    status_filter = request.GET.get('status', '')
    
    bills = Bill.objects.select_related('consumer').order_by('-created_at')
    
    if status_filter:
        bills = bills.filter(status=status_filter)

    # HTMX partial support
    if request.headers.get('HX-Request') or request.headers.get('Hx-Request') or request.META.get('HTTP_HX_REQUEST'):
        return render(request, 'partials/bills_list.html', {'bills': bills})

    return render(request, 'bills.html', {'bills': bills, 'status_filter': status_filter})


@login_required
def payments(request):
    """View all payments"""
    payments_list = Payment.objects.select_related('bill__consumer').order_by('-payment_date')
    return render(request, 'payments.html', {'payments': payments_list})


# Consumer Portal Views
@login_required
def consumer_dashboard(request):
    """Consumer dashboard view"""
    try:
        consumer = request.user.consumer
    except Consumer.DoesNotExist:
        # Try to find consumer by email
        consumer = Consumer.objects.filter(email=request.user.email).first()
        if consumer:
            consumer.user = request.user
            consumer.save()
        else:
            messages.error(request, 'No consumer account found for this user')
            return redirect('login')
    
    # Get current bill
    current_bill = Bill.objects.filter(consumer=consumer, status='unpaid').first()
    
    # Get payment history
    payment_history = Payment.objects.filter(
        bill__consumer=consumer
    ).select_related('bill').order_by('-payment_date')[:5]
    
    # Get recent readings
    recent_readings = MeterReading.objects.filter(
        consumer=consumer
    ).order_by('-reading_date')[:6]
    
    # Calculate usage stats
    this_month_reading = recent_readings.first()
    last_month_reading = recent_readings[1] if len(recent_readings) > 1 else None
    
    usage_comparison = 0
    if this_month_reading and last_month_reading:
        if last_month_reading.units_consumed > 0:
            usage_comparison = ((this_month_reading.units_consumed - last_month_reading.units_consumed) 
                              / last_month_reading.units_consumed * 100)
    
    context = {
        'consumer': consumer,
        'current_bill': current_bill,
        'payment_history': payment_history,
        'recent_readings': recent_readings,
        'usage_comparison': usage_comparison,
    }
    
    return render(request, 'consumer-portal.html', context)


@login_required
def consumer_bills(request):
    """View all bills for current consumer"""
    try:
        consumer = request.user.consumer
    except Consumer.DoesNotExist:
        consumer = Consumer.objects.get(email=request.user.email)
    
    bills = Bill.objects.filter(consumer=consumer).order_by('-billing_period')
    return render(request, 'consumer-bills.html', {'bills': bills})


@login_required
def bill_details_partial(request, bill_id):
    """Return bill details fragment for HTMX"""
    bill = get_object_or_404(Bill, id=bill_id)
    return render(request, 'partials/consumer_bill_details.html', {'bill': bill})


@login_required
def make_payment(request, bill_id):
    """Process payment for a bill"""
    bill = get_object_or_404(Bill, id=bill_id, consumer__user=request.user)
    
    if request.method == 'POST':
        payment_method = request.POST.get('payment_method')
        
        # Generate transaction ID
        transaction_id = 'TXN' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
        
        # Create payment
        Payment.objects.create(
            bill=bill,
            transaction_id=transaction_id,
            amount=bill.total_amount,
            payment_method=payment_method,
            status='success'
        )
        
        # Update bill status
        bill.status = 'paid'
        bill.paid_date = datetime.now().date()
        bill.transaction_id = transaction_id
        bill.save()
        
        messages.success(request, f'Payment successful! Transaction ID: {transaction_id}')
        return redirect('consumer_dashboard')
    
    return render(request, 'make-payment.html', {'bill': bill})


# Meter Reader Views
@login_required
def meter_reader_dashboard(request):
    """Meter reader dashboard"""
    try:
        profile = request.user.profile
        if profile.role not in ['meter_reader', 'admin']:
            return redirect('dashboard')
    except UserProfile.DoesNotExist:
        pass
    
    # Get assigned consumers (for now, all active consumers)
    assigned_consumers = Consumer.objects.filter(status='active')
    
    # Get today's readings count
    today = datetime.now().date()
    today_readings = MeterReading.objects.filter(reading_date=today).count()
    
    # Get pending readings (consumers without readings this month)
    this_month = today.replace(day=1)
    consumers_with_readings = MeterReading.objects.filter(
        reading_date__gte=this_month
    ).values_list('consumer_id', flat=True)
    
    pending_readings = assigned_consumers.exclude(id__in=consumers_with_readings).count()
    
    context = {
        'assigned_consumers': assigned_consumers,
        'total_assigned': assigned_consumers.count(),
        'today_readings': today_readings,
        'pending_readings': pending_readings,
        'completion_rate': round((today_readings / assigned_consumers.count() * 100) if assigned_consumers.count() > 0 else 0, 1),
    }
    
    return render(request, 'meter-reader.html', context)


@login_required
def submit_reading(request):
    """Submit meter reading"""
    if request.method == 'POST':
        consumer_id = request.POST.get('consumer')
        previous_reading = float(request.POST.get('previous_reading', 0))
        current_reading = float(request.POST.get('current_reading', 0))
        reading_date = request.POST.get('reading_date')
        reading_time = request.POST.get('reading_time')
        remarks = request.POST.get('remarks', '')
        
        if current_reading < previous_reading:
            messages.error(request, 'Current reading must be greater than or equal to previous reading')
            return redirect('submit_reading')
        
        consumer = get_object_or_404(Consumer, id=consumer_id)
        
        # Parse time if provided
        reading_time_obj = None
        if reading_time:
            try:
                reading_time_obj = datetime.strptime(reading_time, '%H:%M').time()
            except ValueError:
                pass
        
        # Create meter reading
        reading = MeterReading.objects.create(
            consumer=consumer,
            previous_reading=previous_reading,
            current_reading=current_reading,
            reading_date=reading_date,
            reading_time=reading_time_obj,
            remarks=remarks,
            created_by=request.user
        )

        # If this is an HTMX request, return a small fragment that HTMX will swap
        if request.headers.get('HX-Request') or request.headers.get('Hx-Request') or request.META.get('HTTP_HX_REQUEST'):
            units = (current_reading - previous_reading) if current_reading >= previous_reading else 0
            context = {
                'consumer_id': consumer.id,
                'previous_reading': current_reading,
                'current_reading': current_reading,
                'units_consumed': units,
            }
            html = render_to_string('partials/reading_response.html', context, request=request)
            return HttpResponse(html)

        messages.success(request, 'Reading submitted successfully!')
        return redirect('meter_reader_dashboard')
    
    # Get consumers with their last reading
    consumers = Consumer.objects.filter(status='active')
    consumer_data = []
    
    for consumer in consumers:
        last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date').first()
        consumer_data.append({
            'consumer': consumer,
            'previous_reading': last_reading.current_reading if last_reading else 0
        })
    
    today = datetime.now().date().strftime('%Y-%m-%d')
    
    return render(request, 'submit-reading.html', {
        'consumer_data': consumer_data,
        'today': today
    })


# API Views for AJAX calls
# API Views for AJAX calls

# .1
@csrf_exempt
def api_get_consumer(request, consumer_id):
    """Get consumer details for API"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    consumer = get_object_or_404(Consumer, id=consumer_id)
    last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date').first()
    
    data = {
        'id': consumer.id,
        'name': consumer.name,
        'meter_number': consumer.meter_number,
        'consumer_number': consumer.consumer_number,
        'address': consumer.address,
        'status': consumer.status,
        'previous_reading': last_reading.current_reading if last_reading else 0,
        # Safe fallbacks from model properties/methods
        'load_kw': getattr(consumer, 'load_kw', 1.0),
        'meter_type': getattr(consumer, 'meter_type', '10'),
    }
    
    return JsonResponse(data)

# .2
@csrf_exempt
def api_get_bill(request, bill_id):
    """Get bill details for API"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    bill = get_object_or_404(Bill, id=bill_id)
    
    data = {
        'id': bill.id,
        'consumer': bill.consumer.name,
        'units': bill.units,
        'rate': bill.rate_per_unit,
        'fixed_charges': bill.fixed_charges,
        'energy_charges': bill.energy_charges,
        'total_amount': bill.total_amount,
        'status': bill.status,
        'due_date': bill.due_date.strftime('%Y-%m-%d'),
    }
    
    return JsonResponse(data)

# .3 
@csrf_exempt
def api_calculate_bill(request):
    """Calculate bill amount"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    if request.method == 'GET':
        units = float(request.GET.get('units', 0))
        rate = float(request.GET.get('rate', 7.50))
        fixed_charges = float(request.GET.get('fixed_charges', 125.00))
        
        energy_charges = units * rate
        total = energy_charges + fixed_charges
        
        return JsonResponse({
            'units': units,
            'energy_charges': round(energy_charges, 2),
            'fixed_charges': fixed_charges,
            'total_amount': round(total, 2)
        })
    
    return JsonResponse({'error': 'Invalid request'}, status=400)

# 4. 
@api_view(['GET', 'POST'])
@csrf_exempt
def api_consumer_list(request):
    # print(f"DEBUG: api_consumer_list auth: {request.auth}")
    # print(f"DEBUG: User authenticated: {request.user.is_authenticated}")
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    if request.method == 'GET':
        consumers = Consumer.objects.all()
        results = []
        for c in consumers:
            # Get the most recent reading for this consumer
            last_reading = MeterReading.objects.filter(consumer=c).order_by('-reading_date', '-id').first()
            prev_val = last_reading.current_reading if last_reading else 0
            
            results.append({
                'id': c.id,
                'name': c.name,
                'meter_number': c.meter_number,
                'consumer_number': c.consumer_number,
                'address': c.address,
                'status': c.status,
                'load_kw': c.load_kw,
                'meter_type': c.meter_type,
                'previous_reading': prev_val
            })
        return JsonResponse({'consumers': results})

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            # Validate required fields
            if not data.get('name') or not data.get('meter_number'):
                return JsonResponse({'success': False, 'error': 'Name and Meter Number are required.'}, status=400)
            # Check for duplicate meter number
            if Consumer.objects.filter(meter_number=data['meter_number']).exists():
                return JsonResponse({'success': False, 'error': 'A consumer with this meter number already exists.'}, status=400)

            # Manual consumer ID or auto-generate
            consumer_number = data.get('consumer_number', '').strip()
            if consumer_number:
                if Consumer.objects.filter(consumer_number=consumer_number).exists():
                    return JsonResponse({'success': False, 'error': 'A consumer with this ID already exists.'}, status=400)
            else:
                consumer_number = 'CN' + ''.join(random.choices(string.digits, k=6))
                while Consumer.objects.filter(consumer_number=consumer_number).exists():
                    consumer_number = 'CN' + ''.join(random.choices(string.digits, k=6))

            consumer = Consumer.objects.create(
                name=data.get('name'),
                phone=data.get('phone', ''),
                email=data.get('email') or None,
                address=data.get('address', ''),
                post=data.get('post', ''),
                department=data.get('department', ''),
                meter_number=data.get('meter_number'),
                load_kw=float(data.get('load_kw', 1.0)),
                meter_type=data.get('meter_type', '10'),
                connection_type=data.get('connection_type', 'residential'),
                status=data.get('status', 'active'),
                consumer_number=consumer_number,
                created_at=timezone.now(),
                updated_at=timezone.now(),
            )

            # Create initial meter reading if provided
            initial_reading = data.get('initial_reading')
            if initial_reading is not None:
                try:
                    reading_val = float(initial_reading)
                    MeterReading.objects.create(
                        consumer=consumer,
                        previous_reading=0,
                        current_reading=reading_val,
                        reading_date=timezone.now().date(),
                        reading_time=timezone.now().time(),
                        remarks='Initial reading at registration',
                        created_by=request.user if request.user.is_authenticated else None,
                        created_at=timezone.now(),
                    )
                except (ValueError, TypeError):
                    pass  # Skip if invalid number

            return JsonResponse({
                'success': True,
                'id': consumer.id,
                'consumer_number': consumer.consumer_number,
                'name': consumer.name,
                'meter_number': consumer.meter_number,
            }, status=201)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    return JsonResponse({'detail': 'Method not allowed'}, status=405)

# 5. 
@csrf_exempt
def api_bills_list(request):
    """Get all bills for admin"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    if request.method == 'GET':
        bills = Bill.objects.select_related('consumer').all()
        results = []
        for b in bills:
            results.append({
                'id': b.id,
                'consumer_name': b.consumer.name if b.consumer else 'N/A',
                'consumer_number': b.consumer.consumer_number if b.consumer else 'N/A',
                'meter_number': b.consumer.meter_number if b.consumer else 'N/A',
                'units': b.units,
                'total_amount': b.total_amount,
                'status': b.status,
                'billing_period': b.billing_period.strftime('%Y-%m-%d') if b.billing_period else '',
                'connection_type': b.consumer.connection_type if b.consumer else 'salary',
                'due_date': b.due_date.strftime('%Y-%m-%d') if b.due_date else '',
                'created_at': b.created_at.isoformat() if b.created_at else None,
            })
        return JsonResponse({'bills': results})

# 6. 
@csrf_exempt
def api_logout(request):
    """JSON logout endpoint for SPA clients"""
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    logout(request)
    return JsonResponse({'success': True, 'message': 'Logged out successfully'})

# 7. 
@csrf_exempt
def api_consumer_detail(request, consumer_id):
    """Get, update, or delete a consumer"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    consumer = get_object_or_404(Consumer, id=consumer_id)

    if request.method == 'GET':
        # Get last reading
        last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date', '-id').first()
        prev_val = last_reading.current_reading if last_reading else 0

        data = {
            'id': consumer.id,
            'name': consumer.name,
            'meter_number': consumer.meter_number,
            'consumer_number': consumer.consumer_number,
            'email': consumer.email,
            'phone': consumer.phone,
            'address': consumer.address,
            'status': consumer.status,
            'load_kw': str(consumer.load_kw) if consumer.load_kw else '',
            'meter_type': consumer.meter_type,
            'connection_type': consumer.connection_type,
            'department': consumer.department,
            'post': consumer.post,
            'previous_reading': prev_val,
        }
        return JsonResponse(data)

    if request.method in ['PUT', 'PATCH']:
        try:
            data = json.loads(request.body)
            for key, value in data.items():
                if hasattr(consumer, key):
                    # Handle empty strings for numeric fields
                    if key == 'load_kw':
                        try:
                            value = float(value) if value else 1.0
                        except ValueError:
                            value = 1.0
                    elif value == "":
                        try:
                            field = consumer._meta.get_field(key)
                            if isinstance(field, (models.FloatField, models.IntegerField)) and not field.null:
                                continue
                        except Exception:
                            pass
                    
                    # Prevent overwriting with empty consumer number
                    if key == 'consumer_number' and not value:
                        continue
                        
                    setattr(consumer, key, value)
            consumer.save()
            return JsonResponse({'success': True, 'message': 'Consumer updated successfully'})
        except Exception as e:
            import traceback
            print(f"PATCH Error: {str(e)}\n{traceback.format_exc()}")
            return JsonResponse({'success': False, 'error': f"Server error: {str(e)}"}, status=400)

    if request.method == 'DELETE':
        consumer.delete()
        return JsonResponse({'success': True, 'message': 'Consumer deleted successfully'})

@csrf_exempt
def api_consumer_readings(request, consumer_id):
    """Get reading history for a specific consumer"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    readings = MeterReading.objects.filter(consumer_id=consumer_id).order_by('-reading_date')
    results = []
    for reading in readings:
        results.append({
            'id': reading.id,
            'date': reading.reading_date.strftime('%Y-%m-%d') if reading.reading_date else '',
            'reading': reading.current_reading,
            'prev': reading.previous_reading,
            'usage': reading.units_consumed,
            'recorded_by': reading.created_by.username if reading.created_by else 'Admin',
            'remarks': reading.remarks or '',
            'created_at': reading.created_at.isoformat() if reading.created_at else None,
        })
    return JsonResponse(results, safe=False)

    return JsonResponse({'detail': 'Method not allowed'}, status=405)


# 8. 
@csrf_exempt
@api_view(['GET'])
def api_consumer_search(request):
    """Search consumers by meter number, name, or ID"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    query = request.GET.get('meter_number', '')  # Param name remains for compatibility
    if not query:
        return JsonResponse({'detail': 'search parameter required'}, status=400)
    
    try:
        consumers = Consumer.objects.filter(
            Q(meter_number__icontains=query) |
            Q(name__icontains=query) |
            Q(consumer_number__icontains=query) |
            Q(id__icontains=query if query.isdigit() else '0')
        )
        # Trigger query to check for missing columns
        list(consumers[:1]) 
    except Exception as e:
        if 'no such column' in str(e):
            consumers = consumers.defer('load_kw', 'meter_type')
        else:
            raise e

    results = []
    for c in consumers:
        # Get last reading to help UI
        last_reading = MeterReading.objects.filter(consumer=c).order_by('-reading_date').first()
        results.append({
            'id': c.id,
            'name': c.name,
            'meter_number': c.meter_number,
            'consumer_number': c.consumer_number,
            'status': c.status,
            'previous_reading': last_reading.current_reading if last_reading else 0,
            'load_kw': getattr(c, 'load_kw', 1.0),
            'meter_type': getattr(c, 'meter_type', '10'),
            'address': c.address
        })
    return JsonResponse({'consumers': results})


#9
@csrf_exempt
@api_view(['GET', 'POST'])
def api_readings_list(request):
    """Get all meter readings (GET) or submit a new one (POST)"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    if request.method == 'GET':
        readings = MeterReading.objects.select_related('consumer').order_by('-reading_date')
        results = []
        for reading in readings:
            results.append({
                'id': reading.id,
                'consumer_id': reading.consumer.id,
                'consumer_name': reading.consumer.name,
                'meter_number': reading.consumer.meter_number,
                'previous_reading': reading.previous_reading,
                'current_reading': reading.current_reading,
                'units_consumed': reading.units_consumed,
                'reading_date': reading.reading_date.strftime('%Y-%m-%d') if reading.reading_date else None,
                'created_at': reading.created_at.strftime('%Y-%m-%d %H:%M') if reading.created_at else None,
            })
        return JsonResponse({'readings': results})
    
    if request.method == 'POST':
        return api_submit_reading(request)

#10
@csrf_exempt
def api_bill_detail(request, bill_id):
    """Get or update a bill"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    bill = get_object_or_404(Bill, id=bill_id)

    if request.method == 'GET':
        data = {
            'id': bill.id,
            'bill_number': bill.bill_number,
            'consumer_id': bill.consumer.id,
            'consumer_name': bill.consumer.name,
            'consumer_number': bill.consumer.consumer_number,
            'meter_number': bill.consumer.meter_number,
            'address': bill.consumer.address,
            'connection_type': bill.consumer.connection_type,
            'load_kw': bill.consumer.load_kw,
            'meter_type': bill.consumer.meter_type,
            'previous_reading': bill.meter_reading.previous_reading if bill.meter_reading else 0,
            'current_reading': bill.meter_reading.current_reading if bill.meter_reading else 0,
            'units': bill.units,
            'rate_per_unit': bill.rate_per_unit,
            'fixed_charges': bill.fixed_charges,
            'energy_charges': bill.energy_charges,
            'duty_charge': bill.duty_charge,
            'meter_rent': bill.meter_rent,
            'regulatory_surcharge': bill.regulatory_surcharge,
            'arrears': bill.arrears,
            'late_payment_surcharge': bill.late_payment_surcharge,
            'total_amount': bill.total_amount,
            'status': bill.status,
            'billing_period': bill.billing_period.strftime('%B %Y') if bill.billing_period else None,
            'due_date': bill.due_date.strftime('%Y-%m-%d') if bill.due_date else None,
            'paid_date': bill.paid_date.strftime('%Y-%m-%d') if bill.paid_date else None,
            'created_at': bill.created_at.isoformat() if bill.created_at else None,
        }
        return JsonResponse(data)

    if request.method == 'PATCH':
        data = json.loads(request.body)
        if 'status' in data:
            bill.status = data['status']
            if data['status'] == 'paid':
                bill.paid_date = datetime.now().date()
            bill.save()
        return JsonResponse({'success': True, 'message': 'Bill updated successfully'})

    return JsonResponse({'detail': 'Method not allowed'}, status=405)

@csrf_exempt
def api_mark_bill_paid(request, bill_id):
    """Mark a bill as paid"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    try:
        bill = get_object_or_404(Bill, id=bill_id)
        bill.status = 'paid'
        bill.paid_date = datetime.now().date()
        bill.save()
        return JsonResponse({'success': True, 'message': 'Bill marked as paid'})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

#12
@csrf_exempt
def api_mark_bill_unpaid(request, bill_id):
    """Mark a bill as unpaid"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    try:
        bill = get_object_or_404(Bill, id=bill_id)
        bill.status = 'unpaid'
        bill.paid_date = None
        bill.save()
        return JsonResponse({'success': True, 'message': 'Bill marked as unpaid'})
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

#13
@csrf_exempt
def api_submit_reading(request):
    """API endpoint for submitting meter reading"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            consumer_id = data.get('consumer_id')
            current_reading = float(data.get('current_reading', 0))
            reading_date = data.get('reading_date')
            consumer = get_object_or_404(Consumer, id=consumer_id)
            last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date').first()
            previous_reading = last_reading.current_reading if last_reading else 0
            reading = MeterReading.objects.create(
                consumer=consumer,
                previous_reading=previous_reading,
                current_reading=current_reading,
                reading_date=reading_date,
                created_by=request.user if request.user.is_authenticated else None
            )
            return JsonResponse({
                'success': True,
                'reading_id': reading.id,
                'units_consumed': reading.units_consumed
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    return JsonResponse({'error': 'Invalid request'}, status=400)

#14
@csrf_exempt
def download_bill_pdf(request, bill_id):
    """Generate a professional electricity bill PDF"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    try:
        bill = get_object_or_404(Bill, id=bill_id)
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
        elements = []
        
        # Style Initialization - Define everything manually to avoid KeyError
        # styles = getSampleStyleSheet() # Skipping because it's missing basic keys like 'Normal'
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            fontSize=10,
            leading=12,
            fontName='Helvetica'
        )
        
        normal_bold = ParagraphStyle(
            'CustomNormalBold',
            fontSize=10,
            leading=12,
            fontName='Helvetica-Bold'
        )
        
        title_style = ParagraphStyle(
            'BillTitle',
            fontSize=26,
            alignment=1, # Center
            spaceAfter=10,
            textColor=colors.HexColor('#1a5f7a'),
            fontName='Helvetica-Bold'
        )
        
        subtitle_style = ParagraphStyle(
            'BillSubtitle',
            fontSize=12,
            alignment=1,
            spaceAfter=30,
            textColor=colors.grey,
            fontName='Helvetica'
        )
        
        section_header = ParagraphStyle(
            'SectionHeader',
            fontSize=14,
            spaceBefore=15,
            spaceAfter=10,
            textColor=colors.HexColor('#1a5f7a'),
            fontName='Helvetica-Bold'
        )
        
        # Header
        elements.append(Paragraph("EMETER SOLUTIONS", title_style))
        elements.append(Paragraph("Official Electricity Consumption Invoice", subtitle_style))
        
        # Invoice Header Info
        header_data = [
            [Paragraph("<b>Invoice No:</b>", normal_style), Paragraph(f"#{bill.id}", normal_bold), 
             Paragraph("<b>Bill Date:</b>", normal_style), Paragraph(bill.created_at.strftime('%d %b %Y') if bill.created_at else "N/A", normal_bold)],
            [Paragraph("<b>Bill Number:</b>", normal_style), Paragraph(bill.bill_number or "N/A", normal_bold), 
             Paragraph("<b>Due Date:</b>", normal_style), Paragraph(bill.due_date.strftime('%d %b %Y') if bill.due_date else "N/A", normal_bold)]
        ]
        header_table = Table(header_data, colWidths=[1.2*inch, 1.5*inch, 1.2*inch, 1.5*inch])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 20))
        
        # Consumer Information
        elements.append(Paragraph("Consumer Information", section_header))
        consumer_data = [
            ["Name:", bill.consumer.name],
            ["Consumer ID:", bill.consumer.consumer_number],
            ["Meter No:", bill.consumer.meter_number],
            ["Load:", f"{bill.consumer.load_kw} KW"],
            ["Address:", Paragraph(bill.consumer.address or "No address provided", normal_style)]
        ]
        consumer_table = Table(consumer_data, colWidths=[1.5*inch, 4*inch])
        consumer_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ]))
        elements.append(consumer_table)
        
        # Readings Table
        elements.append(Paragraph("Consumption Details", section_header))
        reading_data = [
            ["Previous Reading", "Current Reading", "Units Consumed"],
            [f"{float(bill.meter_reading.previous_reading if bill.meter_reading else 0):.1f} kWh", 
             f"{float(bill.meter_reading.current_reading if bill.meter_reading else 0):.1f} kWh", 
             f"{float(bill.units):.1f} kWh"]
        ]
        reading_table = Table(reading_data, colWidths=[1.8*inch, 1.8*inch, 1.8*inch])
        reading_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5f7a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(reading_table)
        
        # Charge Breakdown
        elements.append(Paragraph("Charge Breakdown", section_header))
        charge_data = [
            ["Description", "Details", "Amount"],
            ["Energy Charges", f"{bill.units} units @ ₹{bill.rate_per_unit}", f"₹{float(bill.energy_charges):.2f}"],
            ["Fixed Charges", f"Load Based", f"₹{float(bill.fixed_charges):.2f}"],
            ["Meter Rent", f"Phase Type: {bill.consumer.meter_type}", f"₹{float(bill.meter_rent):.2f}"],
            ["Duty & Taxes", f"Surcharge Included", f"₹{float(bill.duty_charge):.2f}"],
            ["Arrears", f"Previous Balance", f"₹{float(bill.arrears):.2f}"],
            ["<b>TOTAL PAYABLE</b>", "", f"<b>₹{float(bill.total_amount):.2f}</b>"],
        ]
        charge_table = Table(charge_data, colWidths=[2.5*inch, 1.5*inch, 1.4*inch])
        charge_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f0f0')),
            ('GRID', (0, 0), (-1, -2), 0.5, colors.lightgrey),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(charge_table)
        
        # Payment Status
        elements.append(Spacer(1, 30))
        status_color = colors.green if bill.status == 'paid' else colors.red
        elements.append(Paragraph(f"<b>Payment Status: {bill.status.upper()}</b>", 
                                 ParagraphStyle('Status', parent=normal_style, textColor=status_color, fontSize=12, alignment=1)))
        
        # Footer
        elements.append(Spacer(1, 50))
        elements.append(Paragraph("This is a computer generated invoice and does not require a physical signature.", subtitle_style))
        
        doc.build(elements)
        pdf = buffer.getvalue()
        buffer.close()
        
        filename = f"Bill_{bill.consumer.consumer_number}_{bill.billing_period.strftime('%b_%Y') if bill.billing_period else bill.id}.pdf"
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return JsonResponse({'error': f'PDF Generation Error: {str(e)}'}, status=500)

#             return JsonResponse({
#                 'success': True,
#                 'reading_id': reading.id,
#                 'units_consumed': reading.units_consumed
#             })
            
#         except Exception as e:
#             return JsonResponse({'success': False, 'error': str(e)}, status=400)
    
#     return JsonResponse({'error': 'Invalid request'}, status=400)


# @login_required
# def download_bill_pdf(request, bill_id):
#     """Download bill as PDF"""
#     bill = get_object_or_404(Bill, id=bill_id)
    
#     # Generate PDF using reportlab
#     buffer = io.BytesIO()
#     doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
#     elements = []
#     
#     # Define safe styles manually
#     normal_style = ParagraphStyle('Normal', fontSize=10, leading=12)
#     title_style = ParagraphStyle('Title', fontSize=24, leading=28, spaceAfter=20, fontName='Helvetica-Bold')
#     
#     # Header
#     elements.append(Paragraph("PowerGrid", title_style))
#     elements.append(Paragraph("Electricity Billing Statement", normal_style))
#     elements.append(Spacer(1, 20))
#     
#     # Bill Number and Period
#     elements.append(Paragraph(f"<b>Bill Number:</b> {bill.bill_number}", normal_style))
#     if bill.billing_period:
#         elements.append(Paragraph(f"<b>Billing Period:</b> {bill.billing_period.strftime('%B %Y')}", normal_style))
#     elements.append(Spacer(1, 20))
#     
#     # Consumer Info
#     elements.append(Paragraph("Consumer Information", heading_style))
#     consumer_data = [
#         ['Consumer Name:', bill.consumer.name],
#         ['Meter Number:', bill.consumer.meter_number],
#         ['Consumer Number:', bill.consumer.consumer_number],
#         ['Address:', bill.consumer.address or 'N/A'],
#     ]
#     consumer_table = Table(consumer_data, colWidths=[2*inch, 4*inch])
#     consumer_table.setStyle(TableStyle([
#         ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
#         ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
#         ('FONTSIZE', (0, 0), (-1, -1), 10),
#         ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
#     ]))
#     elements.append(consumer_table)
#     elements.append(Spacer(1, 20))
#     
#     # Meter Readings
#     elements.append(Paragraph("Meter Readings", heading_style))
#     reading_data = [
#         ['Previous Reading', 'Current Reading', 'Units Consumed'],
#         [str(bill.meter_reading.previous_reading) if bill.meter_reading else '0',
#          str(bill.meter_reading.current_reading) if bill.meter_reading else '0',
#          str(bill.units)]
#     ]
#     reading_table = Table(reading_data, colWidths=[2*inch, 2*inch, 2*inch])
#     reading_table.setStyle(TableStyle([
#         ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0b4f9f')),
#         ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
#         ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#         ('FONTSIZE', (0, 0), (-1, -1), 10),
#         ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
#         ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
#         ('GRID', (0, 0), (-1, -1), 1, colors.grey),
#         ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
#     ]))
#     elements.append(reading_table)
#     elements.append(Spacer(1, 20))
#     
#     # Charges
#     elements.append(Paragraph("Charge Breakdown", heading_style))
#     charges_data = [
#         ['Description', 'Amount'],
#         [f'Energy Charges ({bill.units} kWh × ₹{bill.rate_per_unit})', f'₹{bill.energy_charges:.2f}'],
#         ['Fixed / Service Charges', f'₹{bill.fixed_charges:.2f}'],
#         ['Total Amount Due', f'₹{bill.total_amount:.2f}'],
#     ]
#     charges_table = Table(charges_data, colWidths=[4*inch, 2*inch])
#     charges_table.setStyle(TableStyle([
#         ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#         ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
#         ('FONTSIZE', (0, 0), (-1, -1), 10),
#         ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
#         ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
#         ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
#         ('GRID', (0, 0), (-1, -2), 1, colors.grey),
#         ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor('#0b4f9f')),
#         ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f5e9')),
#     ]))
#     elements.append(charges_table)
#     elements.append(Spacer(1, 20))
#     
#     # Due Date and Status
#     elements.append(Paragraph(f"<b>Due Date:</b> {bill.due_date.strftime('%d %B %Y') if bill.due_date else 'N/A'}", normal_style))
#     elements.append(Paragraph(f"<b>Status:</b> {bill.status.upper()}", normal_style))
#     
#     # Build PDF
#     doc.build(elements)
#     pdf_file = buffer.getvalue()
#     buffer.close()
#     
#     response = HttpResponse(pdf_file, content_type='application/pdf')
#     response['Content-Disposition'] = f'attachment; filename="bill-{bill.bill_number}.pdf"'
#     return response



def spa_index(request, path=None):
    """Render the single-page application index from energy-hub-ui/build."""
    import os
    build_dir = os.path.join(settings.BASE_DIR.parent, 'energy-hub-ui', 'dist')
    index_path = os.path.join(build_dir, 'index.html')
    
    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            content = f.read()
            return HttpResponse(content)
    except FileNotFoundError:
        return HttpResponse(
            f"Vite build not found at {index_path}. Please run 'npm run build' in energy-hub-ui.",
            status=404
        )


# ==========================================
# Mobile App API Endpoints
# ==========================================

#15 - Combined: Submit Reading + Generate Bill (with cumulative arrears)
@csrf_exempt
@api_view(['POST'])
def api_submit_reading_and_generate_bill(request):
    """Submit a meter reading and auto-generate a bill with cumulative unpaid arrears."""
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    try:
        data = json.loads(request.body)
        consumer_id = data.get('consumer_id')
        current_reading = float(data.get('current_reading', 0))
        reading_date = data.get('reading_date')

        if not consumer_id:
            return JsonResponse({'error': 'consumer_id is required'}, status=400)
        if not reading_date:
            return JsonResponse({'error': 'reading_date is required'}, status=400)

        consumer = get_object_or_404(Consumer, id=consumer_id)

        # 1. ATOMICITY: Use transaction to ensure both Reading and Bill succeed together
        from django.db import transaction
        with transaction.atomic():
            # 2. IDEMPOTENCY: Check if reading already exists for this date (prevent double-submit)
            if MeterReading.objects.filter(consumer=consumer, reading_date=reading_date).exists():
                return JsonResponse({
                    'error': f'A reading for {reading_date} already exists for this consumer.',
                    'already_exists': True
                }, status=400)

            # Get previous reading
            last_reading = MeterReading.objects.filter(
                consumer=consumer
            ).order_by('-reading_date').first()
            previous_reading = last_reading.current_reading if last_reading else 0

            if current_reading < previous_reading:
                return JsonResponse({
                    'error': f'Current reading ({current_reading}) cannot be less than previous reading ({previous_reading})',
                    'previous_reading': previous_reading
                }, status=400)

            # Create the meter reading
            reading = MeterReading.objects.create(
                consumer=consumer,
                previous_reading=previous_reading,
                current_reading=current_reading,
                reading_date=reading_date,
                reading_time=datetime.now().time(),
                created_by=request.user,
            )

            # Calculate units consumed
            units_consumed = current_reading - previous_reading

            # Parse reading date for billing period and due date
            try:
                reading_date_obj = datetime.strptime(reading_date, '%Y-%m-%d').date()
            except ValueError:
                reading_date_obj = datetime.now().date()

            due_date = reading_date_obj + timedelta(days=30)

            # Create the bill (will trigger model.save() logic)
            bill = Bill.objects.create(
                consumer=consumer,
                meter_reading=reading,
                units=units_consumed,
                billing_period=reading_date_obj.replace(day=1),
                due_date=due_date,
            )

        return JsonResponse({
            'success': True,
            'reading': {
                'id': reading.id,
                'previous_reading': previous_reading,
                'current_reading': current_reading,
                'units_consumed': units_consumed,
                'reading_date': reading_date,
            },
            'bill': {
                'id': bill.id,
                'bill_number': bill.bill_number,
                'consumer_name': consumer.name,
                'consumer_number': consumer.consumer_number,
                'meter_number': consumer.meter_number,
                'address': consumer.address,
                'load_kw': getattr(consumer, 'load_kw', 1.0),
                'meter_type': getattr(consumer, 'meter_type', '10'),
                'units': units_consumed,
                'rate_per_unit': getattr(bill, 'rate_per_unit', 8.56),
                'energy_charges': bill.energy_charges,
                'fixed_charges': getattr(bill, 'fixed_charges', units_consumed * 0), # Simplified for UI if missing
                'duty_charge': getattr(bill, 'duty_charge', 0),
                'meter_rent': getattr(bill, 'meter_rent', 0),
                'regulatory_surcharge': getattr(bill, 'regulatory_surcharge', 0),
                'late_payment_surcharge': getattr(bill, 'late_payment_surcharge', 0),
                'arrears': getattr(bill, 'arrears', 0),
                'grand_total': bill.total_amount,
                'billing_period': reading_date_obj.strftime('%B %Y'),
                'due_date': due_date.strftime('%Y-%m-%d'),
                'created_at': bill.created_at.isoformat(),
                'status': bill.status,
            }
        })

    except OperationalError as e:
        error_msg = str(e)
        if "readonly" in error_msg.lower():
            error_msg = "Database is read-only. Please stop the server and run: cd /Users/anasahmad/Documents/eMeter.web/electricity_system && chmod 664 db.sqlite3 && python3 manage.py migrate"
        return JsonResponse({'success': False, 'error': error_msg}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
@api_view(['GET'])
def api_get_settings(request):
    """Retrieve current billing settings"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    settings = BillingSettings.get_settings()
    data = {
        'rate_per_unit': settings.rate_per_unit,
        'fixed_charge_per_kw': settings.fixed_charge_per_kw,
        'phase_1_rent': settings.phase_1_rent,
        'phase_3_rent': settings.phase_3_rent,
        'duty_percentage': settings.duty_percentage,
    }
    return JsonResponse(data)

@csrf_exempt
@api_view(['POST'])
def api_update_settings(request):
    """Update billing settings (Restricted to admin by mobile role logic)"""
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    try:
        data = json.loads(request.body)
        settings = BillingSettings.get_settings()
        
        # Check if we got a mock object (no _state attribute is a good check for Django models)
        if not hasattr(settings, '_state'):
            return JsonResponse({
                'success': False, 
                'error': 'Database error: Settings table is missing or database is locked. Please contact administrator.'
            }, status=500)

        if 'rate_per_unit' in data:
            settings.rate_per_unit = float(data['rate_per_unit'])
        if 'fixed_charge_per_kw' in data:
            settings.fixed_charge_per_kw = float(data['fixed_charge_per_kw'])
        if 'phase_1_rent' in data:
            settings.phase_1_rent = float(data['phase_1_rent'])
        if 'phase_3_rent' in data:
            settings.phase_3_rent = float(data['phase_3_rent'])
        if 'duty_percentage' in data:
            settings.duty_percentage = float(data['duty_percentage'])
            
        settings.save()
        return JsonResponse({'success': True, 'message': 'Settings updated successfully'})
    except ValueError as e:
        return JsonResponse({'success': False, 'error': f'Invalid numeric value: {str(e)}'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': f'Server Error: {str(e)}'}, status=500)

@csrf_exempt
def api_send_bill_sms(request):
    """Send bill summary SMS to consumer's phone number via Twilio."""
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    try:
        data = json.loads(request.body)
        bill_id = data.get('bill_id')

        if not bill_id:
            return JsonResponse({'error': 'bill_id is required'}, status=400)

        bill = get_object_or_404(Bill, id=bill_id)
        consumer = bill.consumer

        if not consumer.phone:
            return JsonResponse({
                'success': False,
                'error': 'Consumer does not have a phone number on file'
            }, status=400)

        # Compose SMS message
        message_body = (
            f"Dear {consumer.name}, your electricity bill has been generated.\n"
            f"Bill#: {bill.bill_number}\n"
            f"Units: {bill.units} kWh\n"
            f"Amount: Rs.{bill.total_amount:.2f}\n"
            f"Due: {bill.due_date.strftime('%d-%b-%Y') if bill.due_date else 'N/A'}\n"
            f"- PowerGrid eMeter, AMU"
        )

        # Try sending via Twilio
        twilio_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
        twilio_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
        # Prefer WhatsApp if available/configured, otherwise SMS
        twilio_sender = getattr(settings, 'TWILIO_WHATSAPP_FROM', '') or getattr(settings, 'TWILIO_PHONE_NUMBER', '')

        if not all([twilio_sid, twilio_token, twilio_sender]):
            # Twilio not configured — return the message content for display
            return JsonResponse({
                'success': True,
                'sms_sent': False,
                'reason': 'Twilio credentials not configured. SMS not sent.',
                'message_preview': message_body,
                'phone': consumer.phone,
            })

        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)

            # Ensure phone has country code
            phone = consumer.phone.strip()
            if not phone.startswith('+'):
                phone = '+91' + phone.lstrip('0')

            # Use WhatsApp format for the recipient if sending via WhatsApp
            to_phone = phone
            if twilio_sender.startswith('whatsapp:'):
                if not to_phone.startswith('whatsapp:'):
                    to_phone = f'whatsapp:{to_phone}'

            print(f"DEBUG: Attempting to send Twilio message from {twilio_sender} to {to_phone}")
            sms = client.messages.create(
                body=message_body,
                from_=twilio_sender,
                to=to_phone
            )
            print(f"DEBUG: Twilio message sent successfully. SID: {sms.sid}")

            return JsonResponse({
                'success': True,
                'sms_sent': True,
                'message_sid': sms.sid,
                'phone': phone,
                'message_preview': message_body,
            })

        except ImportError:
            return JsonResponse({
                'success': True,
                'sms_sent': False,
                'reason': 'Twilio library not installed. Run: pip install twilio',
                'message_preview': message_body,
                'phone': consumer.phone,
            })
        except Exception as sms_error:
            return JsonResponse({
                'success': True,
                'sms_sent': False,
                'reason': f'SMS send failed: {str(sms_error)}',
                'message_preview': message_body,
                'phone': consumer.phone,
            })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


#17 - Edit Today's Reading Only
@csrf_exempt
def api_edit_today_reading(request, reading_id):
    """Edit a meter reading — only allowed if reading_date is today."""
    if request.method not in ['PUT', 'PATCH']:
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    try:
        reading = get_object_or_404(MeterReading, id=reading_id)

        # Check if reading is from today
        today = datetime.now().date()
        if reading.reading_date != today:
            return JsonResponse({
                'success': False,
                'error': 'You can only edit readings from today',
                'reading_date': str(reading.reading_date),
                'today': str(today),
            }, status=403)

        data = json.loads(request.body)
        new_current_reading = float(data.get('current_reading', reading.current_reading))

        if new_current_reading < reading.previous_reading:
            return JsonResponse({
                'error': 'Current reading must be >= previous reading',
                'previous_reading': reading.previous_reading,
            }, status=400)

        # Update the reading
        reading.current_reading = new_current_reading
        reading.units_consumed = new_current_reading - reading.previous_reading
        reading.save()

        # Update linked bill if exists
        linked_bill = Bill.objects.filter(meter_reading=reading).first()
        if linked_bill:
            units = reading.units_consumed
            linked_bill.units = units
            linked_bill.energy_charges = units * linked_bill.rate_per_unit

            # Recalculate arrears
            unpaid_bills = Bill.objects.filter(
                consumer=reading.consumer,
                status__in=['unpaid', 'overdue', 'pending']
            ).exclude(id=linked_bill.id)
            arrears = sum(b.total_amount for b in unpaid_bills)

            linked_bill.total_amount = linked_bill.energy_charges + linked_bill.fixed_charges + arrears
            linked_bill.save()

            return JsonResponse({
                'success': True,
                'reading': {
                    'id': reading.id,
                    'current_reading': reading.current_reading,
                    'units_consumed': reading.units_consumed,
                },
                'bill_updated': True,
                'bill': {
                    'id': linked_bill.id,
                    'bill_number': linked_bill.bill_number,
                    'units': linked_bill.units,
                    'energy_charges': round(linked_bill.energy_charges, 2),
                    'arrears': round(arrears, 2),
                    'grand_total': round(linked_bill.total_amount, 2),
                }
            })

        return JsonResponse({
            'success': True,
            'reading': {
                'id': reading.id,
                'current_reading': reading.current_reading,
                'units_consumed': reading.units_consumed,
            },
            'bill_updated': False,
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

@csrf_exempt
@api_view(['GET'])
def api_get_bill_pdf(request, bill_id):
    """API endpoint to download branded PDF bill"""
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)
    
    bill = get_object_or_404(Bill, id=bill_id)
    
    try:
        pdf_data = {
            'bill_number': bill.bill_number,
            'bill_date': bill.created_at.strftime('%d %b %Y') if bill.created_at else datetime.now().strftime('%d %b %Y'),
            'due_date': bill.due_date.strftime('%d %b %Y') if bill.due_date else 'N/A',
            'connection_type': bill.consumer.connection_type,
            'load_kw': bill.consumer.load_kw,
            'billing_period': bill.billing_period.strftime('%B %Y') if bill.billing_period else 'N/A',
            'consumer_name': bill.consumer.name,
            'consumer_number': bill.consumer.consumer_number,
            'meter_number': bill.consumer.meter_number,
            'address': bill.consumer.address,
            'previous_reading': bill.meter_reading.previous_reading if bill.meter_reading else 0,
            'current_reading': bill.meter_reading.current_reading if bill.meter_reading else 0,
            'units': bill.units,
            'rate_per_unit': bill.rate_per_unit,
            'energy_charges': bill.energy_charges,
            'fixed_charges': bill.fixed_charges,
            'duty_charge': bill.duty_charge,
            'meter_rent': bill.meter_rent,
            'meter_type': '1' if bill.consumer.meter_type == '10' else '3',
            'regulatory_surcharge': bill.regulatory_surcharge,
            'arrears': bill.arrears,
            'late_payment_surcharge': bill.late_payment_surcharge,
            'total_amount': bill.total_amount,
            'total_payable': int(round(bill.total_amount)),
            'current_year': datetime.now().year,
        }
        
        pdf_content = BillPDFGenerator.generate_bill_pdf(pdf_data)
        
        if pdf_content:
            response = HttpResponse(pdf_content, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="AMU_Bill_{bill.bill_number}.pdf"'
            return response
        return JsonResponse({'error': 'Failed to generate PDF'}, status=500)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)



@csrf_exempt
@api_view(['POST'])
def api_manual_generate_bill(request):
    """Manually generate a bill for a consumer with provided data"""
    if not request.user.is_authenticated or request.user.profile.role != 'admin':
        return JsonResponse({'detail': 'Admin authentication required'}, status=403)
        
    try:
        data = json.loads(request.body or '{}')
        consumer_id = data.get('consumer_id')
        current_reading = float(data.get('current_reading', 0))
        billing_period_str = data.get('billing_period')
        due_date_str = data.get('due_date')
        
        consumer = get_object_or_404(Consumer, id=consumer_id)
        
        # Get last reading
        last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date').first()
        previous_reading = last_reading.current_reading if last_reading else 0
        
        if current_reading < previous_reading:
            return JsonResponse({'error': 'Current reading cannot be less than previous reading'}, status=400)
            
        # Create reading
        reading = MeterReading.objects.create(
            consumer=consumer,
            previous_reading=previous_reading,
            current_reading=current_reading,
            reading_date=datetime.now().date(),
            created_by=request.user
        )
        
        # Create bill
        billing_period = datetime.strptime(billing_period_str + '-01', '%Y-%m-%d').date() if billing_period_str else datetime.now().date()
        due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date() if due_date_str else (datetime.now() + timedelta(days=15)).date()
        
        bill = Bill.objects.create(
            consumer=consumer,
            meter_reading=reading,
            units=reading.units_consumed,
            billing_period=billing_period,
            due_date=due_date
        )
        
        return JsonResponse({
            'success': True,
            'bill_id': bill.id,
            'bill_number': bill.bill_number,
            'created_at': bill.created_at.isoformat() if bill.created_at else None,
            'message': 'Bill generated successfully'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@api_view(['POST'])
def api_import_readings(request):
    """Import meter readings from an Excel file.

    Supports two column layouts (auto-detected):

    4-column layout (recommended):
        A: Consumer Number  B: Meter Number  C: Current Reading  D: Reading Date (optional)

    3-column layout (legacy / mobile export):
        A: Consumer Number  B: Current Reading  C: Reading Date (optional)

    Validation steps:
        1. Auto-detect layout from whether column B is numeric or text
        2. Verify Consumer Number exists; if meter number is provided, cross-check it
        3. Check no duplicate reading exists for the same billing month
        4. Validate reading value (must be >= previous), then save + generate bill
    """
    if not request.user.is_authenticated:
        return JsonResponse({'detail': 'Authentication required'}, status=401)

    # Safe role check — handle users without a profile object gracefully
    try:
        if request.user.profile.role != 'admin':
            return JsonResponse({'detail': 'Admin authentication required'}, status=403)
    except Exception:
        if not (request.user.is_staff or request.user.is_superuser):
            return JsonResponse({'detail': 'Admin authentication required'}, status=403)

    if 'file' not in request.FILES:
        return JsonResponse({'error': 'No file provided'}, status=400)

    excel_file = request.FILES['file']

    try:
        import openpyxl
        wb = openpyxl.load_workbook(excel_file)
        sheet = wb.active

        success_count = 0
        error_count = 0
        errors = []
        bills_created = []

        from django.db import transaction

        # ── Auto-detect column layout ────────────────────────────────────────
        # Peek at row 2 (first data row).  If col B parses as a number → 3-col;
        # if it looks like text → 4-col.
        layout = 4  # default
        for peek_row in sheet.iter_rows(min_row=2, max_row=3, values_only=True):
            if not peek_row or len(peek_row) < 2:
                break
            col_b = peek_row[1]
            if col_b is not None:
                try:
                    float(col_b)
                    layout = 3  # col B is numeric → reading value
                except (ValueError, TypeError):
                    layout = 4  # col B is text → meter number
            break

        for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if not row:
                continue

            # ── Parse columns based on detected layout ───────────────────────
            if layout == 3:
                # A: Consumer Number, B: Current Reading, C: Reading Date
                if len(row) < 2:
                    continue
                consumer_number  = str(row[0]).strip() if row[0] is not None else None
                meter_number     = None   # not provided — skip cross-check
                current_reading  = row[1]
                reading_date_raw = row[2] if len(row) > 2 else None
            else:
                # A: Consumer Number, B: Meter Number, C: Current Reading, D: Reading Date
                if len(row) < 3:
                    continue
                consumer_number  = str(row[0]).strip() if row[0] is not None else None
                meter_number     = str(row[1]).strip() if row[1] is not None else None
                current_reading  = row[2]
                reading_date_raw = row[3] if len(row) > 3 else None

            # Skip fully empty rows
            if consumer_number is None and current_reading is None:
                continue
            # Skip header-like rows that somehow sneak into data rows
            if consumer_number and str(consumer_number).lower() in ('consumer number', 'consumer_number', 'consumer#'):
                continue

            # ── STEP 1: Verify Consumer Number ──────────────────────────────
            if not consumer_number:
                errors.append(f"Row {row_idx}: Consumer Number is required.")
                error_count += 1
                continue

            try:
                consumer = Consumer.objects.get(consumer_number=consumer_number)
            except Consumer.DoesNotExist:
                errors.append(f"Row {row_idx}: Consumer '{consumer_number}' not found in system.")
                error_count += 1
                continue

            # Cross-verify meter number only if provided (4-col layout)
            if meter_number and str(consumer.meter_number).strip() != meter_number:
                errors.append(
                    f"Row {row_idx}: Meter '{meter_number}' does not match "
                    f"consumer '{consumer_number}' (registered meter: '{consumer.meter_number}')."
                )
                error_count += 1
                continue

            # ── Parse reading date ───────────────────────────────────────────
            if not reading_date_raw:
                reading_date = datetime.now().date()
            elif hasattr(reading_date_raw, 'date'):
                reading_date = reading_date_raw.date()
            elif isinstance(reading_date_raw, str):
                reading_date_str = reading_date_raw.strip()
                parsed = None
                for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d'):
                    try:
                        parsed = datetime.strptime(reading_date_str, fmt).date()
                        break
                    except ValueError:
                        continue
                reading_date = parsed if parsed else datetime.now().date()
            else:
                reading_date = datetime.now().date()

            billing_month = reading_date.replace(day=1)

            # ── STEP 2: Duplicate check ──────────────────────────────────────
            dup = MeterReading.objects.filter(
                consumer=consumer,
                reading_date__year=billing_month.year,
                reading_date__month=billing_month.month,
            ).first()
            if dup:
                errors.append(
                    f"Row {row_idx} ({consumer_number}): Reading already exists for "
                    f"{billing_month.strftime('%B %Y')} (on {dup.reading_date}). Skipped."
                )
                error_count += 1
                continue

            # ── STEP 3: Validate reading value ───────────────────────────────
            try:
                curr_val = float(current_reading)
            except (ValueError, TypeError):
                errors.append(f"Row {row_idx} ({consumer_number}): Invalid reading value '{current_reading}'. Must be a number.")
                error_count += 1
                continue

            last_reading = MeterReading.objects.filter(
                consumer=consumer,
                reading_date__lt=reading_date,
            ).order_by('-reading_date', '-id').first()

            if not last_reading:
                last_reading = MeterReading.objects.filter(
                    consumer=consumer
                ).order_by('-reading_date', '-id').first()

            previous_val = float(last_reading.current_reading) if last_reading else float(consumer.initial_reading or 0)

            if curr_val < previous_val:
                errors.append(
                    f"Row {row_idx} ({consumer_number}): Reading {curr_val} < previous {previous_val}. Rejected."
                )
                error_count += 1
                continue

            units_consumed = curr_val - previous_val

            # ── Save reading + generate bill ─────────────────────────────────
            try:
                with transaction.atomic():
                    reading_obj = MeterReading.objects.create(
                        consumer=consumer,
                        previous_reading=previous_val,
                        current_reading=curr_val,
                        reading_date=reading_date,
                        reading_time=datetime.now().time(),
                        created_by=request.user,
                        remarks="Imported from Excel",
                    )

                    due_date = reading_date + timedelta(days=30)
                    bill = Bill.objects.create(
                        consumer=consumer,
                        meter_reading=reading_obj,
                        units=units_consumed,
                        billing_period=billing_month,
                        due_date=due_date,
                    )

                    bills_created.append({
                        'consumer_number': consumer.consumer_number,
                        'consumer_name': consumer.name,
                        'meter_number': consumer.meter_number,
                        'bill_number': bill.bill_number,
                        'previous_reading': previous_val,
                        'current_reading': curr_val,
                        'units': round(units_consumed, 2),
                        'total_amount': float(bill.total_amount or 0),
                        'due_date': due_date.strftime('%Y-%m-%d'),
                        'status': bill.status,
                    })
                    success_count += 1

            except Exception as e:
                errors.append(f"Row {row_idx} ({consumer_number}): Failed to save — {str(e)}")
                error_count += 1

        return JsonResponse({
            'success': True,
            'layout_detected': f'{layout}-column',
            'message': f'Import complete — {success_count} bill(s) generated, {error_count} failed.',
            'success_count': success_count,
            'error_count': error_count,
            'bills': bills_created,
            'errors': errors[:50],
        })

    except ImportError:
        return JsonResponse(
            {'error': 'openpyxl not installed. Run: pip install openpyxl'},
            status=500
        )
    except Exception as e:
        import traceback
        return JsonResponse({'error': f'Failed to process file: {str(e)}', 'trace': traceback.format_exc()}, status=500)

