#!/usr/bin/env python
"""Utility script to finalize all existing draft bills in the database"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricity_system.settings')
django.setup()

from billing.models import Bill
from django.contrib.auth import get_user_model
from billing.services import BillingService

def main():
    User = get_user_model()
    admin = User.objects.filter(role='admin').first() or User.objects.first()
    
    if not admin:
        print("❌ Error: No user accounts found in the database. Please create a user first.")
        return

    draft_bills = Bill.objects.filter(status='draft')
    count = draft_bills.count()
    
    if count == 0:
        print("✅ No draft bills found. All existing bills are finalized!")
        return

    print(f"🔄 Found {count} draft bill(s). Finalizing them now...")
    for bill in draft_bills:
        try:
            BillingService.finalize_bill(bill.id, admin)
            print(f"  ✨ Finalized and locked Bill: {bill.bill_number} (ID: {bill.id})")
        except Exception as e:
            print(f"  ❌ Error finalizing Bill {bill.id}: {e}")

    print("\n🎉 Done! All existing draft bills are now finalized and lock-secured!")

if __name__ == '__main__':
    main()
