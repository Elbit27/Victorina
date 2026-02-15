from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'games', views.GameViewSet, basename='game')

urlpatterns = [
    # --- ТВОИ ШАБЛОНЫ (HTML) ---
    # Когда ты перейдешь по /manage/, Django увидит этот путь ПЕРВЫМ и отдаст шаблон
    path('manage/', views.game_manage_page, name='game-create'),
    path('manage/<int:pk>/', views.game_manage_page, name='game-update'),

    # Страница списка игр (если хочешь свой HTML, а не JSON список)
    path('game_list/', views.game_list, name='game-list-html'),
    path('play_game/<int:game_id>/', views.play_game, name='play_game'),

    path('', include(router.urls)),
]