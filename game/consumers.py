import json
from django.core.cache import cache
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import Team


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.room_group_name = f'game_{self.game_id}'
        self.cache_key = f'game_state_{self.game_id}'  # Ключ для Redis
        self.user = self.scope.get('user')

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        if self.user and self.user.is_authenticated:
            await database_sync_to_async(self.ensure_player_exists)()
            await self.broadcast_room_update()

    def ensure_player_exists(self):
        from .models import Player
        Player.objects.get_or_create(user=self.user, game_id=self.game_id)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        action = data.get('action')

        # --- ЛОГИКА ДО НАЧАЛА ИГРЫ ---
        if action == 'create_team':
            team_name = data.get('name')
            await database_sync_to_async(Team.objects.create)(
                game_id=self.game_id,
                name=team_name
            )
            await self.broadcast_room_update()

        elif action == 'join_team':
            team_id = data.get('team_id')
            await database_sync_to_async(self.update_player_team)(team_id)
            await self.broadcast_room_update()

        # --- ЛОГИКА ИГРЫ С ИСПОЛЬЗОВАНИЕМ КЭША ---
        elif action == 'start_game':
            if hasattr(self.user, 'role') and self.user.role == 'teacher':
                initial_state = {
                    'current_idx': 0,
                    'scores': {},
                    'player_scores': {},
                    'blocked_teams': [],
                    'game_active': True
                }
                # Сохраняем в Redis на 2 часа (7200 сек)
                cache.set(self.cache_key, initial_state, 7200)

                await self.channel_layer.group_send(
                    self.room_group_name, {'type': 'game_start_broadcast'}
                )

        elif action == 'submit_answer':
            state = cache.get(self.cache_key)
            if not state or not state.get('game_active'):
                return

            lobby_data = await database_sync_to_async(self.get_lobby_data)()
            user_info = lobby_data['players'].get(self.user.username, {})
            team_id = str(user_info.get('team_id')) if user_info.get('team_id') else None

            if not team_id or team_id in state['blocked_teams']:
                return

            is_correct = data.get('is_correct')
            total_q = data.get('total_questions', 0)

            if is_correct:
                state['scores'][team_id] = state['scores'].get(team_id, 0) + 1
                state['player_scores'][self.user.username] = state['player_scores'].get(self.user.username, 0) + 1
                state['blocked_teams'] = []

                winner_name = self.user.first_name if self.user.first_name else self.user.username

                if state['current_idx'] >= total_q - 1:
                    state['game_active'] = False
                    cache.set(self.cache_key, state, 7200)  # Обновляем кэш

                    team_names = {str(t['id']): t['name'] for t in lobby_data['teams']}
                    await self.channel_layer.group_send(self.room_group_name, {
                        'type': 'game_over_broadcast',
                        'scores': state['scores'],
                        'team_names': team_names,
                        'player_stats': state['player_scores']
                    })
                else:
                    state['current_idx'] += 1
                    cache.set(self.cache_key, state, 7200)  # Обновляем кэш

                    await self.channel_layer.group_send(self.room_group_name, {
                        'type': 'next_question_broadcast',
                        'new_idx': state['current_idx'],
                        'new_scores': state['scores'],
                        'player_stats': state['player_scores'],
                        'winner_name': winner_name,
                        'correct_answer':data.get('answer_text')

                    })
            else:
                if team_id not in state['blocked_teams']:
                    state['blocked_teams'].append(team_id)

                all_active_ids = [str(t['id']) for t in lobby_data['teams']]
                if len(state['blocked_teams']) >= len(all_active_ids):
                    state['blocked_teams'] = []

                cache.set(self.cache_key, state, 7200)  # Обновляем кэш

                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'team_blocked_broadcast',
                    'team': team_id,
                    'wrong_answer': data.get('answer_text')
                })

    # --- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ---

    def update_player_team(self, team_id):
        from .models import Player, Team
        try:
            team = Team.objects.get(id=team_id, game_id=self.game_id)
            Player.objects.update_or_create(
                user=self.user, game_id=self.game_id,
                defaults={'team': team}
            )
        except Team.DoesNotExist:
            pass

    async def broadcast_room_update(self):
        data = await database_sync_to_async(self.get_lobby_data)()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'room_update_message',
                'players': data['players'],
                'teams': data['teams']
            }
        )

    def get_lobby_data(self):
        from .models import Player, Team
        teams = Team.objects.filter(game_id=self.game_id)
        teams_list = [{'id': t.id, 'name': t.name} for t in teams]
        players = Player.objects.filter(game_id=self.game_id).select_related('team', 'user')
        players_dict = {
            p.user.username: {
                'team_name': p.team.name if p.team else "Без команды",
                'team_id': p.team.id if p.team else None
            } for p in players
        }
        return {'teams': teams_list, 'players': players_dict}

    async def room_update_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'ROOM_UPDATE',
            'players': event.get('players', {}),
            'teams': event.get('teams', [])
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
        lobby_data = await database_sync_to_async(self.get_lobby_data)()
        team_names = {str(t['id']): t['name'] for t in lobby_data['teams']}
        await self.send(text_data=json.dumps({
            'type': 'NEXT_QUESTION',
            'new_idx': event['new_idx'],
            'scores': event['new_scores'],
            'team_names': team_names,
            'player_stats': event['player_stats'],
            'winner_name': event.get('winner_name'),
            'correct_answer': event.get('correct_answer')
        }))

    async def game_over_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'GAME_OVER',
            'scores': event['scores'],
            'team_names': event.get('team_names', {}),
            'player_stats': event['player_stats']
        }))

    async def disconnect(self, close_code):
        if self.user and self.user.is_authenticated:
            await database_sync_to_async(self.remove_player_from_game)()
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        await self.broadcast_room_update()

    def remove_player_from_game(self):
        from .models import Player
        Player.objects.filter(user=self.user, game_id=self.game_id).delete()