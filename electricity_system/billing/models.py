"""
billing/models.py

Custom User model using AbstractUser — inherits all default Django fields
(username, password, email, first_name, last_name, is_staff, etc.)
and adds a `role` field to distinguish system actors.

Two roles are supported:
  - ADMIN        → can finalize bills, manage consumers, view reports
  - METER_READER → can submit readings only (mobile app)
"""

from django.db import models, OperationalError
from django.contrib.auth.models import AbstractUser
from django.conf import settings
import random
import string


# ─────────────────────────────────────────────────────────────
# 1. Custom User (replaces django.contrib.auth.models.User)
# ─────────────────────────────────────────────────────────────

class User(AbstractUser):
    """
    Custom user model extending Django's AbstractUser.
    Do NOT import django.contrib.auth.models.User anywhere —
    always use: from django.conf import settings; settings.AUTH_USER_MODEL
    or: from django.contrib.auth import get_user_model
    """

    class Role(models.TextChoices):
        ADMIN        = 'admin',        'Administrator'
        METER_READER = 'meter_reader', 'Meter Reader'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.METER_READER,
        db_index=True,
    )

    # Keep AbstractUser fields intact — no overrides needed.
    # username, password, email, first_name, last_name, is_active,
    # is_staff, is_superuser, date_joined, last_login all inherited.

    class Meta:
        verbose_name        = 'User'
        verbose_name_plural = 'Users'
        ordering            = ['username']

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_meter_reader(self):
        return self.role == self.Role.METER_READER


# ─────────────────────────────────────────────────────────────
# 2. Consumer
# ─────────────────────────────────────────────────────────────

class Consumer(models.Model):
    """Electricity customer registered in the system."""

    class ConnectionType(models.TextChoices):
        SALARY     = 'salary',     'Salary'
        NON_SALARY = 'non-salary', 'Non-Salary'

    class MeterType(models.TextChoices):
        STANDARD = '10', 'Standard (10A)'
        ENHANCED = '25', 'Enhanced (25A)'

    class Status(models.TextChoices):
        ACTIVE       = 'active',       'Active'
        INACTIVE     = 'inactive',     'Inactive'
        DISCONNECTED = 'disconnected', 'Disconnected'

    LOAD_CHOICES = [
        (1.0, '1 KW'),
        (2.0, '2 KW'),
        (3.0, '3 KW'),
        (4.0, '4 KW'),
        (5.0, '5 KW'),
    ]

    # Optional link to a system User account
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='consumer_profile',
    )

    consumer_number = models.CharField(max_length=20, unique=True)
    name            = models.CharField(max_length=100)
    email           = models.EmailField(unique=True, null=True, blank=True)
    phone           = models.CharField(max_length=20, blank=True, default='')
    address         = models.TextField(blank=True, default='')
    post            = models.CharField(max_length=100, blank=True, default='')
    department      = models.CharField(max_length=100, blank=True, default='')
    meter_number    = models.CharField(max_length=50, unique=True)
    connection_type = models.CharField(
        max_length=20,
        choices=ConnectionType.choices,
        default=ConnectionType.SALARY,
    )
    load_kw         = models.FloatField(choices=LOAD_CHOICES, default=1.0)
    meter_type      = models.CharField(
        max_length=20,
        choices=MeterType.choices,
        default=MeterType.STANDARD,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True,     null=True, blank=True)

    class Meta:
        verbose_name        = 'Consumer'
        verbose_name_plural = 'Consumers'
        ordering            = ['consumer_number']

    def __str__(self):
        return f"{self.name} ({self.consumer_number})"


# ─────────────────────────────────────────────────────────────
# 3. MeterReading
# ─────────────────────────────────────────────────────────────

