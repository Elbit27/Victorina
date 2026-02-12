// Глобальные переменные
let gameSocket = null;
let questions = [];
let myTeam = null;
let currentIdx = 0;
let canClick = true;

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
            console.log(`Заблокирована команда: ${data.team}, Моя команда: ${myTeam}`);

            // Если команда игрока еще не определена сервером, игнорируем блок
            if (!myTeam) return;

            if (String(data.team) === String(myTeam)) {
                applyBlockVisuals();
            } else {
                // Если мы в другой команде — снимаем визуальные эффекты и разрешаем клик
                canClick = true;
                const qText = document.getElementById('question-text');
                if (qText) {
                    qText.innerText = "⭐ Соперник ошибся! Ваш шанс!";
                    qText.style.color = "green";
                }
                // Принудительно возвращаем кнопкам нормальный вид
                const btns = document.querySelectorAll('.answer-btn');
                btns.forEach(btn => {
                    btn.style.opacity = "1";
                    btn.style.filter = "none";
                });
            }
        }

        if (data.type === 'GAME_START') {
            currentIdx = 0;
            document.getElementById('lobby-screen').style.display = 'none';
            document.getElementById('main-game-ui').style.display = 'block';
            renderQuestion();
        }

        if (data.type === 'NEXT_QUESTION') {
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
    const answersGrid = document.getElementById('answers-grid');

    if (currentIdx >= questions.length) {
        showResults();
        return;
    }

    canClick = true; // Разрешаем клик всем
    const q = questions[currentIdx];

    // СБРОС СТИЛЕЙ ТЕКСТА
    questionText.innerText = q.text;
    questionText.style.color = "black";

    answersGrid.innerHTML = '';

    q.answers.forEach((ans) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.innerText = ans.text;
        btn.style.opacity = "1"; // Сброс прозрачности
        btn.style.filter = "none"; // Сброс серого фильтра
        btn.onclick = () => handleAnswer(btn, ans);
        answersGrid.appendChild(btn);
    });
}

function handleAnswer(selectedBtn, answer) {
    if (!canClick) return;

    // Мы не ставим здесь canClick = false принудительно навсегда.
    // Мы просто отправляем запрос.
    gameSocket.send(JSON.stringify({
        'action': 'submit_answer',
        'is_correct': answer.is_correct
    }));

    // Визуально подсветим, что нажали, но не блокируем всё управление сразу
    selectedBtn.style.boxShadow = "0 0 10px yellow";
}

function applyBlockVisuals() {
    canClick = false;
    const btns = document.querySelectorAll('.answer-btn');
    btns.forEach(btn => {
        btn.style.opacity = "0.3";
        btn.style.filter = "grayscale(1)";
    });
    const qText = document.getElementById('question-text');
    qText.innerText = "❌ Ваша команда ошиблась! Ждите...";
    qText.style.color = "red";
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
    if (resultScreen) {
        resultScreen.style.display = 'block';

        // Добавляем кнопку выхода, если её нет в HTML
        resultScreen.innerHTML += `
            <button onclick="location.reload()" class="btn-blue">Вернуться в лобби</button>
            <a href="/" class="btn-blue" style="text-decoration:none; background: gray;">Выйти из игры</a>
        `;
    }
}