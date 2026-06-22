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

