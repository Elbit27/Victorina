from django.urls import path
from .views import GameCreateView, create_game

urlpatterns = [
    path('create_game/', GameCreateView.as_view(), name='create_game'),
]
