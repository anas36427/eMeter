"""
Script to query the active database and generate a dummy excel sheet
for testing the import readings module.
"""
import os
import django
import openpyxl
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from billing.models import Consumer, MeterReading

def generate_dummy_excel():
    print("Generating dummy readings Excel file...")
    
    # Create workbook
    wb = openpyxl.Workbook()
    
    # ── 1. Create sheet for 4-column layout (Recommended) ──
    ws4 = wb.active
    ws4.title = "4-Column Layout"
    ws4.append(["Consumer Number", "Meter Number", "Current Reading", "Reading Date"])
    
    # ── 2. Create sheet for 3-column layout (Legacy / Mobile Export) ──
    ws3 = wb.create_sheet("3-Column Layout")
    ws3.append(["Consumer Number", "Current Reading", "Reading Date"])
    
    # Fetch existing consumers
    consumers = Consumer.objects.all()
    if not consumers.exists():
        print("ERROR: No consumers found in the database. Please run create_sample_data.py first.")
        return
        
    print(f"Found {consumers.count()} consumers. Extracting reading history...")
    
    count = 0
    today_str = date.today().strftime('%Y-%m-%d')
    
    for consumer in consumers:
        # Find latest reading for the consumer
        last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date', '-id').first()
        prev_reading_val = last_reading.current_reading if last_reading else 0
        
        # Propose a valid next reading (must be greater than the previous reading)
        next_reading_val = prev_reading_val + 150
        
        # Append to 4-column sheet
        ws4.append([
            consumer.consumer_number,
            consumer.meter_number,
            next_reading_val,
            today_str
        ])
        
        # Append to 3-column sheet
        ws3.append([
            consumer.consumer_number,
            next_reading_val,
            today_str
        ])
        
        count += 1
        print(f"  Added {consumer.name} ({consumer.consumer_number}): Prev={prev_reading_val} -> Next={next_reading_val}")
        
    filename = "dummy_readings.xlsx"
    wb.save(filename)
    print(f"\nSUCCESS: Dummy readings saved successfully to '{filename}'!")
    print("You can upload this file directly inside the admin import readings interface to test.")

if __name__ == '__main__':
    generate_dummy_excel()
