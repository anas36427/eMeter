import json
from django.http import HttpResponse

@api_view(['GET'])
@require_role('admin')
def export_mobile_sync(request):
    """
    Exports a JSON file containing all data needed for the mobile app
    to operate in 'Total Offline Mode'.
    """
    # 1. Get Meter Readers
    readers = User.objects.filter(role=User.Role.METER_READER, is_active=True)
    readers_data = []
    for r in readers:
        readers_data.append({
            'id': r.id,
            'username': r.username,
            'name': f"{r.first_name} {r.last_name}".strip() or r.username,
            'password_hash': r.password  # e.g., 'pbkdf2_sha256$260000$salt$hash'
        })
        
    # 2. Get Consumers
    consumers = Consumer.objects.filter(status='active')
    consumers_data = []
    for c in consumers:
        consumers_data.append({
            'id': c.id,
            'consumer_number': c.consumer_number,
            'name': c.name,
            'email': c.email,
            'phone': c.phone,
            'address': c.address,
            'meter_number': c.meter_number,
            'meter_type': c.connection_type,
            'load_kw': float(c.load_kw) if c.load_kw else 1.0,
            'previous_reading': float(c.previous_reading) if c.previous_reading else 0.0,
            'status': c.status
        })
        
    # 3. Get Billing Settings
    try:
        settings = BillingSettings.objects.get(id=1)
        settings_data = {
            'rate_per_unit': float(settings.rate_per_unit),
            'fixed_charge_per_kw': float(settings.fixed_charge_per_kw),
            'duty_percentage': float(settings.duty_percentage),
            'phase_1_rent': float(settings.phase_1_rent),
            'phase_3_rent': float(settings.phase_3_rent),
            'surcharge_percentage': float(settings.surcharge_percentage),
        }
    except BillingSettings.DoesNotExist:
        # Defaults if settings not configured
        settings_data = {
            'rate_per_unit': 6.50,
            'fixed_charge_per_kw': 50.00,
            'duty_percentage': 5.00,
            'phase_1_rent': 10.00,
            'phase_3_rent': 25.00,
            'surcharge_percentage': 2.00,
        }
        
    sync_data = {
        'version': 1,
        'exported_at': datetime.now().isoformat(),
        'readers': readers_data,
        'consumers': consumers_data,
        'settings': settings_data
    }
    
    response = HttpResponse(
        json.dumps(sync_data),
        content_type='application/json'
    )
    response['Content-Disposition'] = f'attachment; filename="eMeter_Sync_{datetime.now().strftime("%Y%m%d_%H%M")}.json"'
    return response
