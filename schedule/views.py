from django.shortcuts import render
from .models import Lesson

def schedule_view(request):
    # Получаем все занятия для группы текущего студента
    # Если это преподаватель — фильтруем по teacher=request.user
    user = request.user
    if user.role == 'student':
        lessons = Lesson.objects.filter(group=user.group).select_related('subject', 'teacher', 'room__campus')
    else:
        lessons = Lesson.objects.filter(teacher=user).select_related('subject', 'group', 'room__campus')

    # Группируем по дням недели (1-6)
    days = {i: [] for i in range(1, 7)}
    for lesson in lessons:
        days[lesson.day_of_week].append(lesson)

    return render(request, 'schedule/schedule.html', {'schedule': days})