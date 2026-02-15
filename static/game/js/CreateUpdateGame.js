let questionCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('questions-container');
    const submitBtn = document.getElementById('submit-game');

    if (window.editGameData) {
        document.getElementById('game-title').value = window.editGameData.title;
        submitBtn.innerText = "Сохранить изменения";

        container.innerHTML = '';
        window.editGameData.questions.forEach(q => addQuestion(q));
    } else {
        addQuestion(); // Очистка контейнера, чтобы вопросы не дублировались при обновлении страницы.
    }
});

function addQuestion(data = null) {
    questionCount++;
    const container = document.getElementById('questions-container');

    const qHtml = `
        <div class="question-card border p-3 mb-3" id="q-${questionCount}">
            <div class="d-flex justify-content-between">
                <strong>Вопрос №${questionCount}</strong>
                <span class="text-danger" style="cursor:pointer" onclick="document.getElementById('q-${questionCount}').remove()">Удалить</span>
            </div>
            <input type="text" class="q-text form-control mt-2" placeholder="Текст вопроса"
                   value="${data ? data.text : ''}">
            <div class="answers-list mt-3"></div>
            <button type="button" class="btn btn-sm btn-link p-0 mt-2"
                    onclick="addAnswer(this, ${questionCount})">+ Добавить ответ</button>
        </div>`;

    container.insertAdjacentHTML('beforeend', qHtml);
    const answersList = document.getElementById(`q-${questionCount}`).querySelector('.answers-list');

    if (data && data.answers) {
        data.answers.forEach(ans => addAnswer(null, questionCount, answersList, ans));
    } else {
        addAnswer(null, questionCount, answersList);
        addAnswer(null, questionCount, answersList);
    }
}

function addAnswer(btn, qId, listContainer = null, data = null) {
    const list = listContainer || btn.previousElementSibling;
    const aHtml = `
        <div class="answer-row d-flex align-items-center mb-2">
            <input type="radio" name="correct-${qId}" class="is-correct me-2" ${data && data.is_correct ? 'checked' : ''}>
            <input type="text" class="a-text form-control form-control-sm me-2" placeholder="Ответ"
                   value="${data ? data.text : ''}">
            <span style="cursor:pointer" onclick="this.parentElement.remove()">×</span>
        </div>`;
    list.insertAdjacentHTML('beforeend', aHtml);
}

// Creating a new game functionality
document.getElementById('submit-game').addEventListener('click', async function() {
    const data = {
        title: document.getElementById('game-title').value,
        questions: []
    };

    document.querySelectorAll('.question-card').forEach((qCard) => {
        const question = {
            text: qCard.querySelector('.q-text').value,
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

    const isEdit = window.editGameData !== null;

    // Теперь это выглядит максимально чисто:
    const url = isEdit ? `/game/games/${window.editGameData.id}/` : '/game/games/';
    const method = isEdit ? 'PUT' : 'POST';

    console.log(`Запрос отправляется на: ${url} методом ${method}`);

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            window.location.href = '/game/game_list/';
        } else {
            const err = await response.json();
            alert("Ошибка: " + JSON.stringify(err));
        }
    } catch (e) {
        console.error(e);
    }
});

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