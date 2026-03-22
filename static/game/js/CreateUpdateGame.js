let questionCount = 0;
let gameId = null;
if (window.editGameData && window.editGameData.id) {
    gameId = window.editGameData.id;
}

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('questions-container');
    const submitBtn = document.getElementById('submit-game');

    if (window.editGameData) {
        document.getElementById('game-title').value = window.editGameData.title;
        submitBtn.innerText = "Сохранить изменения";
        container.innerHTML = '';
        window.editGameData.questions.forEach(q => addQuestion(q));
    } else {
        addQuestion();
    }
});

function addQuestion(data = null) {
    questionCount++;
    const qId = questionCount;
    const container = document.getElementById('questions-container');

    const qHtml = `
        <div class="question-card" id="q-${qId}" data-id="${qId}" style="border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 10px; background: #f9f9f9;">
            <div class="d-flex justify-content-between" style='height:2pc'>
                <strong>Вопрос №${questionCount}</strong>
                <span class="text-danger" style="cursor:pointer" onclick="document.getElementById('q-${questionCount}').remove()">Удалить</span>
            </div>
            <input type="text" class="q-text form-control mb-2" placeholder="Текст вопроса"
                   value="${data ? data.text : ''}">


            <div class="image-upload-section" style="margin-top: 10px;">
                <label>Изображение (необязательно):</label>
                <input type="file" class="question-image form-control" accept="image/*" onchange="previewImage(this)">
                <div class="image-preview" style="margin-top: 5px; display: ${data && data.image ? 'block' : 'none'};">
                    <img src="${data && data.image ? data.image : ''}" style="max-width: 150px; border-radius: 8px;">
                </div>
            </div>

            <div class="answers-section mt-3">
                <h6>Варианты ответов:</h6>
                <div class="answers-list"></div>
                <button type="button" class="btn btn-sm btn-outline-secondary mt-2" onclick="addAnswer(this, ${qId})">+ Добавить ответ</button>
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

function addAnswer(btn, qId, listContainer = null, data = null) {
    // Исправленный поиск контейнера: ищем именно .answers-list
    const list = listContainer || btn.parentElement.querySelector('.answers-list');

    const aHtml = `
        <div class="answer-row d-flex align-items-center mb-2">
            <input type="radio" name="correct-${qId}" class="is-correct me-2" ${data && data.is_correct ? 'checked' : ''}>
            <input type="text" class="a-text form-control form-control-sm me-2" placeholder="Ответ"
                   value="${data ? data.text : ''}">
            <span style="cursor:pointer; color:red; font-weight:bold;" onclick="this.parentElement.remove()">×</span>
        </div>`;
    list.insertAdjacentHTML('beforeend', aHtml);
}

document.getElementById('submit-game').addEventListener('click', async function() {
    const formData = new FormData();
    const title = document.getElementById('game-title').value;

    if (!title) {
        alert("Пожалуйста, введите название викторины");
        return;
    }

    formData.append('title', title);
    const questionsData = [];

    document.querySelectorAll('.question-card').forEach((qCard, qIndex) => {
        // ИСПОЛЬЗУЕМ .q-text (как в шаблоне addQuestion)
        const qTextInput = qCard.querySelector('.q-text');
        if (!qTextInput) return;

        const answers = [];
        qCard.querySelectorAll('.answer-row').forEach(aRow => {
            const aTextInput = aRow.querySelector('.a-text');
            const isCorrectInput = aRow.querySelector('.is-correct');
            if (aTextInput) {
                answers.push({
                    text: aTextInput.value,
                    is_correct: isCorrectInput.checked
                });
            }
        });

        questionsData.push({
            text: qTextInput.value,
            answers: answers
            image_key: null
        });

        const imageInput = qCard.querySelector('.question-image');
        if (imageInput && imageInput.files[0]) {
            const key = `image_${qIndex}`; // Уникальный ключ
            formData.append(key, imageInput.files[0]);
            questionObj.image_key = key; // Записываем ключ в JSON
        }
    });

    formData.append('questions_json', JSON.stringify(questionsData));

    const isEdit = gameId !== null;
    const url = isEdit ? `/game/${gameId}/` : '/game/';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData
        });

        if (response.ok) {
            window.location.href = '/game/game_list/';
        } else {
            const err = await response.json();
            alert("Ошибка: " + JSON.stringify(err));
        }
    } catch (e) {
        console.error("Ошибка при отправке:", e);
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

function previewImage(input) {
    const previewDiv = input.nextElementSibling;
    const img = previewDiv.querySelector('img');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        previewDiv.style.display = 'none';
    }
}