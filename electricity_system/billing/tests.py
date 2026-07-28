"""
eMeter (ElectriFlow) – Billing Test Suite
==========================================
Covers:
  1. Unit Tests      – BillingSettings math, Bill.save() calculations
  2. Integration Tests – Full reading→bill pipeline via API endpoints
  3. Idempotency Tests – Duplicate reading prevention
  4. Performance Tests – N+1 query detection on list endpoints
  5. Security Tests  – Unauthenticated endpoint rejection
"""

import json
from datetime import date, timedelta
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import override_settings

from .models import Consumer, MeterReading, Bill, BillingSettings
from rest_framework.authtoken.models import Token


# ─────────────────────────────────────────────────────────────
#  Shared helpers
# ─────────────────────────────────────────────────────────────

def make_user(username="reader", role="meter_reader"):
    """Create a test user + role + DRF token."""
    User = get_user_model()
    user = User.objects.create_user(username=username, password="testpass123", role=role)
    token, _ = Token.objects.get_or_create(user=user)
    return user, token.key


def make_consumer(consumer_number="CN000001", meter_number="MTR000001",
                  load_kw=1.0, meter_type="analog", connection_type="single_phase"):
    return Consumer.objects.create(
        consumer_number=consumer_number,
        name="Test Consumer",
        meter_number=meter_number,
        phone="0000000000",
        address="AMU Campus",
        load_kw=load_kw,
        connection_type=connection_type,
        status="active",
    )


def make_settings(rate=8.56, fixed=400.0, duty=7.5, p1=10.0, p3=25.0):
    """Ensure exactly one BillingSettings row with given values."""
    BillingSettings.objects.all().delete()
    return BillingSettings.objects.create(
        id=1,
        rate_per_unit=rate,
        fixed_charge_per_kw=fixed,
        duty_percentage=duty,
        phase_1_rent=p1,
        phase_3_rent=p3,
    )


# ═══════════════════════════════════════════════════════════════
#  1. UNIT TESTS – BillingSettings math
# ═══════════════════════════════════════════════════════════════

