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
# 1.5 Meter & ConsumerMeterAssignment Models
# ─────────────────────────────────────────────────────────────

class Meter(models.Model):
    """
    Dedicated Meter model to support multiple meters per consumer and
    historical reassignment.
    """
    meter_number      = models.CharField(max_length=50, unique=True)
    meter_type        = models.CharField(
        max_length=20,
        choices=[('10', 'Standard (10A)'), ('25', 'Enhanced (25A)')],
        default='10',
    )
    status            = models.CharField(
        max_length=20,
        choices=[('active', 'Active'), ('inactive', 'Inactive'), ('disconnected', 'Disconnected')],
        default='active',
    )
    installation_date = models.DateField(auto_now_add=True)
    deactivation_date = models.DateField(null=True, blank=True)
    is_active         = models.BooleanField(default=True)

    class Meta:
        verbose_name        = 'Meter'
        verbose_name_plural = 'Meters'

    def __str__(self):
        return f"Meter {self.meter_number} ({self.meter_type})"


class ConsumerMeterAssignment(models.Model):
    """
    Assignment mapping to link Consumers with Meters temporally.
    """
    class Reason(models.TextChoices):
        NEW_ALLOCATION    = 'new_allocation',    'New Allocation'
        QUARTER_SHIFT     = 'quarter_shift',     'Quarter Shift'
        TEMPORARY_OVERLAP = 'temporary_overlap', 'Temporary Overlap'
        METER_REPLACEMENT = 'meter_replacement', 'Meter Replacement'

    consumer          = models.ForeignKey('Consumer', on_delete=models.CASCADE, related_name='assignments')
    meter             = models.ForeignKey(Meter, on_delete=models.CASCADE, related_name='assignments')
    start_date        = models.DateField()
    end_date          = models.DateField(null=True, blank=True)
    is_active         = models.BooleanField(default=True)
    assignment_reason = models.CharField(
        max_length=50,
        choices=Reason.choices,
        default=Reason.NEW_ALLOCATION,
    )

    class Meta:
        verbose_name        = 'Consumer Meter Assignment'
        verbose_name_plural = 'Consumer Meter Assignments'

    def clean(self):
        from django.core.exceptions import ValidationError
        
        # Validation Rule 1: Overlapping active date ranges for the SAME meter are forbidden
        overlapping = ConsumerMeterAssignment.objects.filter(meter=self.meter).exclude(id=self.id)
        for assignment in overlapping:
            s1 = self.start_date
            e1 = self.end_date
            s2 = assignment.start_date
            e2 = assignment.end_date
            
            overlap = False
            if e1 is None and e2 is None:
                overlap = True
            elif e1 is None:
                if s1 <= e2:
                    overlap = True
            elif e2 is None:
                if s2 <= e1:
                    overlap = True
            else:
                if s1 <= e2 and s2 <= e1:
                    overlap = True
            
            if overlap:
                raise ValidationError(
                    f"Meter {self.meter.meter_number} already has an overlapping assignment to consumer {assignment.consumer.name} during this period."
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.consumer.name} ↔ {self.meter.meter_number} ({self.start_date} to {self.end_date or 'Present'})"


# ─────────────────────────────────────────────────────────────
# 2. Consumer
# ─────────────────────────────────────────────────────────────

