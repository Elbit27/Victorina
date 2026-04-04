from django.contrib import admin
from .models import Faculty, Group, Department, Subject, User

admin.site.register(User)
admin.site.register(Faculty)
admin.site.register(Group)
admin.site.register(Department)
admin.site.register(Subject)