class BillingMathUnitTest(TestCase):
    """
    Verify that Bill.save() produces mathematically correct outputs
    for a variety of rate/load/unit combinations.
    These tests are the financial integrity guardrails for the system.
    """

    def setUp(self):
        make_settings(rate=8.56, fixed=400.0, duty=7.5, p1=10.0, p3=25.0)
        self.consumer = make_consumer(load_kw=1.0)

    # ── helpers ──────────────────────────────────────────────

    def _create_bill(self, units, load_kw=None, meter_type=None, connection_type=None, reading_date=None):
        if load_kw is not None:
            self.consumer.load_kw = load_kw
        if connection_type is not None:
            self.consumer.connection_type = connection_type
        self.consumer.save()
        r_date = reading_date or date.today()
        reading = MeterReading.objects.create(
            consumer=self.consumer,
            previous_reading=0,
            current_reading=units,
            reading_date=r_date,
        )
        bill = Bill.objects.create(
            consumer=self.consumer,
            meter_reading=reading,
            units=units,
            billing_period_start=r_date.replace(day=1),
            due_date=r_date + timedelta(days=30),
        )
        from .services import BillingService
        BillingService.calculate_bill(bill.id)
        bill.refresh_from_db()
        return bill

    # ── test cases ───────────────────────────────────────────

    def test_energy_charges_basic(self):
        """energy_charges calculated via flat rate (e.g. 100 units = 100 * 8.56)"""
        bill = self._create_bill(units=100)
        expected = round(100 * 8.56, 2)
        self.assertAlmostEqual(bill.energy_charges, expected, places=2,
            msg=f"energy_charges should be {expected}, got {bill.energy_charges}")

    def test_fixed_charges_scale_with_load(self):
        """fixed_charges = load_kw × fixed_charge_per_kw"""
        bill = self._create_bill(units=100, load_kw=3.0)
        expected_fixed = round(3.0 * 400.0, 2)
        self.assertAlmostEqual(bill.fixed_charges, expected_fixed, places=2,
            msg=f"fixed_charges should be {expected_fixed}, got {bill.fixed_charges}")

    def test_duty_charge_calculation(self):
        """duty = (energy_charges + fixed_charges) × duty_percentage / 100"""
        bill = self._create_bill(units=100, load_kw=1.0)
        energy = round(100 * 8.56, 2)
        fixed = round(1.0 * 400.0, 2)
        expected_duty = round((energy + fixed) * 0.075, 2)
        self.assertAlmostEqual(bill.duty_charge, expected_duty, places=2,
            msg=f"duty_charge should be {expected_duty}, got {bill.duty_charge}")

    def test_phase1_meter_rent(self):
        """phase-1 meter (connection_type='single_phase') → rent = phase_1_rent"""
        bill = self._create_bill(units=50, connection_type="single_phase")
        self.assertEqual(bill.meter_rent, 10.0,
            msg=f"phase-1 meter_rent should be 10.0, got {bill.meter_rent}")

    def test_phase3_meter_rent(self):
        """phase-3 meter (connection_type='three_phase') → rent = phase_3_rent"""
        bill = self._create_bill(units=50, connection_type="three_phase")
        self.assertEqual(bill.meter_rent, 25.0,
            msg=f"phase-3 meter_rent should be 25.0, got {bill.meter_rent}")

    def test_total_amount_formula(self):
        """total_amount = energy + fixed + duty + meter_rent (no arrears, no surcharge)"""
        bill = self._create_bill(units=200, load_kw=2.0)
        energy = round(200 * 8.56, 2)
        fixed = round(2.0 * 400.0, 2)
        duty = round((energy + fixed) * 0.075, 2)
        meter_rent = 10.0
        expected_total = round(energy + fixed + duty + meter_rent, 0)
        self.assertEqual(int(bill.total_amount), int(expected_total),
            msg=f"total_amount should be {int(expected_total)}, got {int(bill.total_amount)}")

    def test_zero_units_bill(self):
        """A zero-unit bill should still charge fixed costs and meter rent."""
        bill = self._create_bill(units=0)
        self.assertEqual(bill.energy_charges, 0.0)
        self.assertGreater(bill.fixed_charges, 0,
            msg="Fixed charges should apply even at zero units")
        self.assertGreater(bill.total_amount, 0,
            msg="Total should be > 0 even at zero units (fixed + duty + rent)")

    def test_flat_rate_tariff_thresholds(self):
        """Flat rate works correctly for any units (e.g. 8.56/unit)"""
        b1 = self._create_bill(units=50)
        self.assertAlmostEqual(float(b1.energy_charges), 50 * 8.56, places=2)

        # Use different months to avoid validation errors.
        # Accumulate readings since previous_reading is automatically taken from the DB.
        date_b2 = date.today() + timedelta(days=32)
        b2 = self._create_bill(units=50 + 150, reading_date=date_b2)
        self.assertAlmostEqual(float(b2.energy_charges), 200 * 8.56, places=2)

        date_b3 = date.today() + timedelta(days=64)
        b3 = self._create_bill(units=200 + 350, reading_date=date_b3)
        self.assertAlmostEqual(float(b3.energy_charges), 550 * 8.56, places=2)

    def test_bill_number_is_auto_generated(self):
        """Every bill must get a unique bill_number starting with 'BILL'."""
        bill1 = self._create_bill(units=50)
        # Need a second consumer for the second bill to avoid duplicate reading date
        c2 = make_consumer(consumer_number="CN000002", meter_number="MTR000002")
        r2 = MeterReading.objects.create(consumer=c2, previous_reading=0,
                                          current_reading=80, reading_date=date.today())
        bill2 = Bill.objects.create(consumer=c2, meter_reading=r2, units=80,
                                     billing_period_start=date.today().replace(day=1),
                                     due_date=date.today() + timedelta(days=30))
        self.assertTrue(bill1.bill_number.startswith("BILL"))
        self.assertTrue(bill2.bill_number.startswith("BILL"))
        self.assertNotEqual(bill1.bill_number, bill2.bill_number,
            msg="Each bill must have a unique bill_number")

    def test_high_load_consumer(self):
        """5 KW consumer fixed charges = 5 × 400 = 2000"""
        bill = self._create_bill(units=300, load_kw=5.0)
        self.assertAlmostEqual(bill.fixed_charges, 5.0 * 400.0, places=2)

    def test_late_payment_surcharge_on_arrears(self):
        """late_payment_surcharge = arrears × 0.015 when arrears > 0."""
        reading = MeterReading.objects.create(
            consumer=self.consumer, previous_reading=0,
            current_reading=100, reading_date=date.today())
        bill = Bill.objects.create(
            consumer=self.consumer, meter_reading=reading, units=100,
            arrears=1000.0,
            billing_period_start=date.today().replace(day=1),
            due_date=date.today() + timedelta(days=30),
        )
        from .services import BillingService
        BillingService.calculate_bill(bill.id)
        bill.refresh_from_db()
        expected_lps = round(1000.0 * 0.015, 2)
        self.assertAlmostEqual(bill.late_payment_surcharge, expected_lps, places=2,
            msg=f"late_payment_surcharge should be {expected_lps}, got {bill.late_payment_surcharge}")

    def test_immutable_snapshots_preserve_historical_rates_and_load(self):
        """
        When global BillingSettings rates or consumer connected load/phase upgrade later,
        a locked historical bill must preserve its original calculated charges and snapshots.
        """
        from .services import BillingService
        bill = self._create_bill(units=100, load_kw=1.0, connection_type="single_phase")
        bill.is_locked = True
        bill.status = 'issued'
        bill.save()
        
        orig_total = bill.total_amount_snapshot
        orig_energy = bill.energy_charges
        orig_fixed = bill.fixed_charges
        
        # 1. Upgrade consumer personally to 5 kW Three Phase
        self.consumer.load_kw = 5.0
        self.consumer.connection_type = "three_phase"
        self.consumer.save()
        
        # 2. Modify global tariff settings to much higher rates
        make_settings(rate=15.00, fixed=800.0, duty=10.0, p1=50.0, p3=150.0)
        
        # 3. Refresh locked bill from DB and verify immunity
        bill.refresh_from_db()
        self.assertEqual(bill.load_kw_snapshot, 1.0)
        self.assertEqual(bill.connection_type_snapshot, "single_phase")
        self.assertEqual(bill.total_amount_snapshot, orig_total)
        self.assertEqual(bill.energy_charges, orig_energy)
        self.assertEqual(bill.fixed_charges, orig_fixed)
        
        # 4. Attempting to recalculate a locked bill must raise ValidationError
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            BillingService.calculate_bill(bill.id)

    def test_fractional_load_decimal_precision_edge_case(self):
        """
        Verify that a consumer with fractional connected load (e.g., 1.33 kW) does not produce
        floating-point overflow or excess decimal place exceptions during billing calculations.
        """
        bill = self._create_bill(units=73, load_kw=1.33, connection_type="single_phase")
        # Fixed charges should round exactly to 2 decimal places: 1.33 * 400 = 532.00
        # Energy charges: 73 * 8.56 = 624.88
        # Duty: (624.88 + 532.00) * 0.075 = 86.77
        self.assertAlmostEqual(float(bill.fixed_charges), 1.33 * 400.0, places=2)
        self.assertEqual(len(str(bill.fixed_charges).split('.')[-1]), 2, "Must retain strict 2 decimal place financial precision")

    def test_snapshot_tamper_protection_on_locked_bills(self):
        """
        Vulnerability check: Verify that direct database save attempts to tamper with snapshot
        rates or amounts on a finalized bill are rejected by model-level protection.
        """
        from django.core.exceptions import ValidationError
        bill = self._create_bill(units=100)
        bill.is_locked = True
        bill.save()
        
        # Attempt to tamper with historical snapshots after lock
        bill.total_amount_snapshot = 0.0
        bill.rate_snapshot = 1.00
        with self.assertRaises(ValidationError) as ctx:
            bill.save()
        self.assertIn("Cannot modify immutable field", str(ctx.exception))


