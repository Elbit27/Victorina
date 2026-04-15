from celery import shared_task
from .ai_services import generate_game_data
from .models import Game, Question, Answer
from django.contrib.auth import get_user_model
import random
from core.models import Notification

User = get_user_model()

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=5 # подождать 5 секунд перед повтором
)
def generate_game_async(self, topic, count, user_id):
    print(f"--- [START] Фоновая генерация для пользователя {user_id} ---")
    try:
        # 1. Запрос к Gemini
        data = generate_game_data(topic, count)
        user = User.objects.get(id=user_id)

        # 2. Создаем игру (пока is_active=False)
        game = Game.objects.create(
            title=data.get('title', topic),
            created_by=user,
            is_active=False  # Пока не созданы вопросы, игра скрыта
        )

        print(f"Игра создана (ID: {game.id}). Начинаю сохранение вопросов...")

        # 3. Сохраняем вопросы и ответы
        for q_data in data['questions']:
            question = Question.objects.create(
                game=game,  # Связь с моделью Game
                text=q_data['text']
            )
            answers_list = q_data['answers']
            random.shuffle(answers_list)
            check_order = [a['is_correct'] for a in answers_list]
            print(f"--- ПРОВЕРКА ПОРЯДКА: {check_order} ---")

            for a_data in q_data['answers']:
                Answer.objects.create(
                    question=question,
                    text=a_data['text'],
                    is_correct=a_data['is_correct']
                )

        game.is_active = True
        game.save()

        print(f"--- [SUCCESS] Игра готова! PIN-код: {game.pin_code} ---")
        Notification.objects.create(
            user=user,
            message=f"Ваша игра '{game.title}' готова! PIN: {game.pin_code}"
        )
        return f"Успех: {game.title} (PIN: {game.pin_code})"

    except User.DoesNotExist:
        return f"Ошибка: Пользователь с ID {user_id} не найден"
    except Exception as e:
        print(f"--- [ERROR] Попытка {self.request.retries}: {str(e)} ---")
        return f"Ошибка при генерации: {str(e)}"