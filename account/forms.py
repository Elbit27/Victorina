from django import forms
from .models import User

class OnboardingForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['role', 'faculty', 'group', 'department', 'subject']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields:
            self.fields[field].required = False
            self.fields[field].widget.attrs.update({'class': 'form-control'})

    def clean(self):
        cleaned_data = super().clean()
        role = cleaned_data.get('role')

        if role == 'student':
            if not cleaned_data.get('group') or not cleaned_data.get('faculty'):
                raise forms.ValidationError("Студент должен выбрать факультет и группу.")
        elif role == 'teacher':
            if not cleaned_data.get('department') or not cleaned_data.get('subject'):
                raise forms.ValidationError("Преподаватель должен выбрать кафедру и предмет.")
        return cleaned_data