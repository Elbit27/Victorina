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
                'player_scores': {},
                'blocked_teams': [],
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
            state['player_scores'] = {}

            await self.channel_layer.group_send(self.room_group_name, {'type': 'game_start_broadcast'})

        elif action == 'submit_answer':
            if not state['game_active']: return
            user_team = state['players'][self.user.username]['team']
            if user_team in state['blocked_teams']:
                if len(state['blocked_teams']) >= 2:
                    state['blocked_teams'] = []  # Сбрасываем блокировку для всех
                else:
                    return  # Если вторая команда еще не ошибалась, блокировка для текущей в силе
            is_correct = data.get('is_correct')
            if is_correct:
                state['scores'][user_team] += 1

                # Увеличиваем личный счет игрока
                username = self.user.username
                state['player_scores'][username] = state['player_scores'].get(username, 0) + 1

                state['blocked_teams'] = []
                state['current_idx'] += 1

                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'next_question_broadcast',
                    'winner_name': self.user.username,
                    'new_scores': state['scores'],
                    'player_stats': state['player_scores'],  # Отправляем статистику всем
                    'new_idx': state['current_idx']
                })
            else:

                # НЕВЕРНО
                if user_team not in state['blocked_teams']:
                    state['blocked_teams'].append(user_team)

                answer_text = data.get('answer_text')

                # Проверяем, стали ли заблокированы все команды
                is_everyone_blocked = len(state['blocked_teams']) >= 2

                if is_everyone_blocked:
                    state['blocked_teams'] = []  # Сбрасываем список на сервере

                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'team_blocked_broadcast',
                    'team': user_team,
                    'user': self.user.username,
                    'wrong_answer': answer_text,
                    'reset_all': is_everyone_blocked  # Передаем этот флаг фронтенду
                })


    # Обработчики рассылок
    async def game_start_broadcast(self, event):
        await self.send(text_data=json.dumps({'type': 'GAME_START'}))

    async def next_question_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'NEXT_QUESTION',
            'new_idx': event['new_idx'],
            'scores': event['new_scores'],
            'player_stats': event.get('player_stats', {}),  # <--- Обязательно добавьте это
            'last_winner': event['winner_name']
        }))

    async def team_blocked_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'TEAM_BLOCKED',
            'team': event['team'],
            'user': event['user'],
            'wrong_answer': event.get('wrong_answer'),
            'reset_all': event.get('reset_all', False)  # Принимаем флаг
        }))

    async def all_failed_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'ALL_FAILED'
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