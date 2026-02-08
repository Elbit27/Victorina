from django.shortcuts import render
from django.views import generic
from .models import Game
from .serializers import GameSerializer
import json
from django.http import JsonResponse

def game_list(request):
    games = Game.objects.all()
    return render(request, 'game/GameList.html', {'games': games})

def play_game(request, game_id):
    game = Game.objects.get(id=game_id)
    # Мы передаем игру, а вопросы подтянем через сериализатор или прямо в шаблоне
    return render(request, 'game/PlayGame.html', {'game': game})

class GameCreateView(generic.CreateView):
    template_name = 'game/CreateGame.html'

    def get(self, request, *args, **kwargs):
        return render(request, self.template_name)

    def post(self, request, *args, **kwargs):
        # Если данные пришли как JSON (от нашего Fetch)
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
                print("Received JSON data:", data)  # Теперь тут будет порядок

                serializer = GameSerializer(data=data, context={'request': request})

                if serializer.is_valid():
                    game = serializer.save()
                    # Возвращаем JSON с URL, куда перенаправить
                    return JsonResponse({'status': 'success', 'redirect_url': '/'}, status=201)
                else:
                    return JsonResponse(serializer.errors, status=400)
            except json.JSONDecodeError:
                return JsonResponse({'error': 'Invalid JSON'}, status=400)

        # Если вдруг пришла обычная форма (fallback)
        return super().post(request, *args, **kwargs)