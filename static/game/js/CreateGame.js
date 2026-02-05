let questionCount = 0;

// Функция для получения куки по имени
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



function addQuestion() {
    questionCount++;
    const container = document.getElementById('questions-container');
    const qHtml = `
        <div class="question-card" id="q-${questionCount}">
                <div style="display:flex; justify-content:space-between;">
                    <label>Вопрос №${questionCount}</label>
                    <span class="remove-btn" onclick="document.getElementById('q-${questionCount}').remove()">Удалить</span>
                </div>
                <input type="text" class="q-text" placeholder="Введите текст вопроса" style="width:100%; margin: 10px 0;">

                <div class="answers-list">
                    <div class="answer-row">
                        <input type="radio" name="correct-${questionCount}" class="is-correct" checked>
                        <input type="text" class="a-text" placeholder="Ответ 1">
                    </div>
                    <div class="answer-row">
                        <input type="radio" name="correct-${questionCount}" class="is-correct">
                        <input type="text" class="a-text" placeholder="Ответ 2">
                    </div>
                </div>
                <button type="button" style="font-size: 12px; background:none; border:none; color:#0866ff; cursor:pointer;" onclick="addAnswer(this, ${questionCount})">+ Добавить вариант ответа</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', qHtml);
    }

    function addAnswer(btn, qId) {
        const list = btn.previousElementSibling;
        const aHtml = `
            <div class="answer-row">
                <input type="radio" name="correct-${qId}" class="is-correct">
                <input type="text" class="a-text" placeholder="Следующий ответ">
                <span class="remove-btn" onclick="this.parentElement.remove()">×</span>
            </div>`;
        list.insertAdjacentHTML('beforeend', aHtml);
    }

    document.getElementById('submit-game').addEventListener('click', async function() {
        const csrftoken = getCookie('csrftoken'); // Получаем токен
        const data = {
            title: document.getElementById('game-title').value,
            questions: []
        };

        document.querySelectorAll('.question-card').forEach((qCard, index) => {
            const question = {
                text: qCard.querySelector('.q-text').value,
                order: index + 1,
                answers: []
            };
            qCard.querySelectorAll('.answer-row').forEach(aRow => {
                question.answers.push({
                    text: aRow.querySelector('.a-text').value,
                    is_correct: aRow.querySelector('.is-correct').checked
                });
            });
            data.questions.push(question);
        });

        const response = await fetch(window.location.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            window.location.href = '/';
        } else {
            const err = await response.json();
            alert("Ошибка при сохранении: " + JSON.stringify(err));
        }
    });

    // Добавим первый вопрос сразу
    addQuestion();
