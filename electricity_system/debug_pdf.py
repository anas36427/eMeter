import os
import django
import sys

# Setup Django
sys.path.append('/Users/anasahmad/Documents/eMeter.web/electricity_system')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from billing.models import Bill
from billing.pdf_generator import BillPDFGenerator
from datetime import datetime

def test_pdf():
    bill = Bill.objects.first()
    if not bill:
        print("No bills found")
        return

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
        'regulatory_surcharge': bill.regulatory_surcharge,
        'arrears': bill.arrears,
        'late_payment_surcharge': bill.late_payment_surcharge,
        'total_amount': bill.total_amount,
        'total_payable': int(round(bill.total_amount)),
        'current_year': datetime.now().year,
    }
    
    try:
        print("Generating PDF...")
        pdf = BillPDFGenerator.generate_bill_pdf(pdf_data)
        if pdf:
            print("PDF generated successfully! Size:", len(pdf))
        else:
            print("PDF generation returned None")
    except Exception as e:
        print("Error generating PDF:", str(e))
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pdf()
