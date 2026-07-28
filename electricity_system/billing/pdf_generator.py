import os
from django.conf import settings
from django.template.loader import get_template
from xhtml2pdf import pisa
from io import BytesIO
from datetime import datetime
from django.utils import timezone

def link_callback(uri, rel):
    """
    Convert HTML images/stylesheets URIs to absolute system paths so xhtml2pdf can access those resources.
    """
    # 1. Resolve relative static URLs (e.g. /static/logo.png)
    if uri.startswith(settings.STATIC_URL):
        path = os.path.join(settings.STATIC_ROOT, uri.replace(settings.STATIC_URL, ""))
        if os.path.exists(path):
            return path

    # 2. Resolve relative media URLs (e.g. /media/meter_images/...)
    if uri.startswith(settings.MEDIA_URL):
        path = os.path.join(settings.MEDIA_ROOT, uri.replace(settings.MEDIA_URL, ""))
        if os.path.exists(path):
            return path
            
    # 3. Resolve generic relative URLs by searching settings.BASE_DIR or parent directory
    if not uri.startswith('http://') and not uri.startswith('https://'):
        # Try finding in the Django project base directory
        path = os.path.abspath(os.path.join(settings.BASE_DIR, uri.lstrip('/')))
        # Try finding in parent base directory (monorepo level)
        parent_dir = os.path.abspath(os.path.dirname(settings.BASE_DIR))
        parent_path = os.path.abspath(os.path.join(parent_dir, uri.lstrip('/')))
        
        # Enforce that path MUST lie inside settings.BASE_DIR.parent to prevent LFI traversal out of directory
        allowed_root = os.path.abspath(parent_dir)
        
        if path.startswith(allowed_root) and os.path.exists(path):
            return path
        if parent_path.startswith(allowed_root) and os.path.exists(parent_path):
            return parent_path
            
    return uri