class Consumer(models.Model):
    """Electricity customer registered in the system."""

    class ConnectionType(models.TextChoices):
        SINGLE_PHASE = 'single_phase', 'Single Phase'
        THREE_PHASE  = 'three_phase',  'Three Phase'

    class MeterType(models.TextChoices):
        ANALOG  = 'analog',  'Analog'
        DIGITAL = 'digital', 'Digital'
        SMART   = 'smart',   'Smart'

    class BillingType(models.TextChoices):
        SALARY     = 'salary',     'Salary'
        NON_SALARY = 'non_salary', 'Non-Salary'

    class Status(models.TextChoices):
        ACTIVE       = 'active',       'Active'
        INACTIVE     = 'inactive',     'Inactive'
        DISCONNECTED = 'disconnected', 'Disconnected'

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
    meter_number    = models.CharField(max_length=50, unique=True, null=True, blank=True)
    connection_type = models.CharField(
        max_length=20,
        choices=ConnectionType.choices,
        default=ConnectionType.SINGLE_PHASE,
    )
    billing_type = models.CharField(
        max_length=20,
        choices=BillingType.choices,
        default=BillingType.SALARY,
    )
    load_kw         = models.DecimalField(max_digits=10, decimal_places=2, default=1.00)
    meter_type      = models.CharField(
        max_length=20,
        choices=MeterType.choices,
        default=MeterType.ANALOG,
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
        constraints = [
            models.CheckConstraint(condition=models.Q(connection_type__in=['single_phase', 'three_phase']), name='chk_consumer_connection_type'),
            models.CheckConstraint(condition=models.Q(meter_type__in=['analog', 'digital', 'smart']), name='chk_consumer_meter_type'),
            models.CheckConstraint(condition=models.Q(status__in=['active', 'inactive', 'disconnected']), name='chk_consumer_status'),
            models.CheckConstraint(condition=models.Q(billing_type__in=['salary', 'non_salary']), name='chk_consumer_billing_type'),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.meter_number:
            from datetime import date
            from django.apps import apps
            Meter = apps.get_model('billing', 'Meter')
            ConsumerMeterAssignment = apps.get_model('billing', 'ConsumerMeterAssignment')
            meter_obj, _ = Meter.objects.get_or_create(
                meter_number=self.meter_number,
                defaults={'meter_type': self.meter_type}
            )
            if not ConsumerMeterAssignment.objects.filter(consumer=self, meter=meter_obj).exists():
                ConsumerMeterAssignment.objects.create(
                    consumer=self,
                    meter=meter_obj,
                    start_date=date(2020, 1, 1),
                    is_active=True,
                    assignment_reason='new_allocation'
                )

    def __str__(self):
        return f"{self.name} ({self.consumer_number})"


class CreatedSource(models.TextChoices):
    MOBILE_READER = 'mobile_reader', 'Mobile Reader'
    ADMIN_MANUAL  = 'admin_manual',  'Admin Manual'
    EXCEL_IMPORT  = 'excel_import',  'Excel Import'
    OFFLINE_SYNC  = 'offline_sync',  'Offline Sync'


# ─────────────────────────────────────────────────────────────
# 3. MeterReading
# ─────────────────────────────────────────────────────────────

class MeterReading(models.Model):
    """A single meter reading event submitted by a meter reader."""

    consumer         = models.ForeignKey(Consumer, on_delete=models.CASCADE, related_name='readings')
    meter            = models.ForeignKey(Meter, on_delete=models.CASCADE, related_name='readings', null=True, blank=True)
    previous_reading = models.FloatField(default=0)
    current_reading  = models.FloatField(default=0)
    units_consumed   = models.FloatField(default=0, blank=True)
    
    from django.utils import timezone
    reading_date     = models.DateField(default=timezone.now, null=True, blank=True)
    reading_time     = models.TimeField(default=timezone.now, null=True, blank=True)
    meter_image      = models.ImageField(upload_to='meter_images/', null=True, blank=True)
    remarks          = models.TextField(blank=True, default='')

    # Who submitted this reading
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='submitted_readings',
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    created_source         = models.CharField(
        max_length=20,
        choices=CreatedSource.choices,
        default=CreatedSource.MOBILE_READER,
        db_index=True
    )
    manual_override_reason = models.TextField(null=True, blank=True)

    class Meta:
        verbose_name        = 'Meter Reading'
        verbose_name_plural = 'Meter Readings'
        ordering            = ['-reading_date']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(current_reading__gte=models.F('previous_reading')),
                name='reading_current_gte_previous',
            ),
            models.CheckConstraint(
                condition=models.Q(units_consumed__gte=0),
                name='reading_units_gte_0',
            )
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        from datetime import date
        
        if not self.reading_date:
            self.reading_date = date.today()
            
        if not self.meter:
            # Fallback or backfill matching
            # Let's search assignments active at reading_date or any assignment
            active_at_date = ConsumerMeterAssignment.objects.filter(
                consumer=self.consumer,
                start_date__lte=self.reading_date
            ).filter(
                models.Q(end_date__gte=self.reading_date) | models.Q(end_date__isnull=True)
            )
            
            if active_at_date.exists():
                self.meter = active_at_date.first().meter
            else:
                active_assignments = ConsumerMeterAssignment.objects.filter(
                    consumer=self.consumer,
                    is_active=True
                )
                if active_assignments.exists():
                    self.meter = active_assignments.first().meter
                else:
                    # Let's check if the consumer has consumer.meter_number set
                    if self.consumer.meter_number:
                        meter_obj, _ = Meter.objects.get_or_create(
                            meter_number=self.consumer.meter_number,
                            defaults={'meter_type': self.consumer.meter_type}
                        )
                        assignment_obj, _ = ConsumerMeterAssignment.objects.get_or_create(
                            consumer=self.consumer,
                            meter=meter_obj,
                            defaults={'start_date': date(2020, 1, 1)}
                        )
                        self.meter = meter_obj
                    else:
                        raise ValidationError("No active meter assignment found for this consumer on the reading date.")

        # 1. verify assignment exists and is active during reading_date
        assignment_exists = ConsumerMeterAssignment.objects.filter(
            consumer=self.consumer,
            meter=self.meter,
            start_date__lte=self.reading_date
        ).filter(
            models.Q(end_date__gte=self.reading_date) | models.Q(end_date__isnull=True)
        ).exists()

        if not assignment_exists:
            raise ValidationError(
                f"Meter {self.meter.meter_number} was not assigned to consumer {self.consumer.name} on {self.reading_date}."
            )

        # 2. verify reading chronology PER METER
        later_reading_exists = MeterReading.objects.filter(
            meter=self.meter,
            reading_date__gt=self.reading_date
        ).exclude(id=self.id).exists()

        if later_reading_exists:
            raise ValidationError(
                f"Chronological error: A reading on a later date already exists for Meter {self.meter.meter_number}."
            )

        # 3. Fetch previous reading chronologically per meter to establish previous_reading
        prev_reading_obj = MeterReading.objects.filter(
            meter=self.meter,
            reading_date__lt=self.reading_date
        ).exclude(id=self.id).order_by('-reading_date').first()
        
        if prev_reading_obj:
            self.previous_reading = prev_reading_obj.current_reading
        else:
            self.previous_reading = 0.0

        if self.current_reading < self.previous_reading:
            raise ValidationError(
                f"Current reading ({self.current_reading}) cannot be less than previous reading ({self.previous_reading}) for Meter {self.meter.meter_number}."
            )

        # 4. verify duplicate billing-cycle protection PER METER
        start_of_month = self.reading_date.replace(day=1)
        import calendar
        last_day = calendar.monthrange(self.reading_date.year, self.reading_date.month)[1]
        end_of_month = self.reading_date.replace(day=last_day)
        
        duplicate_exists = MeterReading.objects.filter(
            meter=self.meter,
            reading_date__range=(start_of_month, end_of_month)
        ).exclude(id=self.id).exists()

        if duplicate_exists:
            raise ValidationError(
                f"Duplicate billing-cycle error: A reading for Meter {self.meter.meter_number} already exists in this calendar month."
            )

    def save(self, *args, **kwargs):
        self.clean()
        # Auto-calculate units consumed before saving
        self.units_consumed = max(0.0, self.current_reading - self.previous_reading)
        super().save(*args, **kwargs)

    def __str__(self):
        meter_num = self.meter.meter_number if self.meter else 'No Meter'
        return f"{self.consumer.consumer_number} (Meter: {meter_num}) — {self.reading_date} ({self.units_consumed} units)"


# ─────────────────────────────────────────────────────────────
# 4. Bill  (Immutable Financial Record)
# ─────────────────────────────────────────────────────────────

class Bill(models.Model):
    """
    Financial bill for a consumer.

    Lifecycle:  DRAFT → ISSUED → PAID
                      └──────────→ CANCELLED
                      └──────────→ OVERDUE

    Once status = 'issued', the bill is LOCKED.
    """

    class Status(models.TextChoices):
        DRAFT      = 'draft',      'Draft'
        ISSUED     = 'issued',     'Issued'
        PAID       = 'paid',       'Paid'
        OVERDUE    = 'overdue',    'Overdue'
        CANCELLED  = 'cancelled',  'Cancelled'

    # ── Core relations ─────────────────────────────────────
    consumer      = models.ForeignKey(Consumer,     on_delete=models.CASCADE,    related_name='bills')
    meter         = models.ForeignKey(Meter,        on_delete=models.SET_NULL,   null=True, blank=True, related_name='bills')
    meter_reading = models.ForeignKey(MeterReading, on_delete=models.SET_NULL,   null=True, blank=True)
    bill_number   = models.CharField(max_length=50, unique=True, blank=True)

    # ── Live financial fields ──────────────────────────────
    units                  = models.FloatField(default=0)
    rate_per_unit          = models.FloatField(default=0)
    fixed_charges          = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    energy_charges         = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    duty_charge            = models.FloatField(default=0)
    regulatory_surcharge   = models.FloatField(default=0)
    meter_rent             = models.FloatField(default=0)
    arrears                = models.FloatField(default=0)
    late_payment_surcharge = models.FloatField(default=0)
    total_amount           = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    paid_amount            = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

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
    created_source = models.CharField(
        max_length=20,
        choices=CreatedSource.choices,
        default=CreatedSource.MOBILE_READER,
        db_index=True
    )
    manual_override_reason = models.TextField(null=True, blank=True)

    # ── Immutable snapshots ────────────────────────────────
    units_consumed_snapshot    = models.FloatField(null=True, blank=True)
    rate_snapshot              = models.FloatField(null=True, blank=True)
    total_amount_snapshot      = models.FloatField(null=True, blank=True)
    consumer_name_snapshot     = models.CharField(max_length=255, null=True, blank=True)
    meter_number_snapshot      = models.CharField(max_length=100, null=True, blank=True)

    # ── Dates ──────────────────────────────────────────────
    bill_date            = models.DateField(auto_now_add=True)
    billing_period_start = models.DateField(null=True, blank=True)
    billing_period_end   = models.DateField(null=True, blank=True)
    due_date             = models.DateField(null=True, blank=True)
    payment_date         = models.DateField(null=True, blank=True)
    transaction_id       = models.CharField(max_length=50, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at           = models.DateTimeField(auto_now=True,     null=True, blank=True)

    class Meta:
        verbose_name        = 'Bill'
        verbose_name_plural = 'Bills'
        ordering            = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=['draft', 'issued', 'paid', 'overdue', 'cancelled']),
                name='chk_bill_status'
            )
        ]

    def save(self, *args, **kwargs):
        from django.core.exceptions import ValidationError
        if self.pk:
            original = Bill.objects.get(pk=self.pk)
            if original.is_locked and original.status == 'issued':
                protected_fields = [
                    'units', 'rate_per_unit', 'fixed_charges', 'energy_charges',
                    'duty_charge', 'regulatory_surcharge', 'meter_rent', 'arrears',
                    'late_payment_surcharge', 'total_amount', 'units_consumed_snapshot',
                    'rate_snapshot', 'total_amount_snapshot', 'consumer_name_snapshot',
                    'meter_number_snapshot', 'billing_period_start', 'billing_period_end'
                ]
                for field in protected_fields:
                    if getattr(self, field) != getattr(original, field):
                        raise ValidationError(f"Cannot modify immutable field '{field}' on locked bill.")

        if not self.bill_number:
            # Try generating a unique bill number with collision detection.
            for _ in range(10):
                candidate = 'BILL' + ''.join(random.choices(string.digits, k=8))
                if not Bill.objects.filter(bill_number=candidate).exists():
                    self.bill_number = candidate
                    break
            else:
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


class AdminNotification(models.Model):
    NOTIFICATION_TYPES = [
        ('info', 'Info'),
        ('success', 'Success'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications'
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='info')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        user_str = f" to {self.user.username}" if self.user else ""
        return f"{self.title}{user_str} ({self.notification_type}) - {'Read' if self.is_read else 'Unread'}"

