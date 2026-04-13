// Глобальные переменные
let gameSocket = null;
let questions = [];
let myTeam = null;
let currentIdx = 0;
let canClick = true;
let playerStats = {}; // Глобальная переменная для хранения очков игроков

document.addEventListener('DOMContentLoaded', () => {
    // 1. Загрузка вопросов
    const gameDataElement = document.getElementById('game-data');
    if (gameDataElement) {
        questions = JSON.parse(gameDataElement.textContent).questions;
    }

    // 2. Инициализация сокета
    const gameId = window.gameId || window.location.pathname.split('/').filter(Boolean).pop();
    const socketProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const socketUrl = socketProtocol + window.location.host + '/ws/game/' + gameId + '/';

    console.log("Подключение к:", socketUrl);
    gameSocket = new WebSocket(socketUrl);

    gameSocket.onopen = () => console.log("✅ Соединение установлено!");

    gameSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        console.log("📥 Сообщение:", data);

        if (data.type === 'ROOM_UPDATE') {
        renderLobby(data.teams, data.players);

        const myName = window.userName;
        if (data.players && data.players[myName]) {
            myTeam = data.players[myName].team_id;
            console.log("✅ Моя команда (ID):", myTeam);
        }
    }

        if (data.type === 'TEAM_BLOCKED') {
            const btns = document.querySelectorAll('.answer-btn');
            const statusMsg = document.getElementById('game-status-msg'); // Проверь, что этот ID есть в HTML!

            btns.forEach(btn => {
                if (btn.innerText === data.wrong_answer) {
                    btn.disabled = true;
                    btn.style.opacity = "0.2";
                    btn.style.textDecoration = "line-through";
                }
            });

            if (String(data.team) === String(myTeam)) {
                applyBlockVisuals(); // Тут мы тоже поменяем логику ниже
            } else {
                canClick = true;
                // ТЕПЕРЬ ТУТ НЕ qText, А statusMsg
                if (statusMsg) {
                    statusMsg.innerText = "⭐ Соперник ошибся! Ваш шанс!";
                    statusMsg.style.color = "#28a745";
                }
                btns.forEach(btn => {
                    if (!btn.disabled) {
                        btn.style.opacity = "1";
                        btn.style.filter = "none";
                    }
                });
            }
        }

        if (data.type === 'GAME_START') {
            currentIdx = 0;
            playerStats = {};
            document.getElementById('lobby-screen').style.display = 'none';
            document.getElementById('main-game-ui').style.display = 'block';
            renderQuestion();
        }

        if (data.type === 'NEXT_QUESTION') {
            if (data.player_stats) playerStats = data.player_stats;

            const winner = data.winner_name;
            const correctText = data.correct_answer;
            const btns = document.querySelectorAll('.answer-btn');
            const statusMsg = document.getElementById('game-status-msg');

            // 1. Подсвечиваем правильный ответ для ВСЕХ
            btns.forEach(btn => {
                if (btn.innerText.trim() === correctText) {
                    btn.style.border = '4px solid #28a745';
                    btn.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
                    btn.style.boxShadow = '0 0 15px rgba(40, 167, 69, 0.5)';
                }
                btn.disabled = true; // Запрещаем кликать во время паузы
            });

            // 2. Пишем имя победителя
            if (statusMsg && winner) {
                statusMsg.innerText = `✅ ${winner} ответил(а) верно!`;
                statusMsg.style.color = "#28a745";
                statusMsg.style.fontWeight = "bold";
            }

            // 3. Ждем 2 секунды и только ПОТОМ переходим к следующему вопросу
            setTimeout(() => {
                currentIdx = data.new_idx;

                // Обновляем счет
                const scoreContainer = document.getElementById('live-scores');
                if (scoreContainer && data.scores) {
                    scoreContainer.innerHTML = Object.entries(data.scores).map(([teamId, score]) => {
                        const name = data.team_names && data.team_names[teamId]
                                     ? data.team_names[teamId]
                                     : `Команда #${teamId}`;
                        return `<span class="badge rounded-pill live-score-badge">${name}: ${score}</span>`;
                    }).join('');
                }

                renderQuestion(); // Эта функция очистит стили кнопок и уберет надпись
            }, 2000);

        }


        else if (data.type === 'GAME_OVER') {
            console.log("🏁 Игра официально окончена сервером");
            if (data.player_stats) playerStats = data.player_stats;

            console.log("Финальный счет:", data.scores, data.team_names);

            // Вызываем функцию показа результатов и передаем туда объект со счетом
            showResults(data.scores, data.team_names);
        }
    };


    const startBtn = document.getElementById('start-now-btn');
    if (startBtn) {
        startBtn.onclick = () => {
            if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
                gameSocket.send(JSON.stringify({'action': 'start_game'}));
            }
        };
    }
});

function createTeamRemote() {
    const nameInput = document.getElementById('new-team-name');
    const name = nameInput.value.trim();
    if (!name) return;

    // Отправляем через сокет, чтобы все увидели новую команду сразу
    gameSocket.send(JSON.stringify({
        'action': 'create_team',
        'name': name
    }));
    nameInput.value = '';
}

