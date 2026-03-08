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
            updateLobbyUI(data.players);

            const myName = window.userName;
            console.log("Ищу себя в списке. Мое имя (window.userName):", myName);
            console.log("Список игроков от сервера:", Object.keys(data.players));

            if (data.players && data.players[myName]) {
                myTeam = data.players[myName].team;
                console.log("✅ Успех! Моя команда:", myTeam);
            } else {
                console.error("❌ Ошибка: Я не нашел себя в списке игроков!");
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
            document.getElementById('score-a').innerText = data.scores.A;
            document.getElementById('score-b').innerText = data.scores.B;
            renderQuestion();
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

function renderQuestion() {
    const questionText = document.getElementById('question-text');
    const statusMsg = document.getElementById('game-status-msg');
    const answersGrid = document.getElementById('answers-grid');
    let imageContainer = document.getElementById('question-image-container');

    if (currentIdx >= questions.length) {
        showResults();
        return;
    }

    canClick = true;
    const q = questions[currentIdx];

    // Очищаем всё старое
    questionText.innerText = q.text;
    questionText.style.color = "black";
    if (statusMsg) statusMsg.innerText = ""; // Чистим надпись "Соперник ошибся"

    if (imageContainer) {
        if (q.image) {
            // Если в JSON пришел относительный путь, Django обычно отдает его от корня или с медиа
            // Убедись, что q.image содержит правильный URL
            imageContainer.innerHTML = `
                <img src="${q.image}"
                     style="max-width: 100%; max-height: 300px; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: block; margin-left: auto; margin-right: auto;">
            `;
            imageContainer.style.display = 'block';
        } else {
            imageContainer.innerHTML = '';
            imageContainer.style.display = 'none';
        }
    }

    answersGrid.innerHTML = '';
    q.answers.forEach((ans) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.innerText = ans.text;
        btn.onclick = () => handleAnswer(btn, ans);
        answersGrid.appendChild(btn);
    });
}

function handleAnswer(selectedBtn, answer) {
    if (!canClick) return;

    gameSocket.send(JSON.stringify({
        'action': 'submit_answer',
        'is_correct': answer.is_correct,
        'answer_text': answer.text
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
    console.log("📥 Обновление лобби. Данные:", players); // Посмотри это в консоли браузера (F12)

    const listA = document.getElementById('list-a');
    const listB = document.getElementById('list-b');

    if (!listA || !listB) {
        console.error("❌ Элементы list-a или list-b не найдены на странице!");
        return;
    }

    // Очищаем списки перед отрисовкой
    listA.innerHTML = '';
    listB.innerHTML = '';

    for (let name in players) {
        const li = document.createElement('li');
        li.innerText = name;

        if (players[name].team === 'A') {
            listA.appendChild(li);
        } else {
            listB.appendChild(li);
        }
    }
}

function showResults() {
    document.getElementById('main-game-ui').style.display = 'none';
    const resultScreen = document.getElementById('result-screen');
    if (!resultScreen) return;

    // Считаем финальный счет из элементов на странице
    const scoreA = parseInt(document.getElementById('score-a').innerText) || 0;
    const scoreB = parseInt(document.getElementById('score-b').innerText) || 0;

    // Определяем текст победителя
    let winnerText = "НИЧЬЯ!";
    let winnerColor = "#666";
    if (scoreA > scoreB) {
        winnerText = "ПОБЕДА КОМАНДЫ А";
        winnerColor = "#ff4d4d";
    } else if (scoreB > scoreA) {
        winnerText = "ПОБЕДА КОМАНДЫ Б";
        winnerColor = "#4d79ff";
    }

    // Превращаем объект статистики в массив и сортируем (от большего к меньшему)
    const sortedPlayers = Object.entries(playerStats)
        .sort(([, a], [, b]) => b - a);

    resultScreen.style.display = 'block';
    resultScreen.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h1 style="color: ${winnerColor}; font-size: 3em; margin-bottom: 10px;">${winnerText}</h1>
            <h2 style="margin-bottom: 30px;">Счет: ${scoreA} — ${scoreB}</h2>

            <div style="background: #f9f9f9; border-radius: 15px; padding: 20px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <h3 style="margin-bottom: 15px; border-bottom: 2px solid #ddd; padding-bottom: 10px;">Рейтинг игроков</h3>
                <ul style="list-style: none; padding: 0;">
                    ${sortedPlayers.map(([name, score], index) => `
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; ${index === 0 ? 'font-weight: bold; color: #d4af37;' : ''}">
                            <span>${index + 1}. ${name} ${index === 0 ? '👑' : ''}</span>
                            <span>${score} отв.</span>
                        </li>
                    `).join('')}
                </ul>
                    ${sortedPlayers.length === 0 ? '<p>Никто не успел ответить правильно</p>' : ''}
            </div>

            <div style="margin-top: 40px;">
                <button onclick="location.reload()" class="btn-blue" style="padding: 15px 30px; font-size: 1.1em;">Вернуться в лобби</button>
                <br><br>
                <a href="/" style="color: #888; text-decoration: none;">Выйти в главное меню</a>
            </div>
        </div>
    `;
}