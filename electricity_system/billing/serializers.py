from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Consumer, MeterReading, Bill, AuditLog

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class ConsumerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consumer
        fields = '__all__'

class MeterReadingSerializer(serializers.ModelSerializer):
    created_by_name = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = MeterReading
        fields = '__all__'

class BillSerializer(serializers.ModelSerializer):
    consumer_details = ConsumerSerializer(source='consumer', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Bill
        fields = '__all__'
        read_only_fields = [
            'bill_number', 'is_locked', 'locked_at', 'locked_by',
            'previous_reading_snapshot', 'current_reading_snapshot', 
            'units_consumed_snapshot', 'rate_per_unit_snapshot',
            'subtotal_snapshot', 'tax_snapshot', 'total_amount_snapshot',
            'consumer_name_snapshot', 'meter_number_snapshot', 'billing_date_snapshot'
        ]

    def validate(self, data):
        if self.instance and self.instance.is_locked:
            # Check if any sensitive fields are being modified
            restricted_fields = [
                'units', 'rate_per_unit', 'fixed_charges', 'energy_charges',
                'duty_charge', 'regulatory_surcharge', 'meter_rent', 
                'arrears', 'late_payment_surcharge', 'total_amount', 'billing_period'
            ]
            for field in restricted_fields:
                if field in data and data[field] != getattr(self.instance, field):
                    raise serializers.ValidationError(f"Field '{field}' cannot be modified once the bill is finalized/locked.")
            
            # Status can only be changed to 'paid' or 'cancelled' if finalized, 
            # and only if logic allows (e.g., from finalized to paid).
            if 'status' in data:
                new_status = data['status']
                if self.instance.status == 'paid' and new_status != 'paid':
                     raise serializers.ValidationError("Cannot change status of a paid bill.")
                if self.instance.status == 'cancelled':
                     raise serializers.ValidationError("Cannot change status of a cancelled bill.")

        return data

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'
