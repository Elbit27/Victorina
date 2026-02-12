# game/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer


class GameConsumer(AsyncWebsocketConsumer):
    room_states = {}

    async def connect(self):
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.room_group_name = f'game_{self.game_id}'
        self.user = self.scope["user"]

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        if self.room_group_name not in self.room_states:
            self.room_states[self.room_group_name] = {
                'players': {},
                'current_idx': 0,
                'scores': {'A': 0, 'B': 0},
                'blocked_teams': [],  # Команды, которые ответили неверно на текущий вопрос
                'game_active': False
            }

        players = self.room_states[self.room_group_name]['players']
        team = 'A' if len(players) % 2 == 0 else 'B'
        players[self.user.username] = {'team': team}

        await self.channel_layer.group_send(
            self.room_group_name, {'type': 'room_update_message', 'players': players}
        )

    # game/consumers.py

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'join_team':
            team = data.get('team')
            # Обновляем состояние комнаты
            players = self.room_states[self.room_group_name]['players']
            if self.user.username in players:
                players[self.user.username]['team'] = team
                print(f"DEBUG: {self.user.username} перешел в команду {team}")

            # !!! САМОЕ ВАЖНОЕ: Рассылка всем игрокам в комнате !!!
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'room_update_message',  # Это вызовет метод room_update_message ниже
                    'players': players
                }
            )
        state = self.room_states[self.room_group_name]

        if action == 'start_game':
            state['game_active'] = True
            state['current_idx'] = 0
            state['scores'] = {'A': 0, 'B': 0}
            await self.channel_layer.group_send(self.room_group_name, {'type': 'game_start_broadcast'})

        elif action == 'submit_answer':
            if not state['game_active']: return

            user_team = state['players'][self.user.username]['team']

            # Проверяем, не заблокирована ли команда
            if user_team in state['blocked_teams']:
                return

            is_correct = data.get('is_correct')

            if is_correct:
                # КТО ПЕРВЫЙ — ТОМУ ОЧКО
                state['scores'][user_team] += 1
                state['blocked_teams'] = []  # Сброс блоков для нового вопроса
                state['current_idx'] += 1

                # Рассылаем всем команду на следующий вопрос
                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'next_question_broadcast',
                    'winner_name': self.user.username,
                    'new_scores': state['scores'],
                    'new_idx': state['current_idx']
                })
            else:
                # НЕВЕРНО — блокируем всю команду для этого вопроса
                if user_team not in state['blocked_teams']:
                    state['blocked_teams'].append(user_team)

                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'team_blocked_broadcast',
                    'team': user_team,
                    'user': self.user.username
                })

    # Обработчики рассылок
    async def game_start_broadcast(self, event):
        await self.send(text_data=json.dumps({'type': 'GAME_START'}))

    async def next_question_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'NEXT_QUESTION',
            'new_idx': event['new_idx'],
            'scores': event['new_scores'],
            'last_winner': event['winner_name']
        }))

    async def team_blocked_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'TEAM_BLOCKED',
            'team': event['team'],
            'user': event['user']
        }))

    async def room_update_message(self, event):
        await self.send(text_data=json.dumps({'type': 'ROOM_UPDATE', 'players': event['players']}))

    async def disconnect(self, close_code):
        # Удаляем игрока из группы сокета
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Очищаем данные из room_states
        if self.room_group_name in self.room_states:
            players = self.room_states[self.room_group_name]['players']
            if self.user.username in players:
                del players[self.user.username]
                print(f"DEBUG: {self.user.username} покинул комнату.")

            # Если в комнате никого не осталось, можно удалить всю комнату целиком
            if not players:
                del self.room_states[self.room_group_name]
            else:
                # Если кто-то остался, рассылаем обновленный список лобби
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'room_update_message', 'players': players}
                )