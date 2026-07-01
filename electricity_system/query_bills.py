import os
import django
from django.test import RequestFactory

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "electricity_system.settings")
django.setup()

from billing.models import Bill, Consumer, User
from billing.views import consumer_portal_bills

factory = RequestFactory()
request = factory.get('/consumer/portal/bills/?page_size=100')
request.user = User.objects.get(username='12346')
response = consumer_portal_bills(request)
import json
print(json.loads(response.content.decode()))
