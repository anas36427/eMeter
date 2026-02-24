from django.urls import path
from . import views
from .views import get_messages


urlpatterns = [
    
    
    # Authentication
    path('', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard, name='dashboard'),
    
    # Admin URLs
    path('admin/', views.admin_dashboard, name='admin_dashboard'),
    path('admin/consumers/', views.manage_consumers, name='manage_consumers'),
    path('admin/consumers/add/', views.add_consumer, name='add_consumer'),
    path('admin/bills/generate/', views.generate_bill, name='generate_bill'),
    path('admin/readings/', views.meter_readings, name='meter_readings'),
    path('admin/bills/', views.bills, name='bills'),
    path('admin/payments/', views.payments, name='payments'),
    path('api/messages/', get_messages),

    # Consumer URLs
    path('consumer/', views.consumer_dashboard, name='consumer_dashboard'),
    path('consumer/bills/', views.consumer_bills, name='consumer_bills'),
    path('consumer/pay/<int:bill_id>/', views.make_payment, name='make_payment'),
    
    # Meter Reader URLs
    path('reader/', views.meter_reader_dashboard, name='meter_reader_dashboard'),
    path('reader/submit/', views.submit_reading, name='submit_reading'),
    
    # API URLs
    path('api/consumer/<int:consumer_id>/', views.api_get_consumer, name='api_get_consumer'),
    path('api/bill/<int:bill_id>/', views.api_get_bill, name='api_get_bill'),
    path('api/calculate-bill/', views.api_calculate_bill, name='api_calculate_bill'),
    path('api/consumers/', views.api_consumer_list, name='api_consumer_list'),
    path('api/bills/', views.api_bills_list, name='api_bills_list'),
    path('api/submit-reading/', views.api_submit_reading, name='api_submit_reading'),

    # Serve SPA
    path('app/', views.spa_index, name='spa_index'),

    #Generate PDF bill
    # path('consumer/bills/<int:bill_id>/pdf/', views.generate_pdf_bill, name='generate_pdf_bill'),
    path('bill/<int:bill_id>/pdf/', views.download_bill_pdf, name='download_bill_pdf'),
    path('generate-bill/', views.generate_bill, name='generate_bill'),
]

