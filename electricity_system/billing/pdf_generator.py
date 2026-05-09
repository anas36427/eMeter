import os
from django.conf import settings
from django.template.loader import get_template
from xhtml2pdf import pisa
from io import BytesIO
from datetime import datetime

class BillPDFGenerator:
    @staticmethod
    def generate_bill_pdf(bill_data):
        """
        Generates a professional PDF bill in AMU eMeter format.
        bill_data: A dictionary containing all bill, consumer, and reading details.
        """
        template = get_template('billing/bill_pdf.html')

        # Branding context — these are defaults; bill_data values override if provided
        context = {
            'company_name': 'eMeter AMU',
            'utility_name': 'Aligarh Muslim University Electricity Billing System.',
            'watermark_text': 'AMU EMETER',
            'current_year': datetime.now().year,   # always present for footer
            **bill_data,                           # caller data takes precedence
        }
        
        html = template.render(context)
        result = BytesIO()
        
        # Create PDF
        pisa_status = pisa.CreatePDF(html, dest=result)
        
        if pisa_status.err:
            print(f"PISA ERROR: {pisa_status.err}")
            return None
            
        return result.getvalue()
