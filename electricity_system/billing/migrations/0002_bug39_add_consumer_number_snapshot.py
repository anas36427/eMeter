"""
BUG-39 FIX — Add consumer_number_snapshot to the Bill model.

This field was referenced in api_get_bill_pdf (views.py line 1849) but
never declared in the model, causing AttributeError on every finalized
bill PDF download.

Run:  python manage.py migrate billing
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='bill',
            name='consumer_number_snapshot',
            field=models.CharField(
                blank=True,
                max_length=50,
                null=True,
                help_text='Consumer number captured at finalization time. Immutable once written.',
            ),
        ),
    ]
