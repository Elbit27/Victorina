from django.urls import re_path
from .consumers import GameConsumer
from .consumers import GameConsumer

websocket_urlpatterns = [
    # Маршрут для игры: ws/game/ID_ИГРЫ/
    re_path(r'ws/game/(?P<game_id>\d+)/$', GameConsumer.as_asgi()),
]