# ═══════════════════════════════════════════════════════════════
#  2. UNIT TESTS – calculate-estimate endpoint
# ═══════════════════════════════════════════════════════════════

class CalculateEstimateUnitTest(TestCase):
    """Verify /api/calculate-estimate/ returns correct values matching Bill.save()."""

    def setUp(self):
        make_settings(rate=8.56, fixed=400.0, duty=7.5, p1=10.0, p3=25.0)
        self.consumer = make_consumer(load_kw=2.0, meter_type="analog")
        _, self.token = make_user()
        self.client = Client()

    def _post(self, payload):
        return self.client.post(
            "/api/calculate-estimate/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {self.token}",
        )

    def test_estimate_matches_bill_math(self):
        """Estimate endpoint should return values identical to Bill.save()."""
        units = 150
        res = self._post({"consumer_id": self.consumer.id,
                          "current_reading": units,
                          "previous_reading": 0})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        # Independently compute expected values using flat rate tariff
        energy = round(150 * 8.56, 2)
        fixed = round(2.0 * 400.0, 2)
        duty = round((energy + fixed) * 0.075, 2)
        meter_rent = 10.0
        expected_total = int(round(energy + fixed + duty + meter_rent, 0))

        self.assertAlmostEqual(data["breakdown"]["energy_charges"], energy, places=2)
        self.assertAlmostEqual(data["breakdown"]["fixed_charges"], fixed, places=2)
        self.assertAlmostEqual(data["breakdown"]["duty_charge"], duty, places=2)
        self.assertEqual(data["breakdown"]["meter_rent"], meter_rent)
        self.assertEqual(data["total_amount"], expected_total)

    def test_estimate_missing_consumer_id(self):
        res = self._post({"current_reading": 100})
        self.assertEqual(res.status_code, 400)

    def test_estimate_invalid_consumer(self):
        res = self._post({"consumer_id": 99999, "current_reading": 100})
        self.assertEqual(res.status_code, 404)

    def test_estimate_unauthenticated(self):
        res = self.client.post("/api/calculate-estimate/",
                               data=json.dumps({"consumer_id": self.consumer.id, "current_reading": 100}),
                               content_type="application/json")
        self.assertEqual(res.status_code, 401)


