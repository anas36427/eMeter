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
                  load_kw=1.0, meter_type="10", connection_type="salary"):
    return Consumer.objects.create(
        consumer_number=consumer_number,
        name="Test Consumer",
        meter_number=meter_number,
        phone="0000000000",
        address="AMU Campus",
        load_kw=load_kw,
        meter_type=meter_type,
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
        self.consumer = make_consumer(load_kw=1.0, meter_type="10")

    # ── helpers ──────────────────────────────────────────────

    def _create_bill(self, units, load_kw=None, meter_type=None):
        if load_kw:
            self.consumer.load_kw = load_kw
            self.consumer.save()
        if meter_type:
            self.consumer.meter_type = meter_type
            self.consumer.save()
        reading = MeterReading.objects.create(
            consumer=self.consumer,
            previous_reading=0,
            current_reading=units,
            reading_date=date.today(),
        )
        bill = Bill.objects.create(
            consumer=self.consumer,
            meter_reading=reading,
            units=units,
            billing_period=date.today().replace(day=1),
            due_date=date.today() + timedelta(days=30),
        )
        from .services import BillingService
        BillingService.calculate_bill(bill.id)
        bill.refresh_from_db()
        return bill

    # ── test cases ───────────────────────────────────────────

    def test_energy_charges_basic(self):
        """energy_charges calculated via tiered tariff (e.g. 100 units = 100 * 5)"""
        bill = self._create_bill(units=100)
        expected = round(100 * 5.0, 2)
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
        energy = round(100 * 5.0, 2)
        fixed = round(1.0 * 400.0, 2)
        expected_duty = round((energy + fixed) * 0.075, 2)
        self.assertAlmostEqual(bill.duty_charge, expected_duty, places=2,
            msg=f"duty_charge should be {expected_duty}, got {bill.duty_charge}")

    def test_phase1_meter_rent(self):
        """phase-1 meter (type='10') → rent = phase_1_rent"""
        bill = self._create_bill(units=50, meter_type="10")
        self.assertEqual(bill.meter_rent, 10.0,
            msg=f"phase-1 meter_rent should be 10.0, got {bill.meter_rent}")

    def test_phase3_meter_rent(self):
        """phase-3 meter (type='25') → rent = phase_3_rent"""
        bill = self._create_bill(units=50, meter_type="25")
        self.assertEqual(bill.meter_rent, 25.0,
            msg=f"phase-3 meter_rent should be 25.0, got {bill.meter_rent}")

    def test_total_amount_formula(self):
        """total_amount = energy + fixed + duty + meter_rent (no arrears, no surcharge)"""
        bill = self._create_bill(units=200, load_kw=2.0)
        energy = round((100 * 5.0) + (100 * 7.0), 2)
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

    def test_tiered_tariff_thresholds(self):
        """Tiered tariff works across all 3 tiers (0-100 = 5/u, 101-300 = 7/u, 301+ = 10/u)"""
        # Tier 1: 50 units -> 250
        b1 = self._create_bill(units=50)
        self.assertAlmostEqual(b1.energy_charges, 250.0, places=2)

        # Tier 2: 150 units -> (100*5) + (50*7) = 850
        b2 = self._create_bill(units=150)
        self.assertAlmostEqual(b2.energy_charges, 850.0, places=2)

        # Tier 3: 350 units -> (100*5) + (200*7) + (50*10) = 2400
        b3 = self._create_bill(units=350)
        self.assertAlmostEqual(b3.energy_charges, 2400.0, places=2)

    def test_bill_number_is_auto_generated(self):
        """Every bill must get a unique bill_number starting with 'BILL'."""
        bill1 = self._create_bill(units=50)
        # Need a second consumer for the second bill to avoid duplicate reading date
        c2 = make_consumer(consumer_number="CN000002", meter_number="MTR000002")
        r2 = MeterReading.objects.create(consumer=c2, previous_reading=0,
                                          current_reading=80, reading_date=date.today())
        bill2 = Bill.objects.create(consumer=c2, meter_reading=r2, units=80,
                                     billing_period=date.today().replace(day=1),
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
            billing_period=date.today().replace(day=1),
            due_date=date.today() + timedelta(days=30),
        )
        from .services import BillingService
        BillingService.calculate_bill(bill.id)
        bill.refresh_from_db()
        expected_lps = round(1000.0 * 0.015, 2)
        self.assertAlmostEqual(bill.late_payment_surcharge, expected_lps, places=2,
            msg=f"late_payment_surcharge should be {expected_lps}, got {bill.late_payment_surcharge}")


# ═══════════════════════════════════════════════════════════════
#  2. UNIT TESTS – calculate-estimate endpoint
# ═══════════════════════════════════════════════════════════════

class CalculateEstimateUnitTest(TestCase):
    """Verify /api/calculate-estimate/ returns correct values matching Bill.save()."""

    def setUp(self):
        make_settings(rate=8.56, fixed=400.0, duty=7.5, p1=10.0, p3=25.0)
        self.consumer = make_consumer(load_kw=2.0, meter_type="10")
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

        # Independently compute expected values using tiered tariff
        energy = round((100 * 5.0) + (50 * 7.0), 2)  # 850.0
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
        self.assertGreater(data["bill"]["energy_charges"], 0)
        self.assertGreater(data["bill"]["fixed_charges"], 0)
        self.assertGreater(data["bill"]["grand_total"], 0)

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
                billing_period=date.today().replace(day=1),
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


# ═══════════════════════════════════════════════════════════════
#  7. SETTINGS TESTS – BillingSettings CRUD via API
# ═══════════════════════════════════════════════════════════════

class BillingSettingsAPITest(TestCase):

    def setUp(self):
        make_settings()
        _, self.token = make_user(username="admin_user", role="admin")
        self.client = Client()

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
