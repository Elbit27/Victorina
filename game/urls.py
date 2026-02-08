from django.urls import path
from .views import GameCreateView, game_list, play_game

urlpatterns = [
    path('create_game/', GameCreateView.as_view(), name='create_game'),
    path('game_list/', game_list, name='game_list'),
    path('play_game/<int:game_id>/', play_game, name='play_game'),
]
