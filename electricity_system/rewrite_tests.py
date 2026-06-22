import os

path = '/Users/anasahmad/Documents/eMeter.web/electricity_system/billing/tests.py'
with open(path, 'r') as f:
    content = f.read()

content = content.replace("status='finalized'", "status='issued'")
content = content.replace("status='draft'", "status='draft'") # leave as is

content = content.replace('billing_period', 'billing_period_start')

with open(path, 'w') as f:
    f.write(content)
print("done")
