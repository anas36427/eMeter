from django.db import models
from django.contrib.auth.models import User


class Consumer(models.Model):
    """Consumer model representing electricity customers"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, null=True, blank=True)
    consumer_number = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100, default='')
    email = models.EmailField(unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, default='')
    address = models.TextField(default='')
    meter_number = models.CharField(max_length=50, unique=True)
    connection_type = models.CharField(max_length=20, choices=[
        ('residential', 'Residential'),
        ('commercial', 'Commercial'),
        ('industrial', 'Industrial')
    ], default='residential')
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
    rate_per_unit = models.FloatField(default=7.50)
    fixed_charges = models.FloatField(default=125.00)
    energy_charges = models.FloatField(blank=True, default=0)
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
        self.energy_charges = self.units * self.rate_per_unit
        self.total_amount = self.energy_charges + self.fixed_charges
        
        # Auto-generate bill_number if not provided
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
