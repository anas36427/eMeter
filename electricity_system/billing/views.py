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

from .models import Consumer, MeterReading, Bill, Payment, UserProfile
from .forms import (ConsumerForm, MeterReadingForm, BillForm, PaymentForm, 
                    LoginForm, ConsumerRegistrationForm)
from django.http import HttpResponse
from django.template.loader import render_to_string
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Message
from .serializers import MessageSerializer


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
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'Invalid JSON body'}, status=400)

    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'admin')

    if not username or not password:
        return JsonResponse({'detail': 'Username and password are required'}, status=400)

    user = authenticate(request, username=username, password=password)

    if user is None:
        return JsonResponse({'detail': 'Invalid credentials'}, status=401)

    # Verify/assign role
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={'role': role})
    if profile.role != role:
        # Reject mismatched role to avoid privilege confusion
        return JsonResponse({'detail': 'Role mismatch for this user'}, status=403)

    login(request, user)

    # Ensure CSRF cookie for subsequent state-changing requests
    csrf_token = get_token(request)
    response = JsonResponse({
        'success': True,
        'username': user.username,
        'role': profile.role,
    })
    response.set_cookie('csrftoken', csrf_token, httponly=False, samesite='Lax')
    return response


@login_required
def api_me(request):
    """Return current user and role for SPA auth guard"""
    profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'role': 'consumer'})
    return JsonResponse({
        'authenticated': True,
        'username': request.user.username,
        'role': profile.role,
    })


@login_required
def api_dashboard_stats(request):
    """JSON stats for SPA dashboard"""
    total_consumers = Consumer.objects.count()
    active_consumers = Consumer.objects.filter(status='active').count()
    total_bills = Bill.objects.count()
    paid_bills = Bill.objects.filter(status='paid').count()
    unpaid_bills = Bill.objects.filter(status='unpaid').count()
    overdue_bills = Bill.objects.filter(status='overdue').count()
    total_revenue = Bill.objects.filter(status='paid').aggregate(total=Sum('total_amount'))['total'] or 0
    return JsonResponse({
        'total_consumers': total_consumers,
        'active_consumers': active_consumers,
        'total_bills': total_bills,
        'paid_bills': paid_bills,
        'unpaid_bills': unpaid_bills,
        'overdue_bills': overdue_bills,
        'total_revenue': round(total_revenue, 2),
    })


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

        # ── Generate PDF using reportlab ──
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=20)
        heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, spaceAfter=10, textColor=colors.HexColor('#0b4f9f'))
        
        # Header
        elements.append(Paragraph("PowerGrid", title_style))
        elements.append(Paragraph("Electricity Billing Statement", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Bill Number and Period
        elements.append(Paragraph(f"<b>Bill Number:</b> {bill.bill_number}", styles['Normal']))
        if bill.billing_period:
            elements.append(Paragraph(f"<b>Billing Period:</b> {bill.billing_period.strftime('%B %Y')}", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Consumer Info
        elements.append(Paragraph("Consumer Information", heading_style))
        consumer_data = [
            ['Consumer Name:', bill.consumer.name],
            ['Meter Number:', bill.consumer.meter_number],
            ['Consumer Number:', bill.consumer.consumer_number],
            ['Address:', bill.consumer.address or 'N/A'],
        ]
        consumer_table = Table(consumer_data, colWidths=[2*inch, 4*inch])
        consumer_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(consumer_table)
        elements.append(Spacer(1, 20))
        
        # Meter Readings
        elements.append(Paragraph("Meter Readings", heading_style))
        reading_data = [
            ['Previous Reading', 'Current Reading', 'Units Consumed'],
            [str(bill.meter_reading.previous_reading) if bill.meter_reading else '0',
             str(bill.meter_reading.current_reading) if bill.meter_reading else '0',
             str(bill.units)]
        ]
        reading_table = Table(reading_data, colWidths=[2*inch, 2*inch, 2*inch])
        reading_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0b4f9f')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
        ]))
        elements.append(reading_table)
        elements.append(Spacer(1, 20))
        
        # Charges
        elements.append(Paragraph("Charge Breakdown", heading_style))
        charges_data = [
            ['Description', 'Amount'],
            [f'Energy Charges ({bill.units} kWh × ₹{bill.rate_per_unit})', f'₹{bill.energy_charges:.2f}'],
            ['Fixed / Service Charges', f'₹{bill.fixed_charges:.2f}'],
            ['Total Amount Due', f'₹{bill.total_amount:.2f}'],
        ]
        charges_table = Table(charges_data, colWidths=[4*inch, 2*inch])
        charges_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -2), 1, colors.grey),
            ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor('#0b4f9f')),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f5e9')),
        ]))
        elements.append(charges_table)
        elements.append(Spacer(1, 20))
        
        # Due Date and Status
        elements.append(Paragraph(f"<b>Due Date:</b> {bill.due_date.strftime('%d %B %Y') if bill.due_date else 'N/A'}", styles['Normal']))
        elements.append(Paragraph(f"<b>Status:</b> {bill.status.upper()}", styles['Normal']))
        
        # Build PDF
        doc.build(elements)
        pdf_file = buffer.getvalue()
        buffer.close()

        response = HttpResponse(pdf_file, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="bill-{bill.id}.pdf"'
        return response

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

@login_required
def api_get_consumer(request, consumer_id):
    """Get consumer details for API"""
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
    }
    
    return JsonResponse(data)