class MeterReading(models.Model):
    """A single meter reading event submitted by a meter reader."""

    consumer         = models.ForeignKey(Consumer, on_delete=models.CASCADE, related_name='readings')
    previous_reading = models.FloatField(default=0)
    current_reading  = models.FloatField(default=0)
    units_consumed   = models.FloatField(default=0, blank=True)
    reading_date     = models.DateField(null=True, blank=True)
    reading_time     = models.TimeField(null=True, blank=True)
    meter_image      = models.ImageField(upload_to='meter_images/', null=True, blank=True)
    remarks          = models.TextField(blank=True)

    # Who submitted this reading
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='submitted_readings',
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        verbose_name        = 'Meter Reading'
        verbose_name_plural = 'Meter Readings'
        ordering            = ['-reading_date']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(current_reading__gte=models.F('previous_reading')),
                name='reading_current_gte_previous',
            )
        ]

    def save(self, *args, **kwargs):
        # Auto-calculate units consumed before saving
        self.units_consumed = max(0.0, self.current_reading - self.previous_reading)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.consumer.consumer_number} — {self.reading_date} ({self.units_consumed} units)"


# ─────────────────────────────────────────────────────────────
# 4. Bill  (Immutable Financial Record)
# ─────────────────────────────────────────────────────────────

class Bill(models.Model):
    """
    Financial bill for a consumer.

    Lifecycle:  DRAFT → FINALIZED → PAID
                      └──────────→ CANCELLED

    Once status = 'finalized', the bill is LOCKED.
    All snapshot_* fields are frozen at finalization time and must
    never be recalculated from live data afterwards.
    """

    class Status(models.TextChoices):
        DRAFT      = 'draft',      'Draft'
        FINALIZED  = 'finalized',  'Finalized'
        PAID       = 'paid',       'Paid'
        CANCELLED  = 'cancelled',  'Cancelled'

    # ── Core relations ─────────────────────────────────────
    consumer      = models.ForeignKey(Consumer,     on_delete=models.CASCADE,    related_name='bills')
    meter_reading = models.ForeignKey(MeterReading, on_delete=models.SET_NULL,   null=True, blank=True)
    bill_number   = models.CharField(max_length=20, unique=True, blank=True)

    # ── Live financial fields (editable in DRAFT only) ─────
    units                  = models.FloatField(default=0)
    rate_per_unit          = models.FloatField(default=0)
    fixed_charges          = models.FloatField(default=0)
    energy_charges         = models.FloatField(default=0)
    duty_charge            = models.FloatField(default=0)
    regulatory_surcharge   = models.FloatField(default=0)
    meter_rent             = models.FloatField(default=0)
    arrears                = models.FloatField(default=0)
    late_payment_surcharge = models.FloatField(default=0)
    total_amount           = models.FloatField(default=0)

    # ── Workflow state ─────────────────────────────────────
    status    = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    is_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='locked_bills',
    )

    # ── Immutable snapshots (written ONCE at finalization) ─
    previous_reading_snapshot  = models.FloatField(null=True, blank=True)
    current_reading_snapshot   = models.FloatField(null=True, blank=True)
    units_consumed_snapshot    = models.FloatField(null=True, blank=True)
    rate_per_unit_snapshot     = models.FloatField(null=True, blank=True)
    subtotal_snapshot          = models.FloatField(null=True, blank=True)   # energy + fixed
    tax_snapshot               = models.FloatField(null=True, blank=True)   # duty + regulatory
    total_amount_snapshot      = models.FloatField(null=True, blank=True)
    consumer_name_snapshot     = models.CharField(max_length=255, null=True, blank=True)
    consumer_number_snapshot   = models.CharField(max_length=50,  null=True, blank=True)  # BUG-39 FIX: was missing, causing AttributeError in api_get_bill_pdf
    meter_number_snapshot      = models.CharField(max_length=100, null=True, blank=True)
    billing_date_snapshot      = models.DateField(null=True, blank=True)

    # ── Dates ──────────────────────────────────────────────
    billing_period = models.DateField(null=True, blank=True)
    due_date       = models.DateField(null=True, blank=True)
    paid_date      = models.DateField(null=True, blank=True)
    transaction_id = models.CharField(max_length=50, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at     = models.DateTimeField(auto_now=True,     null=True, blank=True)

    class Meta:
        verbose_name        = 'Bill'
        verbose_name_plural = 'Bills'
        ordering            = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.bill_number:
            # BUG-08 FIX: Try generating a unique bill number with collision detection.
            # 8 digits gives 100M combinations, but we retry up to 10 times to prevent IntegrityError crash.
            for _ in range(10):
                candidate = 'BILL' + ''.join(random.choices(string.digits, k=8))
                if not Bill.objects.filter(bill_number=candidate).exists():
                    self.bill_number = candidate
                    break
            else:
                # If we miraculously collide 10 times, try a longer one as absolute fallback
                self.bill_number = 'BILL' + ''.join(random.choices(string.digits, k=12))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.bill_number} — {self.consumer.name} [{self.status.upper()}]"


