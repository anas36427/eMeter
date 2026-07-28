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
    try:
        print(f"Generating PDF for Bill #{bill.bill_number}...")
        pdf = BillPDFGenerator.generate_bill_pdf(bill)
        if pdf:
            print("PDF generated successfully! Size:", len(pdf))
            with open("test_output.pdf", "wb") as f:
                f.write(pdf)
            print("Saved verification file as test_output.pdf")
        else:
            print("PDF generation returned None")
    except Exception as e:
        print("Error generating PDF:", str(e))
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_pdf()
