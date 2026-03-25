let questionCount = 0;
let gameId = window.editGameData?.id || null;

// 1. Функции в глобальной области (чтобы работали onclick в HTML)
window.addQuestion = function(data = null) {
    questionCount++;
    const qId = questionCount;
    const container = document.getElementById('questions-container');

    const qHtml = `
        <div class="question-card shadow-sm mb-4" id="q-${qId}" data-id="${qId}">
            <div class="card-header bg-white d-flex justify-content-between align-items-center border-bottom-0 pt-4 px-4">
                <span class="badge bg-soft-blue text-primary">Вопрос №${qId}</span>
                <button type="button" class="btn-delete-q" onclick="document.getElementById('q-${qId}').remove()">
                    <i class="bi bi-trash"></i> Удалить
                </button>
            </div>

            <div class="card-body px-4 pb-4">
                <textarea class="q-text form-control custom-input mb-3" rows="2" placeholder="Введите текст вопроса...">${data ? data.text : ''}</textarea>

                <div class="image-upload-wrapper mb-3">
                    <label class="form-label small fw-bold text-muted">Изображение вопроса</label>
                    <input type="file" class="question-image form-control form-control-sm" accept="image/*" onchange="previewImage(this)">
                    <div class="image-preview mt-2" style="display: ${data && data.image ? 'block' : 'none'};">
                        <img src="${data && data.image ? data.image : ''}" class="rounded img-thumbnail" style="max-height: 150px;">
                    </div>
                </div>

                <div class="answers-section">
                    <label class="form-label small fw-bold text-muted">Варианты ответов</label>
                    <div class="answers-list"></div>
                    <button type="button" class="btn btn-sm btn-link text-decoration-none p-0 mt-2" onclick="addAnswer(this, ${qId})">
                        <i class="bi bi-plus-circle"></i> Добавить вариант
                    </button>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', qHtml);
    const currentCard = document.getElementById(`q-${qId}`);
    const answersList = currentCard.querySelector('.answers-list');

    if (data && data.answers) {
        data.answers.forEach(ans => addAnswer(null, qId, answersList, ans));
    } else {
        addAnswer(null, qId, answersList);
        addAnswer(null, qId, answersList);
    }
}

window.addAnswer = function(btn, qId, listContainer = null, data = null) {
    const list = listContainer || btn.closest('.answers-section').querySelector('.answers-list');

    const aHtml = `
        <div class="answer-row d-flex align-items-center mb-2 animate__animated animate__fadeIn">
            <div class="form-check me-2">
                <input type="radio" name="correct-${qId}" class="is-correct form-check-input" ${data && data.is_correct ? 'checked' : ''}>
            </div>
            <input type="text" class="a-text form-control form-control-sm custom-input" placeholder="Вариант ответа" value="${data ? data.text : ''}">
            <button type="button" class="btn btn-sm text-danger ms-2" onclick="this.parentElement.remove()">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>`;
    list.insertAdjacentHTML('beforeend', aHtml);
}

window.previewImage = function(input) {
    const previewDiv = input.nextElementSibling;
    const img = previewDiv.querySelector('img');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// 2. Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('questions-container');
    const submitBtn = document.getElementById('submit-game');

    // Если редактируем — заполняем данными
    if (window.editGameData) {
        document.getElementById('game-title').value = window.editGameData.title;
        container.innerHTML = '';
        window.editGameData.questions.forEach(q => addQuestion(q));
    } else {
        addQuestion();
    }

    // 3. САМОЕ ГЛАВНОЕ: Кнопка сохранения
    // Обработка сохранения
    submitBtn.addEventListener('click', async () => {
        const formData = new FormData();
        const title = document.getElementById('game-title').value;

        if (!title) return alert("Введите название!");

        formData.append('title', title);
        const questionsData = [];

        document.querySelectorAll('.question-card').forEach((qCard, qIndex) => {
            const qTextInput = qCard.querySelector('.q-text');
            const answers = [];

            qCard.querySelectorAll('.answer-row').forEach(aRow => {
                const aTextInput = aRow.querySelector('.a-text');
                const isCorrectInput = aRow.querySelector('.is-correct');
                if (aTextInput && aTextInput.value.trim() !== '') {
                    answers.push({
                        text: aTextInput.value,
                        is_correct: isCorrectInput.checked
                    });
                }
            });

            const questionObj = {
                text: qTextInput.value,
                answers: answers,
                image_key: null
            };

            const imageInput = qCard.querySelector('.question-image');
            if (imageInput?.files[0]) {
                const key = `image_${qIndex}`;
                formData.append(key, imageInput.files[0]);
                questionObj.image_key = key;
            }

            questionsData.push(questionObj);
        });

        formData.append('questions_json', JSON.stringify(questionsData));

        try {
            // ПРАВИЛЬНЫЕ ПУТИ СОГЛАСНО ТВОЕМУ urls.py
            // Создание: POST /game/
            // Редактирование: PUT /game/ID/
            const url = gameId ? `/game/${gameId}/` : '/game/';
            const method = gameId ? 'PUT' : 'POST';

            console.log(`Отправка на ${url} методом ${method}`);

            const response = await fetch(url, {
                method: method,
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                    // Content-Type НЕ ставим, для FormData он ставится автоматически
                },
                body: formData
            });

            if (response.ok) {
                // После успешного сохранения редиректим на список игр или в профиль
                window.location.href = '/game/profile/';
            } else {
                const errData = await response.json();
                console.error("Ошибка API:", errData);
                alert("Ошибка при сохранении: " + JSON.stringify(errData));
            }
        } catch (e) {
            console.error("Ошибка сети или парсинга:", e);
            alert("Не удалось связаться с сервером.");
        }
    });
});

// Утилита для получения CSRF токена
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}