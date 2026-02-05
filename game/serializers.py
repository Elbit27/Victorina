from rest_framework import serializers
from .models import Question, Answer, Game

class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ("id", "text", "is_correct")


class QuestionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True)

    class Meta:
        model = Question
        fields = ("id", "text", "order", "answers")

    def validate_answers(self, answers):
        correct = [a for a in answers if a.get("is_correct")]
        if len(correct) != 1:
            raise serializers.ValidationError(
                "Должен быть ровно один правильный ответ"
            )
        return answers

    def create(self, validated_data):
        answers_data = validated_data.pop("answers")
        question = Question.objects.create(**validated_data)

        for answer_data in answers_data:
            Answer.objects.create(question=question, **answer_data)

        return question

class GameSerializer(serializers.ModelSerializer):
    owner_username = serializers.ReadOnlyField(source="owner.username")
    questions = QuestionSerializer(many=True, required=False)

    class Meta:
        model = Game
        fields = ("id", "owner_username", "title", "questions")

    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        game = Game.objects.create(
            created_by=self.context["request"].user,
            **validated_data
        )

        for q_data in questions_data:
            answers = q_data.pop("answers")
            question = Question.objects.create(game=game, **q_data)

            for a in answers:
                Answer.objects.create(question=question, **a)

        return game


