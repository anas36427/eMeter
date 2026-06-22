from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Consumer, MeterReading, Bill, AuditLog, Meter, ConsumerMeterAssignment

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class MeterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Meter
        fields = '__all__'

class ConsumerMeterAssignmentSerializer(serializers.ModelSerializer):
    meter_details = MeterSerializer(source='meter', read_only=True)
    class Meta:
        model = ConsumerMeterAssignment
        fields = '__all__'

class ConsumerSerializer(serializers.ModelSerializer):
    active_meters = serializers.SerializerMethodField()
    assignments = ConsumerMeterAssignmentSerializer(many=True, read_only=True)

    class Meta:
        model = Consumer
        fields = '__all__'

    def get_active_meters(self, obj):
        active_assignments = obj.assignments.filter(is_active=True)
        return MeterSerializer([a.meter for a in active_assignments], many=True).data

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
            'units_consumed_snapshot', 'rate_snapshot', 'total_amount_snapshot',
            'consumer_name_snapshot', 'meter_number_snapshot'
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'
