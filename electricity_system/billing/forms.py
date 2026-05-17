from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserCreationForm
from .models import Consumer, MeterReading, Bill, Payment

User = get_user_model()

class ConsumerRegistrationForm(forms.ModelForm):
    """Form for creating new consumers"""
    username = forms.CharField(max_length=150, required=True)
    email = forms.EmailField(required=True)
    password = forms.CharField(widget=forms.PasswordInput, required=True)
    password_confirm = forms.CharField(widget=forms.PasswordInput, required=True)
    
    class Meta:
        model = Consumer
        fields = ['consumer_number', 'name', 'email', 'phone', 'address', 
                  'meter_number', 'connection_type']
    
    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_confirm = cleaned_data.get('password_confirm')
        
        if password and password_confirm and password != password_confirm:
            raise forms.ValidationError("Passwords don't match")
        
        if User.objects.filter(username=cleaned_data.get('username')).exists():
            raise forms.ValidationError("Username already exists")
        
        if User.objects.filter(email=cleaned_data.get('email')).exists():
            raise forms.ValidationError("Email already exists")
        
        return cleaned_data


class ConsumerForm(forms.ModelForm):
    """Form for updating consumer information"""
    class Meta:
        model = Consumer
        fields = ['name', 'email', 'phone', 'address', 'meter_number', 
                  'connection_type', 'status']


class MeterReadingForm(forms.ModelForm):
    """Form for submitting meter readings"""
    class Meta:
        model = MeterReading
        fields = ['consumer', 'previous_reading', 'current_reading', 
                  'reading_date', 'reading_time', 'meter_image', 'remarks']
        widgets = {
            'reading_date': forms.DateInput(attrs={'type': 'date'}),
            'reading_time': forms.TimeInput(attrs={'type': 'time'}),
            'consumer': forms.Select(attrs={'class': 'form-select'}),
            'previous_reading': forms.NumberInput(attrs={'class': 'form-control', 'readonly': True}),
            'current_reading': forms.NumberInput(attrs={'class': 'form-control', 'required': True}),
            'remarks': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }


class BillForm(forms.ModelForm):
    """Form for generating bills"""
    class Meta:
        model = Bill
        fields = ['consumer', 'meter_reading', 'units', 'rate_per_unit', 
                  'fixed_charges', 'billing_period', 'due_date']
        widgets = {
            'billing_period': forms.DateInput(attrs={'type': 'month'}),
            'due_date': forms.DateInput(attrs={'type': 'date'}),
            'units': forms.NumberInput(attrs={'class': 'form-control'}),
            'rate_per_unit': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'fixed_charges': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'consumer': forms.Select(attrs={'class': 'form-select'}),
            'meter_reading': forms.Select(attrs={'class': 'form-select'}),
        }


class PaymentForm(forms.ModelForm):
    """Form for processing payments"""
    class Meta:
        model = Payment
        fields = ['bill', 'amount', 'payment_method', 'transaction_id']
        widgets = {
            'bill': forms.Select(attrs={'class': 'form-select'}),
            'amount': forms.NumberInput(attrs={'class': 'form-control', 'readonly': True}),
            'payment_method': forms.Select(attrs={'class': 'form-select'}),
            'transaction_id': forms.TextInput(attrs={'class': 'form-control'}),
        }


class LoginForm(forms.Form):
    """Form for user login"""
    username = forms.CharField(max_length=150, required=True, 
                               widget=forms.TextInput(attrs={
                                   'class': 'form-control',
                                   'placeholder': 'Enter your username'
                               }))
    password = forms.CharField(required=True,
                               widget=forms.PasswordInput(attrs={
                                   'class': 'form-control',
                                   'placeholder': 'Enter your password'
                               }))


class UserRoleForm(forms.ModelForm):
    """Form for updating a user's role (replaces the old UserProfileForm)."""
    class Meta:
        model = User
        fields = ['role']
        widgets = {
            'role': forms.Select(attrs={'class': 'form-select'}),
        }


class UserCreationFormExtended(UserCreationForm):
    """Extended user creation form with role selection"""
    email = forms.EmailField(required=True)
    role = forms.ChoiceField(choices=User.Role.choices, required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password1', 'password2', 'role']

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        user.role  = self.cleaned_data['role']
        if commit:
            user.save()
        return user