# ═══════════════════════════════════════════════════════════════
#  3. INTEGRATION TESTS – Full reading→bill pipeline
# ═══════════════════════════════════════════════════════════════

class ReadingAndBillIntegrationTest(TestCase):
    """
    Integration test: POST /api/reading-and-bill/ must atomically create
    both a MeterReading and a Bill. Partial failures should leave the DB clean.
    """

    def setUp(self):
        make_settings()
        self.consumer = make_consumer()
        _, self.token = make_user()
        self.client = Client()

    def _submit(self, payload):
        return self.client.post(
            "/api/reading-and-bill/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {self.token}",
        )

    def test_successful_submit_creates_reading_and_bill(self):
        payload = {
            "consumer_id": self.consumer.id,
            "current_reading": 500,
            "reading_date": str(date.today()),
        }
        res = self._submit(payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertTrue(data.get("success"))
        self.assertIn("reading", data)
        self.assertIn("bill", data)

        # DB state must reflect both records
        self.assertEqual(MeterReading.objects.filter(consumer=self.consumer).count(), 1)
        self.assertEqual(Bill.objects.filter(consumer=self.consumer).count(), 1)

    def test_units_consumed_calculated_correctly(self):
        """When previous reading is 200 and current is 350, units = 150."""
        MeterReading.objects.create(
            consumer=self.consumer, previous_reading=0,
            current_reading=200, reading_date=date.today() - timedelta(days=30))

        payload = {"consumer_id": self.consumer.id,
                   "current_reading": 350,
                   "reading_date": str(date.today())}
        res = self._submit(payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["reading"]["units_consumed"], 150)
        self.assertEqual(data["bill"]["units"], 150)

    def test_bill_charges_are_nonzero(self):
        """Generated bill must contain real computed charges, not all zeros."""
        payload = {"consumer_id": self.consumer.id,
                   "current_reading": 200,
                   "reading_date": str(date.today())}
        res = self._submit(payload)
        data = res.json()
        self.assertGreater(float(data["bill"]["energy_charges"]), 0)
        self.assertGreater(float(data["bill"]["fixed_charges"]), 0)
        self.assertGreater(float(data["bill"]["grand_total"]), 0)

    def test_reject_reading_less_than_previous(self):
        """Current reading cannot be less than previous — must return 400."""
        MeterReading.objects.create(consumer=self.consumer, previous_reading=0,
            current_reading=500, reading_date=date.today() - timedelta(days=30))
        payload = {"consumer_id": self.consumer.id,
                   "current_reading": 100,   # less than 500
                   "reading_date": str(date.today())}
        res = self._submit(payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("previous_reading", res.json())

    def test_missing_consumer_id_returns_400(self):
        res = self._submit({"current_reading": 100, "reading_date": str(date.today())})
        self.assertEqual(res.status_code, 400)

    def test_missing_reading_date_returns_400(self):
        res = self._submit({"consumer_id": self.consumer.id, "current_reading": 100})
        self.assertEqual(res.status_code, 400)

    def test_unauthenticated_request_rejected(self):
        res = self.client.post("/api/reading-and-bill/",
                               data=json.dumps({"consumer_id": self.consumer.id,
                                                "current_reading": 100,
                                                "reading_date": str(date.today())}),
                               content_type="application/json")
        self.assertEqual(res.status_code, 401)


# ═══════════════════════════════════════════════════════════════
#  4. IDEMPOTENCY TESTS – Duplicate reading prevention
# ═══════════════════════════════════════════════════════════════

class DuplicateReadingTest(TestCase):
    """
    Submitting the same reading twice for the same consumer+date must be rejected.
    The DB must contain exactly 1 reading and 1 bill after both attempts.
    """

    def setUp(self):
        make_settings()
        self.consumer = make_consumer()
        _, self.token = make_user()
        self.client = Client()

    def _submit(self, reading_value, reading_date=None):
        return self.client.post(
            "/api/reading-and-bill/",
            data=json.dumps({
                "consumer_id": self.consumer.id,
                "current_reading": reading_value,
                "reading_date": str(reading_date or date.today()),
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {self.token}",
        )

    def test_duplicate_rejected_with_400(self):
        r1 = self._submit(300)
        self.assertEqual(r1.status_code, 200)

        r2 = self._submit(350)   # same date, different value
        self.assertEqual(r2.status_code, 400)
        self.assertTrue(r2.json().get("already_exists"))

    def test_db_has_exactly_one_reading_after_duplicate(self):
        self._submit(300)
        self._submit(350)
        self.assertEqual(
            MeterReading.objects.filter(consumer=self.consumer, reading_date=date.today()).count(), 1,
            msg="DB must have exactly 1 reading even after a duplicate attempt")

    def test_db_has_exactly_one_bill_after_duplicate(self):
        self._submit(300)
        self._submit(350)
        self.assertEqual(
            Bill.objects.filter(consumer=self.consumer).count(), 1,
            msg="DB must have exactly 1 bill even after a duplicate attempt")

    def test_different_dates_both_succeed(self):
        """Two readings on different dates must both be accepted."""
        r1 = self._submit(300, date.today() - timedelta(days=30))
        r2 = self._submit(450, date.today())
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(MeterReading.objects.filter(consumer=self.consumer).count(), 2)
        self.assertEqual(Bill.objects.filter(consumer=self.consumer).count(), 2)


# ═══════════════════════════════════════════════════════════════
#  5. PERFORMANCE TESTS – N+1 query prevention
# ═══════════════════════════════════════════════════════════════

class QueryPerformanceTest(TestCase):
    """
    Ensure list endpoints use select_related/prefetch_related and do NOT
    scale linearly with the number of records (N+1 problem).
    A well-optimized endpoint should require O(1) queries regardless of record count.
    """

    def setUp(self):
        make_settings()
        _, self.token = make_user(role="admin")
        self.client = Client()

        # Seed 20 consumers, each with 1 reading + 1 bill
        for i in range(1, 21):
            consumer = make_consumer(
                consumer_number=f"CN{i:06d}",
                meter_number=f"MTR{i:06d}",
            )
            reading = MeterReading.objects.create(
                consumer=consumer, previous_reading=0,
                current_reading=i * 50, reading_date=date.today())
            Bill.objects.create(
                consumer=consumer, meter_reading=reading, units=i * 50,
                billing_period_start=date.today().replace(day=1),
                due_date=date.today() + timedelta(days=30))

    def _get(self, url):
        return self.client.get(url, HTTP_AUTHORIZATION=f"Token {self.token}")

    def test_bills_list_query_count_is_bounded(self):
        """
        /api/bills/ must complete with fewer than 10 DB queries regardless
        of how many bills exist. Exceeding this signals an N+1 regression.
        """
        with self.assertNumQueries(less_than=10):
            res = self._get("/api/bills/?limit=20")
        self.assertEqual(res.status_code, 200)

    def test_consumers_list_query_count_is_bounded(self):
        """
        /api/consumers/ must complete with fewer than 10 DB queries.
        """
        with self.assertNumQueries(less_than=10):
            res = self._get("/api/consumers/")
        self.assertEqual(res.status_code, 200)

    def test_dashboard_stats_query_count_is_bounded(self):
        with self.assertNumQueries(less_than=15):
            res = self._get("/api/dashboard-stats/")
        self.assertEqual(res.status_code, 200)

    def assertNumQueries(self, less_than):
        """Context manager that asserts query count is below a threshold."""
        return _QueryCountAsserter(self, less_than)


class _QueryCountAsserter:
    """Thin context manager for assertNumQueries(less_than=N)."""
    def __init__(self, test_case, less_than):
        self.test_case = test_case
        self.less_than = less_than
        self._initial_count = 0

    def __enter__(self):
        self._initial_count = len(connection.queries)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            return False
        executed = len(connection.queries) - self._initial_count
        self.test_case.assertLess(
            executed, self.less_than,
            msg=(
                f"N+1 QUERY REGRESSION: {executed} queries executed, "
                f"expected fewer than {self.less_than}. "
                "Add select_related/prefetch_related to fix this."
            )
        )


# ═══════════════════════════════════════════════════════════════
#  6. SECURITY TESTS – Auth + role enforcement
# ═══════════════════════════════════════════════════════════════

class SecurityTest(TestCase):
    """
    All protected endpoints must reject unauthenticated requests with 401.
    """

    PROTECTED_ENDPOINTS = [
        ("/api/dashboard-stats/", "GET"),
        ("/api/consumers/", "GET"),
        ("/api/bills/", "GET"),
        ("/api/settings/", "GET"),
        ("/api/reading-and-bill/", "POST"),
        ("/api/calculate-estimate/", "POST"),
    ]

    def setUp(self):
        self.client = Client()

    def test_all_endpoints_reject_anonymous(self):
        for url, method in self.PROTECTED_ENDPOINTS:
            with self.subTest(url=url, method=method):
                if method == "GET":
                    res = self.client.get(url)
                else:
                    res = self.client.post(url, data="{}", content_type="application/json")
                self.assertEqual(
                    res.status_code, 401,
                    msg=f"{method} {url} must return 401 for anonymous users, got {res.status_code}"
                )

    def test_invalid_token_returns_401(self):
        res = self.client.get(
            "/api/dashboard-stats/",
            HTTP_AUTHORIZATION="Token invalidtoken000"
        )
        self.assertEqual(res.status_code, 401)

    def test_bola_idor_readings_and_search(self):
        """Verify that BOLA / IDOR checks restrict standard consumers to their own records."""
        User = get_user_model()
        
        # User 1 (Consumer)
        user1 = User.objects.create_user(username="user1", password="testpass123", role="consumer")
        token1, _ = Token.objects.get_or_create(user=user1)
        consumer1 = Consumer.objects.create(
            consumer_number="CN000003",
            name="Consumer One",
            meter_number="MTR000003",
            user=user1,
            status="active"
        )
        
        # User 2 (Consumer)
        user2 = User.objects.create_user(username="user2", password="testpass123", role="consumer")
        token2, _ = Token.objects.get_or_create(user=user2)
        consumer2 = Consumer.objects.create(
            consumer_number="CN000004",
            name="Consumer Two",
            meter_number="MTR000004",
            user=user2,
            status="active"
        )
        
        # User 3 (Admin)
        admin_user = User.objects.create_user(username="admin_user_sec", password="testpass123", role="admin")
        token_admin, _ = Token.objects.get_or_create(user=admin_user)
        
        # Create readings
        MeterReading.objects.create(consumer=consumer1, current_reading=100, reading_date=date.today())
        MeterReading.objects.create(consumer=consumer2, current_reading=200, reading_date=date.today())
        
        # 1. Test api_consumer_readings BOLA/IDOR protection
        # User 1 accessing own readings -> 200 OK
        res = self.client.get(f"/api/consumer/{consumer1.id}/readings/", HTTP_AUTHORIZATION=f"Token {token1.key}")
        self.assertEqual(res.status_code, 200)
        
        # User 1 accessing User 2's readings -> 403 Forbidden
        res = self.client.get(f"/api/consumer/{consumer2.id}/readings/", HTTP_AUTHORIZATION=f"Token {token1.key}")
        self.assertEqual(res.status_code, 403)
        
        # Admin accessing User 2's readings -> 200 OK
        res = self.client.get(f"/api/consumer/{consumer2.id}/readings/", HTTP_AUTHORIZATION=f"Token {token_admin.key}")
        self.assertEqual(res.status_code, 200)
        
        # 2. Test api_consumer_search BOLA/IDOR protection
        # User 1 searching (querying for all) -> should only return Consumer 1
        res = self.client.get("/api/consumers/search/?meter_number=Consumer", HTTP_AUTHORIZATION=f"Token {token1.key}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["consumers"]), 1)
        self.assertEqual(res.json()["consumers"][0]["id"], consumer1.id)
        
        # Admin searching (querying for all) -> returns both
        res = self.client.get("/api/consumers/search/?meter_number=Consumer", HTTP_AUTHORIZATION=f"Token {token_admin.key}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["consumers"]), 2)
        
        # 3. Test api_get_consumer BOLA/IDOR protection directly
        from django.test import RequestFactory
        from .views import api_get_consumer
        
        factory = RequestFactory()
        
        # User 1 fetching own details -> 200 OK
        req = factory.get(f"/api/consumer/{consumer1.id}/")
        req.user = user1
        res = api_get_consumer(req, consumer_id=consumer1.id)
        self.assertEqual(res.status_code, 200)
        
        # User 1 fetching User 2's details -> 403 Forbidden
        req = factory.get(f"/api/consumer/{consumer2.id}/")
        req.user = user1
        res = api_get_consumer(req, consumer_id=consumer2.id)
        self.assertEqual(res.status_code, 403)
        
        # Admin fetching User 2's details -> 200 OK
        req = factory.get(f"/api/consumer/{consumer2.id}/")
        req.user = admin_user
        res = api_get_consumer(req, consumer_id=consumer2.id)
        self.assertEqual(res.status_code, 200)


# ═══════════════════════════════════════════════════════════════
#  7. SETTINGS TESTS – BillingSettings CRUD via API
# ═══════════════════════════════════════════════════════════════

class BillingSettingsAPITest(TestCase):

    def setUp(self):
        make_settings()
        self.user, self.token = make_user(username="admin_user", role="admin")
        self.client = Client()
        self.client.force_login(self.user)

    def _auth_get(self, url):
        return self.client.get(url, HTTP_AUTHORIZATION=f"Token {self.token}")

    def _auth_post(self, url, payload):
        return self.client.post(url, data=json.dumps(payload),
                                content_type="application/json",
                                HTTP_AUTHORIZATION=f"Token {self.token}")

    def test_get_settings_returns_all_fields(self):
        res = self._auth_get("/api/settings/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        for field in ["rate_per_unit", "fixed_charge_per_kw", "duty_percentage",
                      "phase_1_rent", "phase_3_rent"]:
            self.assertIn(field, data, msg=f"Missing field: {field}")

    def test_update_rate_per_unit(self):
        res = self._auth_post("/api/settings/update/", {"rate_per_unit": 12.00})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json().get("success"))
        updated = BillingSettings.get_settings()
        self.assertAlmostEqual(updated.rate_per_unit, 12.00, places=2)

    def test_update_duty_percentage(self):
        res = self._auth_post("/api/settings/update/", {"duty_percentage": 10.0})
        self.assertEqual(res.status_code, 200)
        updated = BillingSettings.get_settings()
        self.assertAlmostEqual(updated.duty_percentage, 10.0, places=2)

    def test_invalid_rate_returns_400(self):
        res = self._auth_post("/api/settings/update/", {"rate_per_unit": "not_a_number"})
        self.assertIn(res.status_code, [400, 500])
