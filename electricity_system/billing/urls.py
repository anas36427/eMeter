from django.urls import path
from . import views

urlpatterns = [
    # Auth Endpoints
    path('login/', views.api_login, name='api_login'),
    path('me/', views.api_me, name='api_me'),
    path('logout/', views.api_logout, name='api_logout'),
    path('csrf/', views.get_csrf, name='api_csrf'),
    
    # Stats & Data
    path('dashboard-stats/', views.api_dashboard_stats, name='api_dashboard_stats'),
    path('reports-data/', views.api_reports_data, name='api_reports_data'),
    path('settings/', views.api_get_settings, name='api_get_settings'),
    path('settings/update/', views.api_update_settings, name='api_update_settings'),
    
    # Consumer Management
    path('consumers/', views.api_consumer_list, name='api_consumer_list'),
    path('consumers/<int:consumer_id>/', views.api_consumer_detail, name='api_consumer_detail'),
    path('consumers/search/', views.api_consumer_search, name='api_consumer_search'),
    path('consumer/<int:consumer_id>/', views.api_consumer_detail, name='api_get_consumer'),
    path('consumer/<int:consumer_id>/readings/', views.api_consumer_readings, name='api_consumer_readings'),
    
    # Reading & Billing
    path('readings/', views.api_readings_list, name='api_readings_list'),
    path('readings/import-excel/', views.api_import_readings, name='api_import_readings'),
    path('submit-reading/', views.api_submit_reading, name='api_submit_reading'),
    path('reading-and-bill/', views.api_submit_reading_and_generate_bill, name='api_reading_and_bill'),
    path('edit-reading/<int:reading_id>/', views.api_edit_today_reading, name='api_edit_today_reading'),
    
    # Bill Actions
    path('bills/', views.api_bills_list, name='api_bills_list'),
    path('bill/<int:bill_id>/', views.api_bill_detail, name='api_get_bill'),
    path('bill/<int:bill_id>/pdf/', views.api_get_bill_pdf, name='api_get_bill_pdf'),
    path('bills/<int:bill_id>/mark-paid/', views.api_mark_bill_paid, name='api_mark_bill_paid'),
    path('bills/<int:bill_id>/mark-unpaid/', views.api_mark_bill_unpaid, name='api_mark_bill_unpaid'),

    path('bills/manual-generate/', views.api_manual_generate_bill, name='api_manual_generate_bill'),
    
    path('send-bill-sms/', views.api_send_bill_sms, name='api_send_bill_sms'),
    path('calculate-bill/', views.api_calculate_bill, name='api_calculate_bill'),

    # Single Source of Truth: live estimate using DB BillingSettings (for mobile)
    path('calculate-estimate/', views.api_calculate_estimate, name='api_calculate_estimate'),
]