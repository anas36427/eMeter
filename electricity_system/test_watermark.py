import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "electricity_system.settings")
django.setup()

from billing.pdf_generator import BillPDFGenerator

pdf_data = {
    'bill_number': '12345',
    'consumer_name': 'Test User',
    'total_payable': 100.0,
}
pdf = BillPDFGenerator.generate_bill_pdf(pdf_data)
with open('test_bill.pdf', 'wb') as f:
    f.write(pdf)
print("Saved to test_bill.pdf")
