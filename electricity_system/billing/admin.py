from django.contrib import admin
from .models import Consumer, MeterReading, Bill

admin.site.register(Consumer)
admin.site.register(MeterReading)
admin.site.register(Bill)
