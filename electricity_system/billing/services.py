import io
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from .models import Consumer, MeterReading, Bill, BillingSettings, AuditLog
from datetime import datetime, timedelta


class BillingService:
    @staticmethod
    def validate_reading(consumer, reading_date, current_reading, meter=None):
        """Strict validation for meter readings, now meter-aware."""
        from django.core.exceptions import ValidationError
        from django.db import models
        from .models import ConsumerMeterAssignment, Meter, MeterReading
        
        if current_reading < 0:
            raise ValidationError("Reading cannot be negative.")

        if isinstance(reading_date, str):
            date_obj = datetime.strptime(reading_date, '%Y-%m-%d').date()
        else:
            date_obj = reading_date

        if not meter:
            # Resolve meter temporally
            active_at_date = ConsumerMeterAssignment.objects.filter(
                consumer=consumer,
                start_date__lte=date_obj
            ).filter(
                models.Q(end_date__gte=date_obj) | models.Q(end_date__isnull=True)
            )
            if active_at_date.exists():
                meter = active_at_date.first().meter
            else:
                active_assignments = ConsumerMeterAssignment.objects.filter(
                    consumer=consumer,
                    is_active=True
                )
                if active_assignments.exists():
                    meter = active_assignments.first().meter
                elif consumer.meter_number:
                    meter, _ = Meter.objects.get_or_create(
                        meter_number=consumer.meter_number,
                        defaults={'meter_type': consumer.meter_type}
                    )
                else:
                    raise ValidationError("No active meter assignment found for this consumer on the reading date.")

        # Validate assignment exists during reading_date
        assignment_exists = ConsumerMeterAssignment.objects.filter(
            consumer=consumer,
            meter=meter,
            start_date__lte=date_obj
        ).filter(
            models.Q(end_date__gte=date_obj) | models.Q(end_date__isnull=True)
        ).exists()

        if not assignment_exists:
            raise ValidationError(
                f"Meter {meter.meter_number} was not assigned to consumer {consumer.name} on {date_obj}."
            )

        # Chronology check PER METER
        last_reading = MeterReading.objects.filter(meter=meter).order_by('-reading_date', '-id').first()
        previous_reading = last_reading.current_reading if last_reading else 0

        if current_reading < previous_reading:
            raise ValidationError(f"Current reading ({current_reading}) cannot be less than previous reading ({previous_reading}) for Meter {meter.meter_number}.")

        # Check for duplicate reading in same billing month PER METER
        if MeterReading.objects.filter(
            meter=meter, 
            reading_date__year=date_obj.year, 
            reading_date__month=date_obj.month
        ).exists():
            raise ValidationError(f"A reading for {date_obj.strftime('%B %Y')} already exists for Meter {meter.meter_number}.")

        # Enforce minimum 20-day interval for new readings PER METER
        if last_reading:
            days_diff = (date_obj - last_reading.reading_date).days
            if days_diff < 20:
                raise ValidationError(f"New reading can only be taken at least 20 days after the last reading (last reading was {days_diff} day(s) ago).")

        return previous_reading

    @staticmethod
    @transaction.atomic
    def generate_final_bill(consumer, current_reading, reading_date, user, billing_period=None, due_date=None, remarks="", arrears=0.0, meter=None, created_source='mobile_reader', manual_override_reason=None):
        """
        Atomic operation: Validates reading, creates reading and bill, calculates charges,
        populates snapshots, locks immediately, and returns the immutable bill.
        """
        from django.db import models
        from .models import ConsumerMeterAssignment, Meter, MeterReading, CreatedSource
        # No mandatory manual_override_reason check as requested

        # 1. Resolve Meter
        if isinstance(reading_date, str):
            date_obj = datetime.strptime(reading_date, '%Y-%m-%d').date()
        else:
            date_obj = reading_date

        if not meter:
            active_at_date = ConsumerMeterAssignment.objects.filter(
                consumer=consumer,
                start_date__lte=date_obj
            ).filter(
                models.Q(end_date__gte=date_obj) | models.Q(end_date__isnull=True)
            )
            if active_at_date.exists():
                meter = active_at_date.first().meter
            else:
                active_assignments = ConsumerMeterAssignment.objects.filter(
                    consumer=consumer,
                    is_active=True
                )
                if active_assignments.exists():
                    meter = active_assignments.first().meter
                elif consumer.meter_number:
                    meter, _ = Meter.objects.get_or_create(
                        meter_number=consumer.meter_number,
                        defaults={'meter_type': consumer.meter_type}
                    )
                else:
                    raise ValidationError("No active meter assignment found for this consumer on the reading date.")

        previous_reading = BillingService.validate_reading(consumer, date_obj, current_reading, meter=meter)

        # 2. Create MeterReading
        reading = MeterReading.objects.create(
            consumer=consumer,
            meter=meter,
            previous_reading=previous_reading,
            current_reading=current_reading,
            reading_date=date_obj,
            reading_time=timezone.localtime().time(),
            created_by=user,
            remarks=remarks,
            created_source=created_source,
            manual_override_reason=manual_override_reason
        )

        # 3. Initialize Bill
        import calendar
        bp_start = date_obj.replace(day=1)
        bp_end = date_obj.replace(day=calendar.monthrange(date_obj.year, date_obj.month)[1])
        dd = due_date or (date_obj + timedelta(days=15))
        
        bill = Bill.objects.create(
            consumer=consumer,
            meter=meter,
            meter_reading=reading,
            units=reading.units_consumed,
            bill_date=date_obj,
            billing_period_start=bp_start,
            billing_period_end=bp_end,
            due_date=dd,
            status='draft',
            is_locked=False,
            arrears=arrears,
            created_source=created_source,
            manual_override_reason=manual_override_reason
        )

        # 4a. Carry-Forward Arrear Injection (Hybrid Model)
        # Query all locked, unpaid bills for this consumer (excluding the bill just created).
        from decimal import Decimal as D
        unpaid_bills = Bill.objects.filter(
            consumer=consumer,
            status__in=['issued', 'overdue'],
            is_locked=True
        ).exclude(pk=bill.pk)

        if unpaid_bills.exists():
            s = BillingSettings.get_settings()
            lps_rate = D(str(s.lps_rate)) / D('100')  # e.g. 1.50 -> 0.0150
            unpaid_principal = D('0')
            for unpaid in unpaid_bills:
                # Use snapshot total if available; subtract any partial payment
                principal = D(str(unpaid.total_amount_snapshot or unpaid.total_amount))
                paid = D(str(unpaid.paid_amount or 0))
                unpaid_principal += max(D('0'), principal - paid)

            lps_amount = round(unpaid_principal * lps_rate, 2)
            # Update the bill's arrear fields on the DB object so calculate_bill picks them up
            Bill.objects.filter(pk=bill.pk).update(
                arrears=unpaid_principal,
                late_payment_surcharge=lps_amount
            )
            bill.arrears = float(unpaid_principal)
            bill.late_payment_surcharge = float(lps_amount)

        # 4b. Calculate Charges using central function
        bill = BillingService.calculate_bill(bill.id)

        # 5. Populate Immutable Snapshots
        bill.units_consumed_snapshot   = bill.units
        bill.rate_snapshot             = bill.rate_per_unit
        bill.total_amount_snapshot     = float(bill.total_amount)
        bill.consumer_name_snapshot    = bill.consumer.name
        bill.meter_number_snapshot     = bill.meter.meter_number if bill.meter else ''
        
        bill.locked_at = timezone.now()
        bill.locked_by = user
        bill.status = 'issued'
        bill.is_locked = True
        bill.save()

        # Generate Audit Log
        AuditLog.objects.create(
            user=user,
            action='bill_finalize',  # FIX B-08: 'bill_generated_final' is not a valid AuditLog.Action choice
            bill=bill,
            details={'total_amount': float(bill.total_amount), 'units': float(bill.units), 'created_source': created_source}
        )

        return bill

    @staticmethod
    @transaction.atomic
    def calculate_bill(bill_id):
        """
        Calculate bill using flat rate tariff from BillingSettings.
        """
        from decimal import Decimal
        bill = Bill.objects.select_for_update().get(id=bill_id)
        if bill.is_locked:
            raise ValidationError("Cannot recalculate a locked bill.")

        settings = BillingSettings.get_settings()
        units = Decimal(str(bill.units))
        
        bill.rate_per_unit = float(settings.rate_per_unit)
        bill.energy_charges = round(units * Decimal(str(settings.rate_per_unit)), 2)

        load = Decimal(str(getattr(bill.consumer, 'load_kw', 1.0)))
        fixed_rate = Decimal(str(getattr(settings, 'fixed_charge_per_kw', 400.0)))
        bill.fixed_charges = load * fixed_rate
        
        duty_pct = float(getattr(settings, 'duty_percentage', 7.5))
        bill.duty_charge = round((float(bill.energy_charges) + float(bill.fixed_charges)) * (duty_pct / 100), 2)
        
        m_type = getattr(bill.consumer, 'meter_type', 'analog')
        bill.meter_rent = float(settings.phase_1_rent if m_type == 'analog' else settings.phase_3_rent)
        # Use dynamic lps_rate from BillingSettings — NOT a hardcoded constant
        from decimal import Decimal as D
        lps_rate = D(str(settings.lps_rate)) / D('100')  # e.g. 1.50 → 0.0150
        bill.late_payment_surcharge = float(round(D(str(bill.arrears)) * lps_rate, 2)) if bill.arrears > 0 else 0.0
        
        bill.total_amount = round(
            Decimal(str(bill.energy_charges)) + Decimal(str(bill.fixed_charges)) + Decimal(str(bill.duty_charge)) + 
            Decimal(str(bill.regulatory_surcharge)) + Decimal(str(bill.meter_rent)) + Decimal(str(bill.arrears)) + 
            Decimal(str(bill.late_payment_surcharge)), 0
        )
        bill.save()
        
        return bill

    @staticmethod
    def generate_bill_pdf(bill_id):
        """Generate PDF using snapshot data"""
        bill = Bill.objects.get(id=bill_id)
        if not bill.is_locked:
            raise ValidationError("PDF can only be generated for issued bills.")

        from .pdf_generator import BillPDFGenerator
        
        pdf_data = {
            'bill_number': bill.bill_number,
            'bill_date': bill.locked_at.strftime('%d %b %Y') if bill.locked_at else timezone.now().strftime('%d %b %Y'),
            'due_date': bill.due_date.strftime('%d %b %Y') if bill.due_date else 'N/A',
            'connection_type': bill.consumer.connection_type,
            'load_kw': bill.consumer.load_kw,
            'billing_period': bill.billing_period_start.strftime('%B %Y') if bill.billing_period_start else 'N/A',
            'consumer_name': bill.consumer_name_snapshot or bill.consumer.name,
            'consumer_number': bill.consumer.consumer_number,
            'meter_number': bill.meter_number_snapshot or (bill.meter.meter_number if bill.meter else (bill.consumer.meter_number or 'N/A')),
            'address': bill.consumer.address,
            'previous_reading': bill.meter_reading.previous_reading if bill.meter_reading else 0.0,
            'current_reading': bill.meter_reading.current_reading if bill.meter_reading else (bill.units_consumed_snapshot or bill.units),
            'units': bill.units_consumed_snapshot or bill.units,
            'rate_per_unit': bill.rate_snapshot or bill.rate_per_unit,
            'energy_charges': bill.energy_charges,
            'fixed_charges': bill.fixed_charges,
            'duty_charge': bill.duty_charge,
            'meter_rent': bill.meter_rent,
            'meter_type': '1' if bill.consumer.meter_type == 'analog' else '3',
            'regulatory_surcharge': bill.regulatory_surcharge,
            'arrears': bill.arrears,
            'late_payment_surcharge': bill.late_payment_surcharge,
            'lps_rate': float(BillingSettings.get_settings().lps_rate),
            'total_amount': bill.total_amount_snapshot or bill.total_amount,
            'total_payable': int(round(bill.total_amount_snapshot or bill.total_amount)),
            'current_year': timezone.now().year,
            'is_finalized': True
        }
        
        return BillPDFGenerator.generate_bill_pdf(pdf_data)
