from django.conf import settings
from django.db import models


class Game(models.Model):
    title = models.CharField(max_length=255)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="games"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False)

    def __str__(self):
        return self.title


class Question(models.Model):
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="questions"
    )
    text = models.TextField()
    order = models.PositiveIntegerField(default=1)

    def __str__(self):
        return self.text[:50]


class Answer(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="answers"
    )
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text
