import io
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from .models import Consumer, MeterReading, Bill, BillingSettings, AuditLog
from datetime import datetime


class BillingService:
    @staticmethod
    def validate_reading(consumer, reading_date, current_reading):
        """Strict validation for meter readings"""
        if current_reading < 0:
            raise ValidationError("Reading cannot be negative.")

        last_reading = MeterReading.objects.filter(consumer=consumer).order_by('-reading_date', '-id').first()
        previous_reading = last_reading.current_reading if last_reading else 0

        if current_reading < previous_reading:
            raise ValidationError(f"Current reading ({current_reading}) cannot be less than previous reading ({previous_reading}).")

        # Check for duplicate reading in same billing month
        if isinstance(reading_date, str):
            date_obj = datetime.strptime(reading_date, '%Y-%m-%d').date()
        else:
            date_obj = reading_date

        if MeterReading.objects.filter(
            consumer=consumer, 
            reading_date__year=date_obj.year, 
            reading_date__month=date_obj.month
        ).exists():
            raise ValidationError(f"A reading for {date_obj.strftime('%B %Y')} already exists for this consumer.")

        return previous_reading

    @staticmethod
    @transaction.atomic
    def calculate_bill(bill_id):
        """
        Calculate bill using tiered tariff logic.
        0–100: ₹5, 101–300: ₹7, >300: ₹10
        """
        bill = Bill.objects.select_for_update().get(id=bill_id)
        if bill.is_locked:
            raise ValidationError("Cannot recalculate a locked bill.")

        settings = BillingSettings.get_settings()
        units = bill.units
        
        # Tiered calculation logic
        energy_charges = 0
        if units <= 100:
            energy_charges = units * 5
        elif units <= 300:
            energy_charges = (100 * 5) + ((units - 100) * 7)
        else:
            energy_charges = (100 * 5) + (200 * 7) + ((units - 300) * 10)

        # Other charges
        load = float(getattr(bill.consumer, 'load_kw', 1.0))
        fixed_rate = float(getattr(settings, 'fixed_charge_per_kw', 400.0))
        bill.fixed_charges = load * fixed_rate
        bill.energy_charges = energy_charges
        
        duty_pct = float(getattr(settings, 'duty_percentage', 7.5))
        bill.duty_charge = round((bill.energy_charges + bill.fixed_charges) * (duty_pct / 100), 2)
        
        m_type = getattr(bill.consumer, 'meter_type', '10')
        bill.meter_rent = float(settings.phase_1_rent if m_type == '10' else settings.phase_3_rent)
        
        bill.total_amount = round(
            bill.energy_charges + bill.fixed_charges + bill.duty_charge + 
            bill.regulatory_surcharge + bill.meter_rent + bill.arrears + 
            bill.late_payment_surcharge, 0
        )
        bill.save()
        
        return bill

    @staticmethod
    @transaction.atomic
    def finalize_bill(bill_id, user):
        """Finalize bill and create immutable snapshots"""
        bill = Bill.objects.select_for_update().get(id=bill_id)
        if bill.status != 'draft':
            raise ValidationError("Only draft bills can be finalized.")

        # Create snapshots
        reading = bill.meter_reading
        bill.previous_reading_snapshot = reading.previous_reading
        bill.current_reading_snapshot = reading.current_reading
        bill.units_consumed_snapshot = bill.units
        bill.rate_per_unit_snapshot = bill.rate_per_unit # Not used in tiered but kept for model consistency
        bill.subtotal_snapshot = bill.energy_charges + bill.fixed_charges
        bill.tax_snapshot = bill.duty_charge + bill.regulatory_surcharge
        bill.total_amount_snapshot = bill.total_amount
        bill.consumer_name_snapshot = bill.consumer.name
        bill.meter_number_snapshot = bill.consumer.meter_number
        bill.billing_date_snapshot = timezone.now().date()

        bill.status = 'finalized'
        bill.is_locked = True
        bill.locked_at = timezone.now()
        bill.locked_by = user
        bill.save()

        AuditLog.objects.create(
            user=user,
            action='bill_finalize',
            bill=bill,
            details={'total_amount': bill.total_amount}
        )
        return bill

    @staticmethod
    def generate_bill_pdf(bill_id):
        """Generate PDF using snapshot data"""
        bill = Bill.objects.get(id=bill_id)
        if not bill.is_locked:
            raise ValidationError("PDF can only be generated for finalized bills.")

        # Logic for PDF generation using snapshots would go here.
        # For now, we return the data structure that the PDF generator will use.
        snapshot_data = {
            'bill_number': bill.bill_number,
            'consumer_name': bill.consumer_name_snapshot,
            'meter_number': bill.meter_number_snapshot,
            'previous_reading': bill.previous_reading_snapshot,
            'current_reading': bill.current_reading_snapshot,
            'units': bill.units_consumed_snapshot,
            'total_amount': bill.total_amount_snapshot,
            'billing_date': bill.billing_date_snapshot,
            'status': bill.status,
        }
        
        # Real PDF generation logic (e.g. using WeasyPrint or ReportLab)
        # This calls the existing generator but ensures it uses snapshots.
        return snapshot_data