class BillPDFGenerator:
    @staticmethod
    def build_pdf_context(bill):
        """
        Centralized helper to build comprehensive PDF template context from a Bill model instance.
        Ensures all necessary fields (post, department, billing period, status, payments) are included.
        """
        # Resolve billing period string cleanly
        if getattr(bill, 'billing_period_start', None) and getattr(bill, 'billing_period_end', None):
            billing_period_str = f"{bill.billing_period_start.strftime('%d %b %Y')} to {bill.billing_period_end.strftime('%d %b %Y')}"
        elif getattr(bill, 'billing_period_start', None):
            billing_period_str = bill.billing_period_start.strftime('%B %Y')
        elif getattr(bill, 'billing_period', None):
            val = getattr(bill, 'billing_period')
            billing_period_str = val.strftime('%B %Y') if hasattr(val, 'strftime') else str(val)
        else:
            billing_period_str = 'N/A'

        # Resolve payment details
        payment_date = 'N/A'
        transaction_id = getattr(bill, 'transaction_id', '') or ''
        if getattr(bill, 'payment_date', None) and hasattr(bill.payment_date, 'strftime'):
            payment_date = bill.payment_date.strftime('%d %b %Y')
        elif hasattr(bill, 'payments'):
            successful_payment = bill.payments.filter(status='success').order_by('-payment_date').first()
            if successful_payment and successful_payment.payment_date:
                payment_date = successful_payment.payment_date.strftime('%d %b %Y') if hasattr(successful_payment.payment_date, 'strftime') else str(successful_payment.payment_date)
                if not transaction_id:
                    transaction_id = successful_payment.transaction_id
        
        # Resolve date
        if getattr(bill, 'is_locked', False) and getattr(bill, 'locked_at', None):
            bill_date_str = bill.locked_at.strftime('%d %b %Y')
        elif getattr(bill, 'bill_date', None) and hasattr(bill.bill_date, 'strftime'):
            bill_date_str = bill.bill_date.strftime('%d %b %Y')
        elif getattr(bill, 'created_at', None) and hasattr(bill.created_at, 'strftime'):
            bill_date_str = bill.created_at.strftime('%d %b %Y')
        else:
            bill_date_str = timezone.localtime().strftime('%d %b %Y')

        # Use snapshot fields when bill is locked or available
        is_locked = getattr(bill, 'is_locked', False)
        consumer = getattr(bill, 'consumer', None)
        consumer_name = bill.consumer_name_snapshot if (is_locked and getattr(bill, 'consumer_name_snapshot', None)) else (getattr(consumer, 'name', 'N/A') if consumer else 'N/A')
        meter_number = bill.meter_number_snapshot if (is_locked and getattr(bill, 'meter_number_snapshot', None)) else (
            bill.meter.meter_number if getattr(bill, 'meter', None) else (getattr(consumer, 'meter_number', 'N/A') if consumer else 'N/A')
        )
        units = bill.units_consumed_snapshot if (is_locked and getattr(bill, 'units_consumed_snapshot', None) is not None) else getattr(bill, 'units', 0.0)
        rate = bill.rate_snapshot if (is_locked and getattr(bill, 'rate_snapshot', None) is not None) else getattr(bill, 'rate_per_unit', 0.0)
        total_amt = bill.total_amount_snapshot if (is_locked and getattr(bill, 'total_amount_snapshot', None) is not None) else float(getattr(bill, 'total_amount', 0.0))

        # Resolve Historical Snapshots for Connection & Load (Ensures PDF reflects consumer & meter state at exact time of reading)
        raw_conn = getattr(bill, 'connection_type_snapshot', None) or (getattr(consumer, 'connection_type', 'single_phase') if consumer else 'single_phase')
        conn_type = str(raw_conn).replace('_', ' ').title()
        billing_type = consumer.get_billing_type_display() if (consumer and hasattr(consumer, 'get_billing_type_display')) else str(getattr(consumer, 'billing_type', 'salary') if consumer else 'salary').replace('_', ' ').title()

        load_kw_val = getattr(bill, 'load_kw_snapshot', None)
        load_kw = float(load_kw_val if load_kw_val is not None else (getattr(consumer, 'load_kw', 1.0) if consumer else 1.0))
        
        address = getattr(bill, 'address_snapshot', None) or (getattr(consumer, 'address', '') or 'N/A')
        department = getattr(bill, 'department_snapshot', None) or (getattr(consumer, 'department', '') or '')
        post = getattr(bill, 'post_snapshot', None) or (getattr(consumer, 'post', '') or '')
        meter_type_code = '1' if str(raw_conn) == 'single_phase' else '3'

        status_display = bill.get_status_display() if hasattr(bill, 'get_status_display') else str(getattr(bill, 'status', 'draft')).title()
        raw_status = str(getattr(bill, 'status', 'draft')).lower()

        return {
            'bill_number': getattr(bill, 'bill_number', '') or 'N/A',
            'bill_date': bill_date_str,
            'due_date': bill.due_date.strftime('%d %b %Y') if (getattr(bill, 'due_date', None) and hasattr(bill.due_date, 'strftime')) else 'N/A',
            'connection_type': conn_type,
            'billing_type': billing_type,
            'load_kw': load_kw,
            'billing_period': billing_period_str,
            'billing_period_start': bill.billing_period_start.strftime('%d %b %Y') if (getattr(bill, 'billing_period_start', None) and hasattr(bill.billing_period_start, 'strftime')) else 'N/A',
            'billing_period_end': bill.billing_period_end.strftime('%d %b %Y') if (getattr(bill, 'billing_period_end', None) and hasattr(bill.billing_period_end, 'strftime')) else 'N/A',
            'consumer_name': consumer_name,
            'consumer_number': getattr(consumer, 'consumer_number', '') if consumer else 'N/A',
            'meter_number': meter_number,
            'address': address,
            'department': department,
            'post': post,
            'phone': getattr(consumer, 'phone', '') or '',
            'email': getattr(consumer, 'email', '') or '',
            'reading_date': bill.meter_reading.reading_date.strftime('%d %b %Y') if (getattr(bill, 'meter_reading', None) and getattr(bill.meter_reading, 'reading_date', None)) else 'N/A',
            'previous_reading': bill.meter_reading.previous_reading if getattr(bill, 'meter_reading', None) else 0.0,
            'current_reading': bill.meter_reading.current_reading if getattr(bill, 'meter_reading', None) else units,
            'units': units,
            'rate_per_unit': rate,
            'energy_charges': float(getattr(bill, 'energy_charges', 0.0) or 0),
            'fixed_charges': float(getattr(bill, 'fixed_charges', 0.0) or 0),
            'duty_charge': float(getattr(bill, 'duty_charge', 0.0) or 0),
            'meter_rent': float(getattr(bill, 'meter_rent', 0.0) or 0),
            'meter_type': meter_type_code,
            'regulatory_surcharge': float(getattr(bill, 'regulatory_surcharge', 0.0) or 0),
            'arrears': float(getattr(bill, 'arrears', 0.0) or 0),
            'late_payment_surcharge': float(getattr(bill, 'late_payment_surcharge', 0.0) or 0),
            'total_amount': total_amt,
            'total_payable': int(round(total_amt)),
            'status': status_display.upper(),
            'raw_status': raw_status,
            'payment_date': payment_date,
            'transaction_id': transaction_id,
            'current_year': timezone.localtime().year,
            'is_finalized': is_locked,
        }

    @staticmethod
    def generate_bill_pdf(bill_data):
        """
        Generates a professional PDF bill in AMU eMeter format.
        bill_data: A dictionary containing all bill, consumer, and reading details,
                   or a Bill model instance.
        """
        if not isinstance(bill_data, dict):
            bill_data = BillPDFGenerator.build_pdf_context(bill_data)

        template = get_template('billing/bill_pdf.html')

        # Branding context — these are defaults; bill_data values override if provided
        context = {
            'company_name': 'eMeter AMU',
            'utility_name': 'Aligarh Muslim University Electricity Billing System.',
            'watermark_text': 'AMU EMETER',
            'current_year': timezone.localtime().year,   # always present for footer
            **bill_data,                           # caller data takes precedence
        }
        
        html = template.render(context)
        result = BytesIO()
        
        # Create PDF with link_callback to resolve relative asset paths
        pisa_status = pisa.CreatePDF(html, dest=result, link_callback=link_callback)
        
        if pisa_status.err:
            print(f"PISA ERROR: {pisa_status.err}")
            return None
            
        return result.getvalue()

