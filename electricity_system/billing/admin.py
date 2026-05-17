"""
billing/admin.py

Admin registrations for the eMeter billing system.
Custom User is registered via UserAdmin (inherits all Django user admin features).
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Consumer, MeterReading, Bill, AuditLog, BillingSettings, Payment


# ─────────────────────────────────────────────────────────────
# Custom User Admin
# ─────────────────────────────────────────────────────────────

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Extends Django's built-in UserAdmin to show and edit the `role` field.
    All default Django user fields (password, permissions, etc.) are preserved.
    """
    list_display  = ['username', 'email', 'role', 'is_active', 'is_staff', 'date_joined']
    list_filter   = ['role', 'is_active', 'is_staff']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering      = ['username']

    # Add `role` to the user detail fieldsets
    fieldsets = BaseUserAdmin.fieldsets + (
        ('eMeter Role', {'fields': ('role',)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('eMeter Role', {'fields': ('role',)}),
    )


# ─────────────────────────────────────────────────────────────
# Bill Admin (immutable after finalization)
# ─────────────────────────────────────────────────────────────

class AuditLogInline(admin.TabularInline):
    model         = AuditLog
    extra         = 0
    readonly_fields = ['user', 'action', 'timestamp', 'details', 'ip_address']
    can_delete    = False


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display  = ['bill_number', 'consumer', 'status', 'total_amount', 'is_locked', 'created_at']
    list_filter   = ['status', 'is_locked', 'billing_period']
    search_fields = ['bill_number', 'consumer__name', 'consumer__consumer_number']
    inlines       = [AuditLogInline]

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.is_locked:
            # All fields become read-only once the bill is finalized
            return [f.name for f in self.model._meta.fields]
        return ['bill_number', 'is_locked', 'locked_at', 'locked_by']

    def has_delete_permission(self, request, obj=None):
        # Prevent deletion of locked (finalized/paid) bills
        if obj and obj.is_locked:
            return False
        return super().has_delete_permission(request, obj)


# ─────────────────────────────────────────────────────────────
# Other model admins
# ─────────────────────────────────────────────────────────────

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display  = ['timestamp', 'user', 'action', 'bill']
    list_filter   = ['action', 'timestamp']
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False  # Audit logs must only be created programmatically

    def has_delete_permission(self, request, obj=None):
        return False  # Audit logs must never be deleted


@admin.register(Consumer)
class ConsumerAdmin(admin.ModelAdmin):
    list_display  = ['consumer_number', 'name', 'meter_number', 'connection_type', 'status']
    list_filter   = ['status', 'connection_type']
    search_fields = ['name', 'consumer_number', 'meter_number', 'department']


@admin.register(MeterReading)
class MeterReadingAdmin(admin.ModelAdmin):
    list_display  = ['consumer', 'reading_date', 'previous_reading', 'current_reading', 'units_consumed', 'created_by']
    list_filter   = ['reading_date']
    search_fields = ['consumer__name', 'consumer__consumer_number']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ['transaction_id', 'bill', 'amount', 'payment_method', 'status', 'payment_date']
    list_filter   = ['status', 'payment_method']


@admin.register(BillingSettings)
class BillingSettingsAdmin(admin.ModelAdmin):
    list_display  = ['rate_per_unit', 'fixed_charge_per_kw', 'duty_percentage', 'updated_at']

    def has_add_permission(self, request):
        # Enforce singleton — only 1 settings row allowed
        return not BillingSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