# ─────────────────────────────────────────────────────────────
# 5. AuditLog
# ─────────────────────────────────────────────────────────────

class AuditLog(models.Model):
    """Immutable audit trail for every significant financial action."""

    class Action(models.TextChoices):
        READING_SUBMIT  = 'reading_submit', 'Reading Submitted'
        BILL_CALCULATE  = 'bill_calculate', 'Bill Calculated'
        BILL_FINALIZE   = 'bill_finalize',  'Bill Finalized'
        PAYMENT_UPDATE  = 'payment_update', 'Payment Updated'
        FAILED_MOD      = 'failed_mod',     'Failed Modification Attempt'
        PDF_GENERATED   = 'pdf_gen',        'PDF Generated'

    user       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action     = models.CharField(max_length=50, choices=Action.choices, db_index=True)
    bill       = models.ForeignKey(Bill, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    timestamp  = models.DateTimeField(auto_now_add=True, db_index=True)
    details    = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        verbose_name        = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering            = ['-timestamp']

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.user} → {self.action}"


# ─────────────────────────────────────────────────────────────
# 6. Payment
# ─────────────────────────────────────────────────────────────

class Payment(models.Model):
    """Payment record linked to a finalized bill."""

    class Method(models.TextChoices):
        CREDIT_CARD    = 'credit_card',    'Credit Card'
        DEBIT_CARD     = 'debit_card',     'Debit Card'
        BANK_TRANSFER  = 'bank_transfer',  'Bank Transfer'
        CASH           = 'cash',           'Cash'
        ONLINE         = 'online',         'Online Payment'

    class PaymentStatus(models.TextChoices):
        SUCCESS = 'success', 'Success'
        FAILED  = 'failed',  'Failed'
        PENDING = 'pending', 'Pending'

    bill           = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='payments')
    transaction_id = models.CharField(max_length=50, unique=True)
    amount         = models.FloatField()
    payment_method = models.CharField(max_length=50, choices=Method.choices)
    payment_date   = models.DateTimeField(auto_now_add=True)
    status         = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.SUCCESS)

    class Meta:
        verbose_name        = 'Payment'
        verbose_name_plural = 'Payments'
        ordering            = ['-payment_date']

    def __str__(self):
        return f"Payment {self.transaction_id} — {self.bill.consumer.name}"


# ─────────────────────────────────────────────────────────────
# 7. BillingSettings
# ─────────────────────────────────────────────────────────────

class BillingSettings(models.Model):
    """
    Singleton table holding global tariff rates.
    Always access via BillingSettings.get_settings() — never .objects.all().
    """

    rate_per_unit      = models.FloatField(default=8.56)
    fixed_charge_per_kw = models.FloatField(default=400.0)
    phase_1_rent       = models.FloatField(default=10.0)
    phase_3_rent       = models.FloatField(default=25.0)
    duty_percentage    = models.FloatField(default=7.5)
    updated_at         = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Billing Settings'
        verbose_name_plural = 'Billing Settings'

    def __str__(self):
        updated_str = self.updated_at.strftime('%Y-%m-%d') if self.updated_at else 'never'
        return f"Billing Settings (updated {updated_str})"

    @classmethod
    def get_settings(cls):
        """Always returns a valid settings object, even if DB is unavailable."""
        try:
            instance, _ = cls.objects.get_or_create(id=1)
            return instance
        except Exception as exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"BillingSettings unavailable — using defaults. ({exc})", exc_info=True)

            class _Defaults:
                rate_per_unit       = 8.56
                fixed_charge_per_kw = 400.0
                phase_1_rent        = 10.0
                phase_3_rent        = 25.0
                duty_percentage     = 7.5
                updated_at          = None
                def save(self, *args, **kwargs):
                    pass  # no-op fallback

            return _Defaults()
