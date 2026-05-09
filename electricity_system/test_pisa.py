import os
import django
import sys
from io import BytesIO

# Setup Django
sys.path.append('/Users/anasahmad/Documents/eMeter.web/electricity_system')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.template.loader import get_template
from xhtml2pdf import pisa

def test_template_render():
    template = get_template('billing/bill_pdf.html')
    
    context = {
        'company_name': 'eMeter AMU',
        'utility_name': 'Aligarh Muslim University Electricity Billing System.',
        'watermark_text': 'AMU EMETER',
        'current_year': 2026,
        'bill_number': 'BILL12345',
        'bill_date': '10 May 2026',
        'due_date': '20 May 2026',
        'connection_type': 'Residential',
        'load_kw': 2.0,
        'billing_period': 'May 2026',
        'consumer_name': 'Test User',
        'consumer_number': '123456',
        'meter_number': 'M789',
        'address': 'Test Address',
        'previous_reading': 1000,
        'current_reading': 1100,
        'units': 100,
        'rate_per_unit': 8.56,
        'energy_charges': 856.0,
        'fixed_charges': 50.0,
        'duty_charge': 10.0,
        'meter_rent': 20.0,
        'regulatory_surcharge': 5.0,
        'arrears': 100.0,
        'late_payment_surcharge': 15.0,
        'total_amount': 1056.0,
    }
    
    html = template.render(context)
    print("Template rendered successfully!")
    
    result = BytesIO()
    pisa_status = pisa.CreatePDF(html, dest=result)
    
    if pisa_status.err:
        print("PISA Error:", pisa_status.err)
    else:
        print("PDF created successfully!")

if __name__ == "__main__":
    test_template_render()
