from django.db import models
from django.contrib.auth.models import User
from django.db import models, OperationalError

class Message(models.Model):
    text = models.CharField(max_length=200)


class Consumer(models.Model):
    """Consumer model representing electricity customers"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    consumer_number = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100, default='')
    email = models.EmailField(unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, default='')
    address = models.TextField(default='')
    post = models.CharField(max_length=100, default='', blank=True)
    department = models.CharField(max_length=100, default='', blank=True)
    meter_number = models.CharField(max_length=50, unique=True)
    connection_type = models.CharField(max_length=20, choices=[
        ('residential', 'Residential'),
        ('commercial', 'Commercial'),
        ('industrial', 'Industrial')
    ], default='residential')
    LOAD_CHOICES = [
        (1.0, '1 KW'),
        (2.0, '2 KW'),
        (3.0, '3 KW'),
        (4.0, '4 KW'),
        (5.0, '5 KW'),
    ]
    load_kw = models.FloatField(choices=LOAD_CHOICES, default=1.0)
    meter_type = models.CharField(max_length=20, choices=[
        ('10', 'Standard (10)'),
        ('25', 'Enhanced (25)')
    ], default='10')
    status = models.CharField(max_length=20, choices=[
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('disconnected', 'Disconnected')
    ], default='active')
    created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.consumer_number})"


class MeterReading(models.Model):
    """Meter reading records for consumers"""
    consumer = models.ForeignKey(Consumer, on_delete=models.CASCADE, related_name='readings')
    previous_reading = models.FloatField(default=0)
    current_reading = models.FloatField(default=0)
    units_consumed = models.FloatField(blank=True, default=0)
    reading_date = models.DateField(null=True, blank=True)
    reading_time = models.TimeField(null=True, blank=True)
    meter_image = models.ImageField(upload_to='meter_images/', null=True, blank=True)
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        self.units_consumed = self.current_reading - self.previous_reading
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.consumer.consumer_number} - {self.reading_date}"


class Bill(models.Model):
    """Bill model for consumer invoices"""
    consumer = models.ForeignKey(Consumer, on_delete=models.CASCADE, related_name='bills')
    meter_reading = models.ForeignKey(MeterReading, on_delete=models.CASCADE, null=True, blank=True)
    bill_number = models.CharField(max_length=20, unique=True, blank=True)
    units = models.FloatField(default=0)
    rate_per_unit = models.FloatField(default=8.56)
    fixed_charges = models.FloatField(default=0)
    energy_charges = models.FloatField(blank=True, default=0)
    duty_charge = models.FloatField(default=0)
    regulatory_surcharge = models.FloatField(default=0)
    meter_rent = models.FloatField(default=0)
    arrears = models.FloatField(default=0)
    late_payment_surcharge = models.FloatField(default=0)
    total_amount = models.FloatField(blank=True, default=0)
    status = models.CharField(max_length=20, choices=[
        ('unpaid', 'Unpaid'),
        ('paid', 'Paid'),
        ('pending', 'Pending'),
        ('overdue', 'Overdue')
    ], default='unpaid')
    billing_period = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    paid_date = models.DateField(null=True, blank=True)
    transaction_id = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        # Fetch current system settings with Safe Mode fallback
        try:
            settings = BillingSettings.get_settings()
        except:
            # Fallback mock settings
            class MockSettings:
                rate_per_unit = 8.56
                fixed_charge_per_kw = 400.0
                phase_1_rent = 10.0
                phase_3_rent = 25.0
                duty_percentage = 7.5
            settings = MockSettings()
        
        self.rate_per_unit = getattr(settings, 'rate_per_unit', 8.56)
        self.energy_charges = round(self.units * self.rate_per_unit, 2)
        
        # Calculate fixed charges based on load
        load = getattr(self.consumer, 'load_kw', 1.0)
        fixed_rate = getattr(settings, 'fixed_charge_per_kw', 400.0)
        self.fixed_charges = load * fixed_rate
            
        # Calculate duty charge (X% of Energy + Fixed)
        duty_pct = getattr(settings, 'duty_percentage', 7.5)
        self.duty_charge = round((self.energy_charges + self.fixed_charges) * (duty_pct / 100), 2)
        
        # Determine meter rent based on meter_type (phase)
        m_type = getattr(self.consumer, 'meter_type', '10')
        p1_rent = getattr(settings, 'phase_1_rent', 10.0)
        p3_rent = getattr(settings, 'phase_3_rent', 25.0)
        self.meter_rent = p1_rent if m_type == '10' else p3_rent
            
        # Late Payment Surcharge (1.5% of arrears)
        if hasattr(self, 'arrears') and self.arrears > 0:
            self.late_payment_surcharge = round(self.arrears * 0.015, 2)
            
        self.total_amount = round(
            self.energy_charges + 
            self.fixed_charges + 
            self.duty_charge + 
            getattr(self, 'regulatory_surcharge', 0) + 
            self.meter_rent + 
            getattr(self, 'arrears', 0) + 
            getattr(self, 'late_payment_surcharge', 0),
            0
        )
        
        if not self.bill_number:
            import random
            import string
            self.bill_number = 'BILL' + ''.join(random.choices(string.digits, k=8))
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Bill #{self.id} - {self.consumer.consumer_number}"


class Payment(models.Model):
    """Payment records for bills"""
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='payments')
    transaction_id = models.CharField(max_length=50, unique=True)
    amount = models.FloatField()
    payment_method = models.CharField(max_length=50, choices=[
        ('credit_card', 'Credit Card'),
        ('debit_card', 'Debit Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('cash', 'Cash'),
        ('online', 'Online Payment')
    ])
    payment_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=[
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('pending', 'Pending')
    ], default='success')

    def __str__(self):
        return f"Payment {self.transaction_id} - {self.bill.consumer.name}"


class UserProfile(models.Model):
    """Extended user profile for different roles"""
    USER_ROLES = [
        ('admin', 'Administrator'),
        ('meter_reader', 'Meter Reader'),
        ('consumer', 'Consumer')
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=USER_ROLES, default='consumer')
    assigned_area = models.CharField(max_length=100, blank=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.role}"


class BillingSettings(models.Model):
    """Global settings for billing rates"""
    rate_per_unit = models.FloatField(default=8.56)
    fixed_charge_per_kw = models.FloatField(default=400.0)
    phase_1_rent = models.FloatField(default=10.0)
    phase_3_rent = models.FloatField(default=25.0)
    duty_percentage = models.FloatField(default=7.5)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Billing Settings"

    def __str__(self):
        return f"Settings updated at {self.updated_at}"

    @classmethod
    def get_settings(cls):
        try:
            settings, created = cls.objects.get_or_create(id=1)
            return settings
        except Exception as e:
            # Fallback Mock if table doesn't exist or DB error
            print(f"ERROR: Failed to fetch BillingSettings: {str(e)}")
            class MockSettings:
                rate_per_unit = 8.56
                fixed_charge_per_kw = 400.0
                phase_1_rent = 10.0
                phase_3_rent = 25.0
                duty_percentage = 7.5
                updated_at = None
                def save(self, *args, **kwargs):
                    print("WARNING: Attempted to save MockSettings. This change will NOT be persisted.")
                    pass
            return MockSettings()

