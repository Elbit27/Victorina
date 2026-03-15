from rest_framework import permissions
from rest_framework.viewsets import ModelViewSet
from . import serializers
from .models import Game
from django.shortcuts import render, get_object_or_404
from rest_framework.decorators import action
from rest_framework.response import Response
from .tasks import generate_quiz_async


def game_list(request):
    games = Game.objects.all()
    return render(request, 'game/GameList.html', {'games': games})

def play_game(request, game_id):
    game = Game.objects.get(id=game_id)
    # Мы передаем игру, а вопросы подтянем через сериализатор или прямо в шаблоне
    return render(request, 'game/PlayGame.html', {'game': game})

def ai_generate_page(request):
    return render(request, 'game/GenerateAI.html')

# Эта функция НУЖНА для отображения страницы конструктора
def game_manage_page(request, pk=None):
    game = None
    if pk:
        # Важно подтянуть вопросы и ответы сразу (prefetch_related), чтобы не тормозило
        game = get_object_or_404(Game.objects.prefetch_related('questions__answers'), pk=pk)

    return render(request, 'game/CreateUpdateGame.html', {'game': game})

class GameViewSet(ModelViewSet):
    queryset = Game.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_serializer_class(self):
        if self.action == 'generate_ai':
            return serializers.AIGenerateSerializer
        elif self.action in ('destroy', 'retrieve'):
            return serializers.GameDetailSerializer
        return serializers.GameSerializer

    def get_permissions(self):
        # удалять может только автор поста или админ
        if self.action in ('update', 'partial_update', 'destroy'):
            return [permissions.IsAdminUser(), ]
        return [permissions.IsAuthenticatedOrReadOnly(), ]

    @action(detail=False, methods=['post', 'get'], permission_classes=[permissions.IsAuthenticated])
    def generate_ai(self, request):
        if request.method == 'GET':
            return Response({"message": "Введите тему и количество вопросов для фоновой генерации"})

        input_serializer = serializers.AIGenerateSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(input_serializer.errors, status=400)

        topic = input_serializer.validated_data.get('topic')
        count = input_serializer.validated_data.get('count')

        try:
            generate_quiz_async.delay(topic, count, request.user.id)

            return Response({
                "message": "Генерация теста началась в фоновом режиме.",
                "details": f"Тема: {topic}. Как только ИИ закончит, тест появится в вашем списке."
            }, status=202)  # 202 Accepted — стандарт для фоновых задач

        except Exception as e:
            return Response({"error": f"Не удалось запустить задачу: {str(e)}"}, status=500)