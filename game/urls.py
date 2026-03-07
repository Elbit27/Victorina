# game/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
# Меняем 'games' на пустую строку ''
router.register(r'', views.GameViewSet, basename='game')

urlpatterns = [
    path('manage/', views.game_manage_page, name='game-create'),
    path('manage/<int:pk>/', views.game_manage_page, name='game-update'),
    path('game_list/', views.game_list, name='game-list-html'),
    path('play_game/<int:game_id>/', views.play_game, name='play_game'),

    # Теперь API будет доступно по адресу /game/ и /game/generate_ai/
    path('', include(router.urls)),
]