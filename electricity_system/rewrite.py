import os

path = '/Users/anasahmad/Documents/eMeter.web/electricity_system/billing/views.py'
with open(path, 'r') as f:
    content = f.read()

# Make sure we don't break 'billing_period_start'
content = content.replace('billing_period_start', 'REPLACE_ME_BPSTART')
content = content.replace('billing_period_end', 'REPLACE_ME_BPEND')
content = content.replace('billing_period', 'billing_period_start')

# Restore the correct ones
content = content.replace('REPLACE_ME_BPSTART', 'billing_period_start')
content = content.replace('REPLACE_ME_BPEND', 'billing_period_end')

with open(path, 'w') as f:
    f.write(content)
print("done")
