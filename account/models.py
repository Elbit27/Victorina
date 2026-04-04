from django.db import models
from django.contrib.auth.models import AbstractUser

class Faculty(models.Model):
    name = models.CharField(max_length=255, verbose_name="Факультет")

    def __str__(self):
        return self.name

class Group(models.Model):
    name = models.CharField(max_length=50, verbose_name="Группа")
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name="groups")
    course = models.PositiveSmallIntegerField(verbose_name="Курс")

    def __str__(self):
        return f"{self.name} ({self.course} курс)"

class Department(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название кафедры")
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name="departments")

    def __str__(self):
        return f"{self.name} ({self.faculty.name})"

class Subject(models.Model):
    name = models.CharField(max_length=255, verbose_name="Предмет")

    def __str__(self):
        return self.name

class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Студент'),
        ('teacher', 'Преподаватель'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student', verbose_name="Роль")
    faculty = models.ForeignKey(Faculty, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Факультет")
    group = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Группа")
    subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Предмет')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Кафедра")

    groups = models.ManyToManyField(
        "auth.Group",
        related_name="custom_user_set",
        blank=True,
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        related_name="custom_user_permissions_set",
        blank=True,
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"