@login_required
def api_get_bill(request, bill_id):
    """Get bill details for API"""
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


@login_required
def api_calculate_bill(request):
    """Calculate bill amount"""
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


@login_required
def api_consumer_list(request):
    """Get list of consumers for dropdown"""
    consumers = Consumer.objects.filter(status='active').values('id', 'name', 'meter_number', 'consumer_number')
    return JsonResponse({'consumers': list(consumers)})


@login_required
def api_bills_list(request):
    """Get bills for consumer"""
    try:
        consumer = request.user.consumer
    except Consumer.DoesNotExist:
        consumer = Consumer.objects.get(email=request.user.email)
    
    bills = Bill.objects.filter(consumer=consumer).values(
        'id', 'units', 'total_amount', 'status', 'billing_period', 'due_date'
    )
    
    return JsonResponse({'bills': list(bills)})


# ─── ADDITIONAL API ENDPOINTS FOR FRONTEND ─────────────────────────────────

@login_required
def api_logout(request):
    """JSON logout endpoint for SPA clients"""
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)
    logout(request)
    return JsonResponse({'success': True, 'message': 'Logged out successfully'})


@login_required
def api_consumer_detail(request, consumer_id):
    """Get, update, or delete a consumer"""
    consumer = get_object_or_404(Consumer, id=consumer_id)
    
    if request.method == 'GET':
        data = {
            'id': consumer.id,
            'name': consumer.name,
            'meter_number': consumer.meter_number,
            'consumer_number': consumer.consumer_number,
            'email': consumer.email,
            'phone': consumer.phone,
            'address': consumer.address,
            'status': consumer.status,
        }
        return JsonResponse(data)
    
    if request.method in ['PUT', 'PATCH']:
        data = json.loads(request.body)
        for key, value in data.items():
            if hasattr(consumer, key):
                setattr(consumer, key, value)
        consumer.save()
        return JsonResponse({'success': True, 'message': 'Consumer updated successfully'})
    
    if request.method == 'DELETE':
        consumer.delete()
        return JsonResponse({'success': True, 'message': 'Consumer deleted successfully'})
    
    return JsonResponse({'detail': 'Method not allowed'}, status=405)


@login_required
def api_consumer_search(request):
    """Search consumers by meter number"""
    meter_number = request.GET.get('meter_number', '')
    if not meter_number:
        return JsonResponse({'detail': 'meter_number parameter required'}, status=400)
    
    consumers = Consumer.objects.filter(meter_number__icontains=meter_number)
    results = list(consumers.values('id', 'name', 'meter_number', 'consumer_number', 'status'))
    return JsonResponse({'consumers': results})


@login_required
def api_readings_list(request):
    """Get all meter readings"""
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


