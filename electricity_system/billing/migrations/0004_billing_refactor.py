from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0003_message'),
    ]

    operations = [
        migrations.AddField(
            model_name='bill',
            name='arrears',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='bill',
            name='duty_charge',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='bill',
            name='late_payment_surcharge',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='bill',
            name='meter_rent',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='bill',
            name='regulatory_surcharge',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='consumer',
            name='load_kw',
            field=models.FloatField(default=1.0, help_text='Connected load in Kilowatts'),
        ),
        migrations.AddField(
            model_name='consumer',
            name='meter_type',
            field=models.CharField(choices=[('10', 'Standard (10)'), ('25', 'Enhanced (25)')], default='10', max_length=20),
        ),
        migrations.AlterField(
            model_name='bill',
            name='fixed_charges',
            field=models.FloatField(default=0),
        ),
        migrations.AlterField(
            model_name='bill',
            name='rate_per_unit',
            field=models.FloatField(default=8.56),
        ),
    ]
