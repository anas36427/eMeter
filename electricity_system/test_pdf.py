import os
import django
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from billing.models import Bill

def test_pdf_gen(bill_id):
    bill = Bill.objects.get(id=bill_id)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    
    # Manually define styles as in views.py
    normal_style = ParagraphStyle('Normal', fontSize=10, leading=12)
    title_style = ParagraphStyle('Title', fontSize=24, leading=28, spaceAfter=20, fontName='Helvetica-Bold')
    
    elements.append(Paragraph("TEST BILL", title_style))
    elements.append(Paragraph(f"Bill ID: {bill.id}", normal_style))
    
    doc.build(elements)
    print(f"PDF generated successfully for Bill {bill_id}")

if __name__ == "__main__":
    try:
        # Try a bill that likely exists
        test_pdf_gen(32)
    except Exception as e:
        import traceback
        traceback.print_exc()
