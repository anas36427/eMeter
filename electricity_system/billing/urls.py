from django.urls import path, re_path
from . import views
from .views import get_messages


urlpatterns = [
    
    
    # Authentication
    # React SPA - Primary Web Interface
    path('', views.spa_index, name='index'),
    
    # Authentication (API)
    path('api/login/', views.api_login, name='api_login'),
    path('api/me/', views.api_me, name='api_me'),
    
    # Legacy Authentication & Dashboard (kept for fallback)
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard, name='dashboard'),
    
    # Admin URLs
    path('admin/', views.admin_dashboard, name='admin_dashboard'),
    path('admin/consumers/', views.manage_consumers, name='manage_consumers'),
    path('admin/consumers/partial/', views.manage_consumers, name='manage_consumers_partial'),
    path('admin/consumers/add/', views.add_consumer, name='add_consumer'),
    path('admin/bills/generate/', views.generate_bill, name='generate_bill'),
    path('admin/readings/', views.meter_readings, name='meter_readings'),
    path('admin/bills/', views.bills, name='bills'),
    path('admin/bills/partial/', views.bills, name='bills_list_partial'),
    path('admin/payments/', views.payments, name='payments'),
    path('api/messages/', get_messages),

    # Consumer URLs
    path('consumer/', views.consumer_dashboard, name='consumer_dashboard'),
    path('consumer/bills/', views.consumer_bills, name='consumer_bills'),
    path('consumer/pay/<int:bill_id>/', views.make_payment, name='make_payment'),
    path('bill/<int:bill_id>/details/', views.bill_details_partial, name='bill_details_partial'),
    
    # Meter Reader URLs
    path('reader/', views.meter_reader_dashboard, name='meter_reader_dashboard'),
    path('reader/submit/', views.submit_reading, name='submit_reading'),
    
    # API URLs
    path('api/consumers/', views.api_consumer_list, name='api_consumer_list'),
    path('api/consumers/<int:consumer_id>/', views.api_consumer_detail, name='api_consumer_detail'),
    path('api/consumers/search/', views.api_consumer_search, name='api_consumer_search'),
    
    # Singular aliases for Mobile App
    path('api/consumer/<int:consumer_id>/', views.api_consumer_detail, name='api_get_consumer'),
    path('api/bill/<int:bill_id>/', views.api_bill_detail, name='api_get_bill'),
    
    path('api/bills/', views.api_bills_list, name='api_bills_list'),
    path('api/bills/<int:bill_id>/', views.api_bill_detail, name='api_bill_detail'),
    path('api/bills/<int:bill_id>/mark-paid/', views.api_mark_bill_paid, name='api_mark_bill_paid'),
    path('api/bills/<int:bill_id>/mark-unpaid/', views.api_mark_bill_unpaid, name='api_mark_bill_unpaid'),
    
    path('api/readings/', views.api_readings_list, name='api_readings_list'),
    path('api/submit-reading/', views.api_submit_reading, name='api_submit_reading'), # Kept for backward compatibility
    
    path('api/calculate-bill/', views.api_calculate_bill, name='api_calculate_bill'),
    path('api/dashboard-stats/', views.api_dashboard_stats, name='api_dashboard_stats'),
    path('api/logout/', views.api_logout, name='api_logout'),

    # Serve SPA
    path('app/', views.spa_index, name='spa_index'),

    #Generate PDF bill
    # path('consumer/bills/<int:bill_id>/pdf/', views.generate_pdf_bill, name='generate_pdf_bill'),
    path('bill/<int:bill_id>/pdf/', views.download_bill_pdf, name='download_bill_pdf'),
    path('generate-bill/', views.generate_bill, name='generate_bill'),



    # Mobile App API endpoints
    path('api/reading-and-bill/', views.api_submit_reading_and_generate_bill, name='api_reading_and_bill'),
    path('api/send-bill-sms/', views.api_send_bill_sms, name='api_send_bill_sms'),
    path('api/edit-reading/<int:reading_id>/', views.api_edit_today_reading, name='api_edit_today_reading'),
    path('api/settings/', views.api_get_settings, name='api_get_settings'),
    path('api/settings/update/', views.api_update_settings, name='api_update_settings'),

    path('api/csrf/', views.get_csrf),

    # Catch-all for React Client-side routing
    re_path(r'^.*$', views.spa_index),
]