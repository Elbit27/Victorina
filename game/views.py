from rest_framework import permissions
from rest_framework.viewsets import ModelViewSet
from . import serializers
from .models import Game
from django.shortcuts import render, get_object_or_404
from rest_framework.decorators import action
from rest_framework.response import Response
from .ai_services import generate_quiz_data


def game_list(request):
    games = Game.objects.all()
    return render(request, 'game/GameList.html', {'games': games})

def play_game(request, game_id):
    game = Game.objects.get(id=game_id)
    # Мы передаем игру, а вопросы подтянем через сериализатор или прямо в шаблоне
    return render(request, 'game/PlayGame.html', {'game': game})



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
            return Response({"message": "Введите тему и количество вопросов"})

        input_serializer = serializers.AIGenerateSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(input_serializer.errors, status=400)

        topic = input_serializer.validated_data.get('topic')
        count = input_serializer.validated_data.get('count')

        try:
            ai_data = generate_quiz_data(topic, count=count)
            print(f"DEBUG AI DATA: {ai_data}")

            save_serializer = serializers.GameSerializer(
                data=ai_data,
                context={'request': request}
            )

            if save_serializer.is_valid():
                save_serializer.save()
                return Response(save_serializer.data, status=201)

            return Response({
                "error": "ИИ создал данные, которые не подходят для GameSerializer",
                "details": save_serializer.errors
            }, status=400)

        except Exception as e:
            return Response({"error": str(e)}, status=500)