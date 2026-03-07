from rest_framework import serializers
from .models import Game, Question, Answer


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['text', 'is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True)

    class Meta:
        model = Question
        fields = ['text', 'answers']


class GameSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True)

    class Meta:
        model = Game
        fields = ['id', 'title', 'questions']

    def create(self, validated_data):
        questions_data = validated_data.pop('questions')

        # Защита: если request почему-то не пришел, берем None
        request = self.context.get('request')
        user = request.user if request else None

        game = Game.objects.create(created_by=user, **validated_data)

        for q_data in questions_data:
            # Извлекаем ответы из данных вопроса
            answers_data = q_data.pop('answers')
            question = Question.objects.create(game=game, **q_data)

            # Создаем объекты ответов
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