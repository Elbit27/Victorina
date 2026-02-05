from django.contrib import admin
from .models import Game, Question, Answer

admin.site.register(Game)
admin.site.register(Question)
admin.site.register(Answer)