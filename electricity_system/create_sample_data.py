"""Script to create sample data for testing"""
import os
import django
import random
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.contrib.auth import get_user_model
from billing.models import Consumer, MeterReading, Bill, Payment, UserProfile

User = get_user_model()

def create_sample_data():
    print("Creating sample data...")
    
    # Get or create admin user
    admin_user = User.objects.get(username='admin')
    
    # Create sample consumers
    consumers_data = [
        {'name': 'John Smith', 'email': 'john@example.com', 'meter_number': 'MTR001', 'consumer_number': 'CON001', 'address': '123 Main Street, Aligarh'},
        {'name': 'Sarah Johnson', 'email': 'sarah@example.com', 'meter_number': 'MTR002', 'consumer_number': 'CON002', 'address': '456 Oak Avenue, Aligarh'},
        {'name': 'Mike Davis', 'email': 'mike@example.com', 'meter_number': 'MTR003', 'consumer_number': 'CON003', 'address': '789 Pine Road, Aligarh'},
        {'name': 'Emily Brown', 'email': 'emily@example.com', 'meter_number': 'MTR004', 'consumer_number': 'CON004', 'address': '321 Elm Street, Aligarh'},
        {'name': 'Ahmed Hassan', 'email': 'ahmed@example.com', 'meter_number': 'MTR005', 'consumer_number': 'CON005', 'address': '654 University Road, Aligarh'},
    ]
    
    consumers = []
    for data in consumers_data:
        consumer, created = Consumer.objects.get_or_create(
            consumer_number=data['consumer_number'],
            defaults={
                'name': data['name'],
                'email': data['email'],
                'meter_number': data['meter_number'],
                'address': data['address'],
                'status': 'active',
                'connection_type': 'residential',
                'created_at': datetime.now()
            }
        )
        consumers.append(consumer)
        if created:
            print(f"  Created consumer: {consumer.name}")
    
    # Create meter readings for each consumer
    for consumer in consumers:
        # Create readings for last 3 months
        for i in range(3):
            reading_date = datetime.now() - timedelta(days=30 * (i + 1))
            previous_reading = random.randint(100, 500)
            current_reading = previous_reading + random.randint(50, 200)
            
            reading, created = MeterReading.objects.get_or_create(
                consumer=consumer,
                reading_date=reading_date.date(),
                defaults={
                    'previous_reading': previous_reading,
                    'current_reading': current_reading,
                    'units_consumed': current_reading - previous_reading,
                    'created_by': admin_user,
                    'created_at': datetime.now()
                }
            )
            if created:
                print(f"  Created reading for {consumer.name}: {reading.units_consumed} units")
    
    # Create bills for each consumer
    for consumer in consumers:
        readings = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date')[:1]
        
        for reading in readings:
            billing_period = reading.reading_date
            due_date = billing_period + timedelta(days=15)
            
            # Randomly set some bills as paid, some as unpaid
            status = random.choice(['paid', 'unpaid', 'unpaid', 'unpaid'])
            
            bill, created = Bill.objects.get_or_create(
                consumer=consumer,
                meter_reading=reading,
                defaults={
                    'units': reading.units_consumed,
                    'rate_per_unit': 7.50,
                    'fixed_charges': 125.00,
                    'billing_period': billing_period,
                    'due_date': due_date,
                    'status': status,
                    'created_at': datetime.now()
                }
            )
            
            if created:
                print(f"  Created bill for {consumer.name}: ₹{bill.total_amount}")
                
                # If bill is paid, create payment
                if status == 'paid':
                    paid_date = billing_period + timedelta(days=random.randint(1, 10))
                    Payment.objects.create(
                        bill=bill,
                        transaction_id='TXN' + ''.join(random.choices('0123456789', k=10)),
                        amount=bill.total_amount,
                        payment_method=random.choice(['credit_card', 'debit_card', 'online']),
                        status='success'
                    )
                    bill.paid_date = paid_date.date()
                    bill.save()
                    print(f"    Created payment for bill")
    
    print("\n Sample data created successfully!")
    print(f"   - {Consumer.objects.count()} consumers")
    print(f"   - {MeterReading.objects.count()} meter readings")
    print(f"   - {Bill.objects.count()} bills")
    print(f"   - {Payment.objects.count()} payments")

if __name__ == '__main__':
    create_sample_data()

