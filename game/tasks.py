from celery import shared_task
from .ai_services import generate_quiz_data
from .models import Game, Question, Answer
from django.contrib.auth import get_user_model

User = get_user_model()

from django.contrib.auth import get_user_model

User = get_user_model()


@shared_task
def generate_quiz_async(topic, count, user_id):
    print(f"--- [START] Генерация для пользователя {user_id} ---")
    try:
        # Получаем данные от ИИ
        data = generate_quiz_data(topic, count)
        user = User.objects.get(id=user_id)

        # Создаем игру
        quiz = Game.objects.create(
            title=data.get('title', topic),
            created_by=user,  # Теперь имя поля совпадает с моделью
            is_active=True  # Сразу активируем, если нужно
        )
        print(f"--- Игра '{quiz.title}' создана успешно! ---")

        # 4. Сохраняем вопросы и ответы
        for q_data in data['questions']:
            question = Question.objects.create(
                game=quiz,
                text=q_data['text']
            )
            for a_data in q_data['answers']:
                Answer.objects.create(
                    question=question,
                    text=a_data['text'],
                    is_correct=a_data['is_correct']
                )

        return f"Успех: {quiz.title} создан для {user.username}"

    except User.DoesNotExist:
        return f"Ошибка: Пользователь с ID {user_id} не найден"
    except Exception as e:
        print(f"--- [ERROR] {str(e)} ---")
        return f"Ошибка при генерации: {str(e)}"