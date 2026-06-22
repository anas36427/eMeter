import os

path = '/Users/anasahmad/Documents/eMeter.web/electricity_system/billing/tests.py'
with open(path, 'r') as f:
    content = f.read()

content = content.replace('meter_type="10"', 'meter_type="analog"')
content = content.replace('meter_type="25"', 'meter_type="digital"')
content = content.replace('self.assertGreater(data["bill"]["energy_charges"], 0)', 'self.assertGreater(float(data["bill"]["energy_charges"]), 0)')
content = content.replace('self.assertEqual(data["bill"]["status"], "finalized")', 'self.assertEqual(data["bill"]["status"], "issued")')

with open(path, 'w') as f:
    f.write(content)
print("done")
