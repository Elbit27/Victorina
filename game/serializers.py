from rest_framework import serializers
from .models import Game, Question, Answer
import json

class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['text', 'is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True)

    class Meta:
        model = Question
        fields = ['text', 'image', 'answers']


class GameSerializer(serializers.ModelSerializer):
    # Добавляем required=False, чтобы валидатор не ругался раньше времени
    questions = QuestionSerializer(many=True, required=False)

    class Meta:
        model = Game
        fields = ['id', 'title', 'questions']

    def to_internal_value(self, data):
        # Нам нужно превратить QueryDict в обычный dict, если это FormData
        if hasattr(data, 'dict'):
            data = data.dict()

        questions_json = data.get('questions_json')

        if questions_json:
            try:
                # Если пришла строка, парсим её
                if isinstance(questions_json, str):
                    decoded_questions = json.loads(questions_json)
                else:
                    decoded_questions = questions_json

                # Создаем копию, чтобы не менять оригинальный запрос
                mutable_data = data.copy()
                mutable_data['questions'] = decoded_questions

                # Теперь вызываем супер-метод с УЖЕ подставленными вопросами
                return super().to_internal_value(mutable_data)
            except (json.JSONDecodeError, TypeError):
                raise serializers.ValidationError({"questions_json": "Invalid JSON format"})

        return super().to_internal_value(data)

    def create(self, validated_data):
        request = self.context.get('request')
        # ВАЖНО: берем вопросы из validated_data, если они там есть после to_internal_value
        questions_data = validated_data.pop('questions', [])

        # Если validated_data пуст (например, пришел только JSON строку),
        # пробуем достать напрямую из request
        if not questions_data and request:
            raw_q = request.data.get('questions_json')
            if raw_q:
                questions_data = json.loads(raw_q) if isinstance(raw_q, str) else raw_q

        game = Game.objects.create(
            title=validated_data.get('title', 'Новая игра'),
            created_by=request.user if request else None
        )

        for index, q_data in enumerate(questions_data):
            # Картинка ищется в FILES
            image_file = request.FILES.get(f'image_{index}') if request else None

            question = Question.objects.create(
                game=game,
                text=q_data.get('text'),
                image=image_file
            )

            # Ответы могут быть в q_data['answers']
            answers_data = q_data.get('answers', [])
            for a_data in answers_data:
                Answer.objects.create(question=question, **a_data)

        return game

    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions')
        instance.title = validated_data.get('title', instance.title)
        instance.save()

        instance.questions.all().delete()
        for question_data in questions_data:
            answers_data = question_data.pop('answers')
            question = Question.objects.create(game=instance, **question_data)
            for answer_data in answers_data:
                Answer.objects.create(question=question, **answer_data)

        return instance

class GameDetailSerializer(serializers.ModelSerializer):
    created_by = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = Game
        fields = '__all__'


class AIGenerateSerializer(serializers.Serializer):
    # Эти поля появятся в интерфейсе DRF как текстовое поле и число
    topic = serializers.CharField(
        max_length=255,
        required=True,
        label="Тема викторины",
        help_text="Например: История Древнего Рима"
    )
    count = serializers.IntegerField(
        default=5,
        min_value=1,
        max_value=20,
        label="Количество вопросов"
    )