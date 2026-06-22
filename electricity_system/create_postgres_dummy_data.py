import os
import django
from datetime import date
from decimal import Decimal

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from django.contrib.auth import get_user_model
from billing.models import Consumer, Meter, ConsumerMeterAssignment, BillingSettings
from billing.services import BillingService

def seed_postgres_data():
    print("🚀 Seeding High-Quality PostgreSQL Dummy Data (8 Consumers)...")
    
    User = get_user_model()
    admin_user = User.objects.filter(role='admin').first()
    if not admin_user:
        print("❌ Error: Please create the admin user first by running python create_superuser.py")
        return

    # Ensure BillingSettings exists
    BillingSettings.get_settings()

    # Define 8 consumers with different criteria, loads, and dates
    consumers_config = [
        {
            'consumer_number': 'CON001',
            'name': 'Prof. Tariq Mansoor',
            'email': 'tmansoor@amu.ac.in',
            'phone': '9876543210',
            'address': 'Kela Nagar, Aligarh',
            'post': 'Aligarh',
            'department': 'Medicine',
            'meter_number': 'MTR001',
            'connection_type': 'single_phase',
            'load_kw': Decimal('3.00'),
            'meter_type': 'smart',
            'status': 'active',
            'readings': [
                {'date': date(2026, 3, 5), 'reading': 180.0},
                {'date': date(2026, 4, 6), 'reading': 390.0},
                {'date': date(2026, 5, 7), 'reading': 630.0},
            ]
        },
        {
            'consumer_number': 'CON002',
            'name': 'Sarah Khan',
            'email': 'sarah.physics@amu.ac.in',
            'phone': '9876543211',
            'address': 'Medical Road, Aligarh',
            'post': 'Aligarh',
            'department': 'Physics',
            'meter_number': 'MTR002',
            'connection_type': 'three_phase',
            'load_kw': Decimal('15.00'),
            'meter_type': 'digital',
            'status': 'active',
            'readings': [
                {'date': date(2026, 3, 5), 'reading': 700.0},
                {'date': date(2026, 4, 6), 'reading': 1550.0},
                {'date': date(2026, 5, 7), 'reading': 2500.0},
            ]
        },
        {
            'consumer_number': 'CON003',
            'name': 'Central Computer Centre',
            'email': 'ccc@amu.ac.in',
            'phone': '9876543212',
            'address': 'Main Campus, AMU, Aligarh',
            'post': 'Aligarh',
            'department': 'Computer Engineering',
            'meter_number': 'MTR003',
            'connection_type': 'single_phase',
            'load_kw': Decimal('5.00'),
            'meter_type': 'analog',
            'status': 'active',
            'readings': [
                {'date': date(2026, 3, 5), 'reading': 120.0},
                {'date': date(2026, 4, 6), 'reading': 280.0},
                {'date': date(2026, 5, 7), 'reading': 490.0},
            ]
        },
        {
            'consumer_number': 'CON004',
            'name': 'Dr. Amina Qazi',
            'email': 'amina.chemistry@amu.ac.in',
            'phone': '9876543213',
            'address': 'Zohra Bagh, Aligarh',
            'post': 'Aligarh',
            'department': 'Chemistry',
            'meter_number': 'MTR004',
            'connection_type': 'single_phase',
            'load_kw': Decimal('4.50'),
            'meter_type': 'digital',
            'status': 'active',
            'readings': [
                {'date': date(2026, 3, 5), 'reading': 140.0},
                {'date': date(2026, 4, 6), 'reading': 300.0},
                {'date': date(2026, 5, 7), 'reading': 480.0},
            ]
        },
        {
            'consumer_number': 'CON005',
            'name': 'Maulana Azad Library',
            'email': 'library@amu.ac.in',
            'phone': '9876543214',
            'address': 'University Road, Aligarh',
            'post': 'Aligarh',
            'department': 'Central Library',
            'meter_number': 'MTR005',
            'connection_type': 'three_phase',
            'load_kw': Decimal('25.00'),
            'meter_type': 'smart',
            'status': 'active',
            'readings': [
                {'date': date(2026, 3, 5), 'reading': 1200.0},
                {'date': date(2026, 4, 6), 'reading': 2600.0},
                {'date': date(2026, 5, 7), 'reading': 4200.0},
            ]
        },
        {
            'consumer_number': 'CON006',
            'name': 'Prof. M. A. Beg',
            'email': 'mabeg.maths@amu.ac.in',
            'phone': '9876543215',
            'address': 'Sir Syed Nagar, Aligarh',
            'post': 'Aligarh',
            'department': 'Mathematics',
            'meter_number': 'MTR006',
            'connection_type': 'single_phase',
            'load_kw': Decimal('2.00'),
            'meter_type': 'smart',
            'status': 'active',
            'readings': [
                {'date': date(2026, 3, 5), 'reading': 90.0},
                {'date': date(2026, 4, 6), 'reading': 210.0},
                {'date': date(2026, 5, 7), 'reading': 360.0},
            ]
        },
        {
            'consumer_number': 'CON007',
            'name': 'Registrar Office',
            'email': 'registrar@amu.ac.in',
            'phone': '9876543216',
            'address': 'Administrative Block, Aligarh',
            'post': 'Aligarh',
            'department': 'Administration',
            'meter_number': 'MTR007',
            'connection_type': 'three_phase',
            'load_kw': Decimal('12.00'),
            'meter_type': 'digital',
            'status': 'active',
            'readings': [
                {'date': date(2026, 3, 5), 'reading': 550.0},
                {'date': date(2026, 4, 6), 'reading': 1200.0},
                {'date': date(2026, 5, 7), 'reading': 2000.0},
            ]
        },
        {
            'consumer_number': 'CON008',
            'name': 'Power Station Lab',
            'email': 'powersub@amu.ac.in',
            'phone': '9876543217',
            'address': 'Engineering College Campus, Aligarh',
            'post': 'Aligarh',
            'department': 'Electrical Engineering',
            'meter_number': 'MTR008',
            'connection_type': 'single_phase',
            'load_kw': Decimal('7.50'),
            'meter_type': 'analog',
            'status': 'active',
            'readings': [
                {'date': date(2026, 3, 5), 'reading': 210.0},
                {'date': date(2026, 4, 6), 'reading': 460.0},
                {'date': date(2026, 5, 7), 'reading': 760.0},
            ]
        }
    ]

    for config in consumers_config:
        # 1. Create the Consumer (which automatically allocates the Meter and Assignment in save())
        consumer, created = Consumer.objects.get_or_create(
            consumer_number=config['consumer_number'],
            defaults={
                'name': config['name'],
                'email': config['email'],
                'phone': config['phone'],
                'address': config['address'],
                'post': config['post'],
                'department': config['department'],
                'meter_number': config['meter_number'],
                'connection_type': config['connection_type'],
                'load_kw': config['load_kw'],
                'meter_type': config['meter_type'],
                'status': config['status']
            }
        )
        
        status_str = "Created" if created else "Found existing"
        print(f"👤 {status_str} Consumer: {consumer.name} ({consumer.consumer_number})")

        # Get the resolved meter object
        meter = Meter.objects.get(meter_number=config['meter_number'])

        # 2. Chronologically generate readings and finalized bills
        for rd_config in config['readings']:
            try:
                # Generate the final issued bill chronologically
                bill = BillingService.generate_final_bill(
                    consumer=consumer,
                    current_reading=rd_config['reading'],
                    reading_date=rd_config['date'],
                    user=admin_user,
                    meter=meter,
                    created_source='admin_manual'
                )
                print(f"   ⚡ Bill Issued → Date: {rd_config['date'].strftime('%Y-%m-%d')} | Reading: {rd_config['reading']} | Units: {bill.units} | Total: ₹{bill.total_amount}")
            except Exception as e:
                print(f"   ⚠️ Skipping reading for {rd_config['date']}: {e}")

    print("\n🎉 High-quality testing data initialized successfully!")

if __name__ == '__main__':
    seed_postgres_data()
