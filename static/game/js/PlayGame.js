document.addEventListener('DOMContentLoaded', () => {
    const gameDataElement = document.getElementById('game-data');
    const data = JSON.parse(gameDataElement.textContent);
    const questions = data.questions;

    let currentIdx = 0;
    let score = 0;
    let canClick = true;

    const questionText = document.getElementById('question-text');
    const answersGrid = document.getElementById('answers-grid');
    const progressText = document.getElementById('progress');
    const progressBar = document.getElementById('progress-bar');
    const gameScreen = document.getElementById('game-screen');
    const resultScreen = document.getElementById('result-screen');
    const finalScoreText = document.getElementById('final-score');
    const finalScoreVal = document.getElementById('final-score-val');

    function renderQuestion() {
        if (currentIdx >= questions.length) {
            showResults();
            return;
        }

        canClick = true;
        const q = questions[currentIdx];

        const percent = (currentIdx / questions.length) * 100;
        progressBar.style.width = `${percent}%`;
        progressText.innerText = `Вопрос ${currentIdx + 1} из ${questions.length}`;
        
        questionText.innerText = q.text;

        answersGrid.innerHTML = '';
        q.answers.forEach((ans) => {
            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.innerText = ans.text;
            btn.onclick = () => handleAnswer(btn, ans.is_correct);
            answersGrid.appendChild(btn);
        });
    }

    function handleAnswer(selectedBtn, isCorrect) {
        if (!canClick) return;
        canClick = false;

        const allButtons = answersGrid.querySelectorAll('.answer-btn');

        if (isCorrect) {
            selectedBtn.classList.add('correct');
            score++;
        } else {
            selectedBtn.classList.add('wrong');
            const q = questions[currentIdx];
            allButtons.forEach((btn, index) => {
                if (q.answers[index].is_correct) {
                    btn.classList.add('correct');
                }
            });
        }

        setTimeout(() => {
            currentIdx++;
            renderQuestion();
        }, 1200);
    }

    function showResults() {
        progressBar.style.width = '100%';
        gameScreen.style.display = 'none';
        resultScreen.style.display = 'block';
        finalScoreVal.innerText = score;
        finalScoreText.innerText = `Вы набрали ${score} из ${questions.length} очков!`;
    }

    if (questions.length > 0) {
        renderQuestion();
    } else {
        questionText.innerText = "В этой викторине пока нет вопросов.";
    }
});