@login_required
def api_bill_detail(request, bill_id):
    """Get or update a bill"""
    bill = get_object_or_404(Bill, id=bill_id)
    
    if request.method == 'GET':
        data = {
            'id': bill.id,
            'consumer_id': bill.consumer.id,
            'consumer_name': bill.consumer.name,
            'meter_number': bill.consumer.meter_number,
            'units': bill.units,
            'rate_per_unit': bill.rate_per_unit,
            'fixed_charges': bill.fixed_charges,
            'energy_charges': bill.energy_charges,
            'total_amount': bill.total_amount,
            'status': bill.status,
            'billing_period': bill.billing_period.strftime('%Y-%m') if bill.billing_period else None,
            'due_date': bill.due_date.strftime('%Y-%m-%d') if bill.due_date else None,
            'paid_date': bill.paid_date.strftime('%Y-%m-%d') if bill.paid_date else None,
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


@login_required
def api_mark_bill_paid(request, bill_id):
    """Mark a bill as paid"""
    bill = get_object_or_404(Bill, id=bill_id)
    bill.status = 'paid'
    bill.paid_date = datetime.now().date()
    bill.save()
    return JsonResponse({'success': True, 'message': 'Bill marked as paid'})


@login_required
def api_mark_bill_unpaid(request, bill_id):
    """Mark a bill as unpaid"""
    bill = get_object_or_404(Bill, id=bill_id)
    bill.status = 'unpaid'
    bill.paid_date = None
    bill.save()
    return JsonResponse({'success': True, 'message': 'Bill marked as unpaid'})


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
            
            # Get previous reading
            last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date').first()
            previous_reading = last_reading.current_reading if last_reading else 0
            
            # Create reading
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


@login_required
def download_bill_pdf(request, bill_id):
    """Download bill as PDF"""
    bill = get_object_or_404(Bill, id=bill_id)
    
    # Generate PDF using reportlab
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=20)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, spaceAfter=10, textColor=colors.HexColor('#0b4f9f'))
    
    # Header
    elements.append(Paragraph("PowerGrid", title_style))
    elements.append(Paragraph("Electricity Billing Statement", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Bill Number and Period
    elements.append(Paragraph(f"<b>Bill Number:</b> {bill.bill_number}", styles['Normal']))
    if bill.billing_period:
        elements.append(Paragraph(f"<b>Billing Period:</b> {bill.billing_period.strftime('%B %Y')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Consumer Info
    elements.append(Paragraph("Consumer Information", heading_style))
    consumer_data = [
        ['Consumer Name:', bill.consumer.name],
        ['Meter Number:', bill.consumer.meter_number],
        ['Consumer Number:', bill.consumer.consumer_number],
        ['Address:', bill.consumer.address or 'N/A'],
    ]
    consumer_table = Table(consumer_data, colWidths=[2*inch, 4*inch])
    consumer_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(consumer_table)
    elements.append(Spacer(1, 20))
    
    # Meter Readings
    elements.append(Paragraph("Meter Readings", heading_style))
    reading_data = [
        ['Previous Reading', 'Current Reading', 'Units Consumed'],
        [str(bill.meter_reading.previous_reading) if bill.meter_reading else '0',
         str(bill.meter_reading.current_reading) if bill.meter_reading else '0',
         str(bill.units)]
    ]
    reading_table = Table(reading_data, colWidths=[2*inch, 2*inch, 2*inch])
    reading_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0b4f9f')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
    ]))
    elements.append(reading_table)
    elements.append(Spacer(1, 20))
    
    # Charges
    elements.append(Paragraph("Charge Breakdown", heading_style))
    charges_data = [
        ['Description', 'Amount'],
        [f'Energy Charges ({bill.units} kWh × ₹{bill.rate_per_unit})', f'₹{bill.energy_charges:.2f}'],
        ['Fixed / Service Charges', f'₹{bill.fixed_charges:.2f}'],
        ['Total Amount Due', f'₹{bill.total_amount:.2f}'],
    ]
    charges_table = Table(charges_data, colWidths=[4*inch, 2*inch])
    charges_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -2), 1, colors.grey),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor('#0b4f9f')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f5e9')),
    ]))
    elements.append(charges_table)
    elements.append(Spacer(1, 20))
    
    # Due Date and Status
    elements.append(Paragraph(f"<b>Due Date:</b> {bill.due_date.strftime('%d %B %Y') if bill.due_date else 'N/A'}", styles['Normal']))
    elements.append(Paragraph(f"<b>Status:</b> {bill.status.upper()}", styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    pdf_file = buffer.getvalue()
    buffer.close()
    
    response = HttpResponse(pdf_file, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="bill-{bill.bill_number}.pdf"'
    return response


def spa_index(request):
    """Render the single-page application index served from static/frontend."""
    return render(request, 'frontend_index.html')
