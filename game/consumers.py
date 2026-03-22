import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import Team


class GameConsumer(AsyncWebsocketConsumer):
    room_states = {}
    async def connect(self):
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.room_group_name = f'game_{self.game_id}'
        self.user = self.scope["user"]

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # ВАЖНО: Создаем игрока в БД сразу при входе, если его там нет
        if self.user.is_authenticated:
            await database_sync_to_async(self.ensure_player_exists)()

        # Теперь рассылаем обновление — теперь ты точно будешь в списке
        await self.broadcast_room_update()

    def ensure_player_exists(self):
        from .models import Player
        # Проверяем, есть ли уже такой игрок в этой игре
        Player.objects.get_or_create(user=self.user, game_id=self.game_id)

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'create_team':
            team_name = data.get('name')
            # Создаем команду в БД
            await database_sync_to_async(Team.objects.create)(
                game_id=self.game_id,
                name=team_name
            )
            await self.broadcast_room_update()

        elif action == 'join_team':
            team_id = data.get('team_id')
            # Сохраняем выбор в БД (метод ниже)
            await database_sync_to_async(self.update_player_team)(team_id)
            await self.broadcast_room_update()

        elif action == 'delete_team':
            # Проверка прав (только для админов)
            if self.user.is_staff or self.user.is_superuser:
                team_id = data.get('team_id')
                await database_sync_to_async(self.perform_delete_team)(team_id)
                # После удаления рассылаем всем актуальный список (уже без этой команды)
                await self.broadcast_room_update()

        if action == 'start_game':
            if self.user.is_staff or self.user.is_superuser:
                # Инициализируем чистое состояние игры
                self.room_states[self.room_group_name] = {
                    'current_idx': 0,
                    'scores': {},
                    'player_scores': {},
                    'blocked_teams': [],
                    'game_active': True
                }
                await self.channel_layer.group_send(
                    self.room_group_name, {'type': 'game_start_broadcast'}
                )

        elif action == 'submit_answer':
            state = self.room_states.get(self.room_group_name)
            if not state or not state.get('game_active'):
                return

            # Получаем актуальные данные о командах и игроке
            lobby_data = await database_sync_to_async(self.get_lobby_data)()
            user_info = lobby_data['players'].get(self.user.username, {})

            # ВАЖНО: Работаем с ID как со строкой для Redis
            team_id = str(user_info.get('team_id')) if user_info.get('team_id') else None

            # Проверка: если игрок без команды или команда заблокирована — игнорим клик
            if not team_id or team_id in state['blocked_teams']:
                return

            is_correct = data.get('is_correct')
            total_q = data.get('total_questions', 10)

            if is_correct:
                # 1. Начисляем очки команде (строковый ключ!)
                state['scores'][team_id] = state['scores'].get(team_id, 0) + 1

                # 2. Личная статистика игрока
                username = self.user.username
                state['player_scores'][username] = state['player_scores'].get(username, 0) + 1

                # 3. Кто-то ответил верно -> разблокируем все команды для следующего вопроса
                state['blocked_teams'] = []

                # 4. Проверяем, не последний ли это вопрос
                if state['current_idx'] >= total_q - 1:
                    state['game_active'] = False
                    lobby_data = await database_sync_to_async(self.get_lobby_data)()
                    team_names = {str(t['id']): t['name'] for t in lobby_data['teams']}
                    await self.channel_layer.group_send(self.room_group_name, {
                        'type': 'game_over_broadcast',
                        'scores': state['scores'],
                        'team_names': team_names,
                        'player_stats': state['player_scores']
                    })
                else:
                    state['current_idx'] += 1
                    await self.channel_layer.group_send(self.room_group_name, {
                        'type': 'next_question_broadcast',
                        'new_idx': state['current_idx'],
                        'new_scores': state['scores'],
                        'player_stats': state['player_scores']
                    })
            else:
                if team_id not in state['blocked_teams']:
                    state['blocked_teams'].append(team_id)

                # Если ВСЕ команды, которые сейчас есть в игре, заблокированы
                all_active_teams = [str(t['id']) for t in lobby_data['teams']]
                if len(state['blocked_teams']) >= len(all_active_teams):
                    # Разблокируем всех, чтобы не было тупика
                    state['blocked_teams'] = []
                    reset_all = True
                else:
                    reset_all = False

                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'team_blocked_broadcast',
                    'team': team_id,
                    'wrong_answer': data.get('answer_text'),
                    'reset_all': reset_all
                })


    # --- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (ВНЕ receive) ---

    def update_player_team(self, team_id):
        from .models import Team, Player
        try:
            team = Team.objects.get(id=team_id, game_id=self.game_id)

            # update_or_create — идеальный инструмент здесь.
            # Он найдет игрока в этой игре и просто заменит ему команду.
            Player.objects.update_or_create(
                user=self.user,
                game_id=self.game_id,
                defaults={'team': team}
            )
            print(f"✅ {self.user.username} перешел в {team.name}")
        except Team.DoesNotExist:
            print("⚠️ Команда не найдена")

    def perform_delete_team(self, team_id):
        from .models import Team
        try:
            team = Team.objects.get(id=team_id, game_id=self.game_id)
            team.delete()
            print(f"🗑 Команда {team_id} удалена админом {self.user.username}")
        except Team.DoesNotExist:
            pass

    async def broadcast_room_update(self):
        # Собираем данные из БД
        data = await database_sync_to_async(self.get_lobby_data)()

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'room_update_message',
                'players': data['players'],
                'teams': data['teams']  # Добавляем список команд!
            }
        )

    def get_lobby_data(self):
        from .models import Player, Team

        # 1. Собираем команды
        teams = Team.objects.filter(game_id=self.game_id)
        teams_list = [
            {'id': t.id, 'name': t.name} for t in teams
        ]

        # 2. Собираем игроков
        players = Player.objects.filter(game_id=self.game_id).select_related('team', 'user')
        players_dict = {
            p.user.username: {
                'team_name': p.team.name if p.team else "Без команды",
                'team_id': p.team.id if p.team else None
            } for p in players
        }

        return {'teams': teams_list, 'players': players_dict}

    # Не забудь обновить хендлер, чтобы он пробрасывал 'teams' в JS
    async def room_update_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'ROOM_UPDATE',
            'players': event['players'],
            'teams': event.get('teams', [])  # Получаем команды из события
        }))

    def get_current_players(self):
        # Собираем словарь { "username": {"team_name": "...", "team_id": ...} }
        from .models import Player
        players = Player.objects.filter(game_id=self.game_id).select_related('team', 'user')
        return {
            p.user.username: {
                'team_name': p.team.name if p.team else "Без команды",
                'team_id': p.team.id if p.team else None
            } for p in players
        }

    # --- ОБРАБОТЧИКИ СООБЩЕНИЙ ГРУППЫ (ХЕНДЛЕРЫ) ---

    async def room_update_message(self, event):
        # ПРОВЕРЬ ЭТУ СТРОКУ: мы должны отправить и игроков, и команды
        await self.send(text_data=json.dumps({
            'type': 'ROOM_UPDATE',
            'players': event.get('players', {}),
            'teams': event.get('teams', [])  # Если этого нет, JS нечего рисовать
        }))

    async def game_start_broadcast(self, event):
        await self.send(text_data=json.dumps({'type': 'GAME_START'}))

    async def team_blocked_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'TEAM_BLOCKED',
            'team': event['team'],
            'wrong_answer': event.get('wrong_answer')
        }))

    async def next_question_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'NEXT_QUESTION',
            'new_idx': event['new_idx'],
            'scores': event['new_scores'],
            'player_stats': event['player_stats']
        }))

    async def game_over_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'GAME_OVER',
            'scores': event['scores'],
            'team_names': event.get('team_names', {}),
            'player_stats': event['player_stats']
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)


