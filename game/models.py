from django.conf import settings
from django.db import models
from django.contrib.auth.models import User
import random
import string


class Game(models.Model):
    title = models.CharField(max_length=255)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="games"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    pin_code = models.CharField(max_length=6, unique=True, blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.pin_code:
            self.pin_code = self.generate_unique_pin()
        super().save(*args, **kwargs)

    def generate_unique_pin(self):
        while True:
            code = ''.join(random.choices(string.digits, k=6))
            if not Game.objects.filter(pin_code=code).exists():
                return code

    def __str__(self):
        # Теперь в админке будет: "История Рима (Код: 123456) | Автор: admin"
        status = "✅" if self.is_active else "⏳"
        return f"{status} {self.title} (Код: {self.pin_code}) | Автор: {self.created_by.username}"


class Question(models.Model):
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="questions"
    )
    text = models.TextField()
    image = models.ImageField(upload_to='questions/', blank=True, null=True)

    def __str__(self):
        # Показываем, к какому квизу относится вопрос
        return f"Вопрос из '{self.game.title}': {self.text[:30]}..."


class Answer(models.Model):
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name="answers"
    )
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        mark = "✔" if self.is_correct else "✖"
        return f"{mark} {self.text}"

class Team(models.Model):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=100)
    score = models.IntegerField(default=0)

    def __str__(self): # Было __clans__
        return f"{self.name} (Игра: {self.game.title})"

class Player(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    game = models.ForeignKey(Game, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True)