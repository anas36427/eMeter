from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', 'test_agent_write'),
    ]

    operations = [
        migrations.CreateModel(
            name='BillingSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rate_per_unit', models.FloatField(default=8.56)),
                ('fixed_charge_per_kw', models.FloatField(default=400.0)),
                ('phase_1_rent', models.FloatField(default=10.0)),
                ('phase_3_rent', models.FloatField(default=25.0)),
                ('duty_percentage', models.FloatField(default=7.5)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name_plural': 'Billing Settings',
            },
        ),
    ]
