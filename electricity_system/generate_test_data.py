import os
import django
import sys
import openpyxl
from datetime import datetime

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from billing.models import Consumer

def create_bot_consumers():
    print("Creating bot consumers...")
    bots = [
        {'consumer_number': 'BOT-001', 'name': 'Bot Consumer One', 'meter_number': 'METER-B01'},
        {'consumer_number': 'BOT-002', 'name': 'Bot Consumer Two', 'meter_number': 'METER-B02'},
        {'consumer_number': 'BOT-003', 'name': 'Bot Consumer Three', 'meter_number': 'METER-B03'},
        {'consumer_number': 'BOT-004', 'name': 'Bot Consumer Four', 'meter_number': 'METER-B04'},
        {'consumer_number': 'BOT-005', 'name': 'Bot Consumer Five', 'meter_number': 'METER-B05'},
    ]
    
    for bot_data in bots:
        # Delete if exists to recreate
        Consumer.objects.filter(consumer_number=bot_data['consumer_number']).delete()
        
        c = Consumer(
            consumer_number=bot_data['consumer_number'],
            name=bot_data['name'],
            meter_number=bot_data['meter_number'],
            connection_type='single_phase',
            billing_type='salary',
            load_kw=1.00,
            meter_type='digital',
            status='active'
        )
        c.save()
        print(f"Created consumer: {c.consumer_number} with meter: {c.meter_number}")
        
    print("\nGenerating Excel file...")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Meter Readings"
    
    # 4-column layout headers: Consumer Number, Meter Number, Current Reading, Reading Date
    ws.append(["Consumer Number", "Meter Number", "Current Reading", "Reading Date"])
    
    # Add data
    today_str = datetime.now().strftime('%Y-%m-%d')
    ws.append(['BOT-001', 'METER-B01', 120.5, today_str])
    ws.append(['BOT-002', 'METER-B02', 45.0, today_str])
    ws.append(['BOT-003', 'METER-B03', 200.0, today_str])
    ws.append(['BOT-004', 'METER-B04', 350.2, today_str])
    ws.append(['BOT-005', 'METER-B05', 10.0, today_str])
    
    file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test_bot_readings.xlsx")
    wb.save(file_path)
    print(f"Excel file generated successfully at: {file_path}")

if __name__ == '__main__':
    create_bot_consumers()
