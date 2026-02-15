from rest_framework import serializers
from .models import Game, Question, Answer
from django.db import transaction


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
        fields = ['title', 'questions']

    def create(self, validated_data):
        questions_data = validated_data.pop('questions')
        # Создаем игру
        game = Game.objects.create(**validated_data)

        # Создаем вопросы и ответы
        for q_data in questions_data:
            answers_data = q_data.pop('answers')
            question = Question.objects.create(game=game, **q_data)
            for a_data in answers_data:
                Answer.objects.create(question=question, **a_data)
        return game

    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions')
        instance.title = validated_data.get('title', instance.title)
        instance.save()

        # Простой способ обновления вложенных данных:
        # Удаляем старые вопросы и создаем новые
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
