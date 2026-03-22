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
            currentIdx = data.new_idx;

            const scoreContainer = document.getElementById('live-scores');
            if (scoreContainer && data.scores) {
                // Используем data.team_names для отображения имен
                scoreContainer.innerHTML = Object.entries(data.scores).map(([teamId, score]) => {
                    const name = data.team_names && data.team_names[teamId]
                                 ? data.team_names[teamId]
                                 : `Команда #${teamId}`;
                    return `<span class="badge rounded-pill live-score-badge">${name}: ${score}</span>`;
                }).join('');
            }

            renderQuestion();
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

function changeTeam(teamName) {
    // Теперь эта функция берет gameSocket из глобальной области
    if (gameSocket && gameSocket.readyState === WebSocket.OPEN) {
        console.log("Отправляю запрос на смену команды:", teamName);
        gameSocket.send(JSON.stringify({
            'action': 'join_team',
            'team': teamName
        }));
    } else {
        console.log("❌ Сокет всё еще не готов. Текущий статус:", gameSocket ? gameSocket.readyState : 'null');
    }
}

function updateLobbyUI(players) {
    const container = document.getElementById('teams-container');
    if (!container) return;

    // Группируем игроков по командам
    const teamsMap = {};
    for (let user in players) {
        const tName = players[user].team_name || "Без команды";
        const tId = players[user].team_id;
        if (!teamsMap[tId]) teamsMap[tId] = { name: tName, players: [] };
        teamsMap[tId].players.push(user);
    }

    // Рендерим карточки
    container.innerHTML = Object.entries(teamsMap).map(([id, team]) => `
        <div class="col-md-4">
            <div class="card shadow-sm border-primary">
                <div class="card-header bg-light d-flex justify-content-between align-items-center">
                    <strong class="text-primary">${team.name}</strong>
                    <button onclick="joinTeamRemote(${id})" class="btn btn-primary btn-sm">Вступить</button>
                </div>
                <div class="card-body p-2">
                    <ul class="list-unstyled mb-0">
                        ${team.players.map(p => `<li>👤 ${p}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `).join('');
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
    if (resultScreen) resultScreen.style.display = 'block';

    let winnerName = "Игра завершена";
    let winnerScore = 0;

    if (finalScores && teamNames && Object.keys(finalScores).length > 0) {
        const sortedTeams = Object.entries(finalScores).sort(([, a], [, b]) => b - a);
        const [topTeamId, topScore] = sortedTeams[0];
        winnerName = teamNames[topTeamId] || `Команда #${topTeamId}`;
        winnerScore = topScore;
    }

    const sortedPlayers = Object.entries(playerStats || {}).sort(([, a], [, b]) => b - a);

    if (resultScreen) {
        resultScreen.innerHTML = `
            <div class="container py-5">
                <div class="text-center mb-5">
                    <p class="text-uppercase fw-bold tracking-widest text-blue-400 mb-2" style="color: #60a5fa; letter-spacing: 2px;">Финальные результаты</p>
                    <h1 class="display-3 winner-title mb-3">
                        ${winnerName}
                    </h1>
                    <div class="d-inline-block px-4 py-2 rounded-pill shadow-sm" style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3);">
                        <span class="text-warning fw-bold fs-4">🏆 Победитель счётом ${winnerScore}</span>
                    </div>
                </div>

                <div class="result-card mx-auto shadow-2xl" style="max-width: 700px;">
                    <div class="d-flex justify-content-between align-items-center mb-4 border-bottom border-secondary pb-3">
                        <h4 class="mb-0 fw-bold">Рейтинг игроков</h4>
                        <span style="color: #ffffff;">${sortedPlayers.length} участников</span>
                    </div>

                    <div class="player-list">
                        ${sortedPlayers.length > 0 ? sortedPlayers.map(([name, score], index) => `
                            <div class="player-row d-flex justify-content-between align-items-center p-3">
                                <div class="d-flex align-items-center">
                                    <div class="rank-circle me-3 d-flex align-items-center justify-content-center rounded-circle"
                                         style="width: 40px; height: 40px; background: ${index === 0 ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; color: ${index === 0 ? '#000' : '#fff'}; font-weight: 800;">
                                        ${index + 1}
                                    </div>
                                    <span class="fs-5 fw-medium">${name}</span>
                                </div>
                                <span class="badge score-badge rounded-pill fs-6">${score} правильных</span>
                            </div>
                        `).join('') : '<p class="text-center py-5 text-muted">Никто не набрал очков в этом раунде</p>'}
                    </div>

                    <div class="text-center mt-5">
                        <button onclick="location.reload()" class="btn btn-restart shadow-lg">
                             Играть снова
                        </button>
                    </div>
                </div>

                <div class="text-center mt-4 text-muted small">
                    <p>© 2026 Victorina Game • Разработано для побед</p>
                </div>
            </div>
        `;
    }
}