function renderTeams(teamsData) {
    const container = document.getElementById('teams-container');
    container.innerHTML = '';

    teamsData.forEach(team => {
        const teamCard = `
            <div class="col-md-4">
                <div class="card shadow-sm">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">${team.name}</h5>
                        <button onclick="joinTeam(${team.id})" class="btn btn-sm btn-outline-primary">Вступить</button>
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled">
                            ${team.players.map(p => `<li>👤 ${p.username}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += teamCard;
    });
}

function renderLobby(teams, players) {
    const container = document.getElementById('teams-container');
    if (!container) return;

    container.innerHTML = teams.map(team => {
        const teamPlayers = Object.entries(players)
            .filter(([name, info]) => info.team_id === team.id)
            .map(([name]) => name);

        // Кнопка удаления только для персонала
        const deleteBtn = window.isStaff
            ? `<button onclick="deleteTeamRemote(${team.id})" class="btn btn-sm btn-danger opacity-75" title="Удалить команду">×</button>`
            : '';

        return `
            <div class="col-md-4">
                <div class="card mb-3 shadow-sm ${myTeam === team.id ? 'border-success' : 'border-primary'}">
                    <div class="card-header ${myTeam === team.id ? 'bg-success' : 'bg-primary'} text-white d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">${team.name}</h5>
                        ${deleteBtn}
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled mb-3">
                            ${teamPlayers.length > 0
                                ? teamPlayers.map(p => `<li>👤 ${p}</li>`).join('')
                                : '<li class="text-muted small">Пока пусто...</li>'}
                        </ul>
                        <button onclick="joinTeamRemote(${team.id})"
                                class="btn ${myTeam === team.id ? 'btn-outline-success disabled' : 'btn-outline-primary'} w-100">
                            ${myTeam === team.id ? '✅ Вы здесь' : 'Вступить'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}


// Функция отправки запроса на удаление
function deleteTeamRemote(teamId) {
    if (!confirm("Удалить эту команду? Все игроки из неё станут 'без команды'.")) return;

    gameSocket.send(JSON.stringify({
        'action': 'delete_team',
        'team_id': teamId
    }));
}

function handleAnswer(selectedBtn, answer) {
    if (!canClick || !myTeam) return; // Не даем кликать, если нет команды

    gameSocket.send(JSON.stringify({
        'action': 'submit_answer',
        'is_correct': answer.is_correct,
        'answer_text': answer.text,
        'total_questions': questions.length // Передаем длину массива вопросов
    }));
}



function applyBlockVisuals() {
    canClick = false;
    const btns = document.querySelectorAll('.answer-btn');
    const statusMsg = document.getElementById('game-status-msg');

    btns.forEach(btn => {
        if (!btn.disabled) {
            btn.style.opacity = "0.4";
            btn.style.filter = "grayscale(0.8)";
        }
    });

    // Пишем в статус, а не в вопрос!
    if (statusMsg) {
        statusMsg.innerText = "❌ Ваша команда ошиблась! Ждите...";
        statusMsg.style.color = "#dc3545";
    }
}

function joinTeamRemote(teamId) {
    const oldTeam = myTeam;
    myTeam = teamId;

    console.log(`Переход из ${oldTeam} в ${teamId}`);

    if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
        gameSocket.send(JSON.stringify({
            'action': 'join_team',
            'team_id': teamId
        }));
    } else {
        // Если сокет упал, возвращаем как было
        myTeam = oldTeam;
        alert("Связь с сервером потеряна!");
    }
}

function renderQuestion() {
    const q = questions[currentIdx];
    if (!q) return;

    // 1. Текст вопроса
    document.getElementById('question-text').innerText = q.text;

    // 2. Центрирование и стилизация фото
    const imageElement = document.getElementById('question-image');
    if (imageElement) {
        if (q.image && q.image.trim() !== "" && q.image !== "None") {
            imageElement.src = q.image;
            imageElement.style.display = 'block';
            imageElement.style.margin = '0 auto 20px auto'; // Центрируем по горизонтали и даем отступ снизу
        } else {
            imageElement.style.display = 'none';
            imageElement.src = "";
        }
    }

    // 3. Ответы
    const grid = document.getElementById('answers-grid');
    grid.innerHTML = q.answers.map(a => `
        <button class="answer-btn" onclick='handleAnswer(this, ${JSON.stringify(a)})'>
            ${a.text}
        </button>
    `).join('');

    const statusMsg = document.getElementById('game-status-msg');
    if (statusMsg) statusMsg.innerText = "";
    canClick = true;
}

function showResults(finalScores, teamNames) {
    const mainUI = document.getElementById('main-game-ui');
    const resultScreen = document.getElementById('result-screen');

    if (mainUI) mainUI.style.display = 'none';
    if (resultScreen) {
        resultScreen.style.display = 'block';
        // Устанавливаем минималистичный БЕЛЫЙ фон
        resultScreen.style.backgroundColor = '#ffffff';
        resultScreen.style.minHeight = '100vh';
    }

    let winnerName = "—";
    let winnerScore = 0;
    let isDraw = false;

    if (finalScores && teamNames && Object.keys(finalScores).length > 0) {
        const sortedTeams = Object.entries(finalScores).sort(([, a], [, b]) => b - a);
        winnerScore = sortedTeams[0][1];
        const winners = sortedTeams.filter(([, score]) => score === winnerScore);

        if (winners.length > 1) {
            isDraw = true;
            winnerName = winners.map(([id]) => teamNames[id] || `Команда #${id}`).join(' и ');
        } else {
            const topTeamId = sortedTeams[0][0];
            winnerName = teamNames[topTeamId] || `Команда #${topTeamId}`;
        }
    }

    const sortedPlayers = Object.entries(playerStats || {}).sort(([, a], [, b]) => b - a);

    // Внедряем стили и верстку прямо в innerHTML
    resultScreen.innerHTML = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap');

            .unify-minimal-wrapper {
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                color: #1f2937; /* Темно-серый текст */
                max-width: 650px;
                margin: 0 auto;
                padding: 80px 20px;
                animation: unifySlideIn 0.6s ease;
            }
            .unify-label {
                color: #3b82f6; /* Фирменный синий */
                text-transform: uppercase;
                font-weight: 700;
                letter-spacing: 1.5px;
                font-size: 0.9rem;
                margin-bottom: 12px;
            }
            .unify-winner-title {
                font-size: 2.8rem;
                font-weight: 800;
                margin: 0;
                color: #111827; /* Почти черный текст */
                line-height: 1.2;
            }
            .unify-total-points {
                display: inline-block;
                margin-top: 25px;
                padding: 10px 28px;
                background: #f0f7ff; /* Очень светлый синий */
                border: 1px solid #bfdbfe;
                color: #1e40af; /* Темно-синий текст */
                border-radius: 50px;
                font-weight: 700;
                font-size: 1.1rem;
            }
            .unify-card-minimal {
                background: #f9fafb; /* Едва заметный серый фон карточки */
                border: 1px solid #e5e7eb;
                border-radius: 20px;
                padding: 30px;
                margin-top: 50px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.03);
            }
            .unify-header-minimal {
                display: flex;
                justify-content: space-between;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 18px;
                margin-bottom: 25px;
                font-weight: 700;
                color: #111827;
                font-size: 1.1rem;
            }
            .player-item-minimal {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-radius: 12px;
                margin-bottom: 8px;
                transition: 0.2s ease;
            }
            .player-item-minimal:hover {
                background: #eff6ff;
                transform: translateX(4px);
            }
            .rank-box-minimal {
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #e5e7eb;
                color: #4b5563;
                border-radius: 8px;
                margin-right: 18px;
                font-weight: 800;
                font-size: 0.9rem;
            }
            .gold-minimal { background: #fbbf24; color: #ffffff; } /* Золото */
            .pts-minimal { color: #3b82f6; font-weight: 700; font-size: 0.95rem; }
            .btn-unify-minimal {
                width: 100%;
                background: #3b82f6;
                color: white;
                border: none;
                padding: 18px;
                border-radius: 14px;
                font-weight: 700;
                font-size: 1.1rem;
                cursor: pointer;
                margin-top: 30px;
                transition: all 0.2s ease;
            }
            .btn-unify-minimal:hover {
                background: #2563eb;
                box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
            }
            @keyframes unifySlideIn {
                from { opacity: 0; transform: translateY(15px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>

        <div class="unify-minimal-wrapper">
            <div class="text-center">
                <p class="unify-label">${isDraw ? 'Ничья' : 'Битва завершена'}</p>
                <h1 class="unify-winner-title">${winnerName}</h1>
                <div class="unify-total-points">🏆 Набрано: ${winnerScore} очков</div>
            </div>

            <div class="unify-card-minimal">
                <div class="unify-header-minimal">
                    <span>Индивидуальный рейтинг</span>
                    <span style="color: #6b7280; font-weight: 400; font-size: 0.9rem;">${sortedPlayers.length} участников</span>
                </div>

                <div class="list-container">
                    ${sortedPlayers.length > 0 ? sortedPlayers.map(([name, score], index) => `
                        <div class="player-item-minimal">
                            <div style="display: flex; align-items: center;">
                                <div class="rank-box-minimal ${index === 0 ? 'gold-minimal' : ''}">${index + 1}</div>
                                <span style="font-weight: 500;">${name}</span>
                            </div>
                            <span class="pts-minimal">${score} pts</span>
                        </div>
                    `).join('') : '<p style="text-align: center; color: #9ca3af; padding: 30px 0;">Участники не ответили ни разу</p>'}
                </div>

                <button onclick="location.reload()" class="btn-unify-minimal">
                    Начать новый раунд
                </button>
            </div>
        </div>
    `;
}