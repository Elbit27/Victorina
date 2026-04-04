from django.db import models
from django.conf import settings


class Campus(models.Model):
    number = models.CharField(max_length=27, verbose_name="Корпус")

    def __str__(self):
        return self.number


class Room(models.Model):
    number = models.CharField(max_length=999, verbose_name="Номер аудитории")
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name="rooms")

    def __str__(self):
        return f"{self.number} ({self.campus.number})"


class Lesson(models.Model):
    DAYS_OF_WEEK = (
        (1, 'Понедельник'),
        (2, 'Вторник'),
        (3, 'Среда'),
        (4, 'Четверг'),
        (5, 'Пятница'),
        (6, 'Суббота'),
    )

    LESSON_TIMES = (
        (1, '08:00 – 09:20'),
        (2, '09:30 – 10:50'),
        (3, '11:00 – 12:20'),
        (4, '12:30 – 13:50'),
    )

    subject = models.ForeignKey('users.Subject', on_delete=models.CASCADE, verbose_name="Предмет")
    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                limit_choices_to={'role': 'teacher'}, verbose_name="Преподаватель")
    group = models.ForeignKey('users.Group', on_delete=models.CASCADE, verbose_name="Группа")
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, verbose_name="Кабинет")

    # Время
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK, verbose_name="День недели")
    lesson_number = models.IntegerField(choices=LESSON_TIMES, verbose_name="Пара №")

    class Meta:
        verbose_name = "Занятие"
        verbose_name_plural = "Занятия"
        # Чтобы нельзя было поставить две разные пары в один кабинет в одно время
        unique_together = ('room', 'day_of_week', 'lesson_number')

    def __str__(self):
        return f"{self.get_day_of_week_display()} | Пара №{self.lesson_number} | {self.subject.name}"