// core/static/core/js/timetable.js
document.addEventListener('DOMContentLoaded', function() {
    const now = new Date();
    let dayOfWeek = now.getDay(); // 0 (Вс) - 6 (Сб)
    if (dayOfWeek === 0) dayOfWeek = 7; // Наше расписание до Сб, но пусть будет 7

    const currentTime = now.getHours().toString().padStart(2, '0') + ":" +
                        now.getMinutes().toString().padStart(2, '0');

    // 1. Подсветка текущего дня
    const currentDayColumn = document.querySelector(`.day-column[data-day="${dayOfWeek}"]`);
    if (currentDayColumn) {
        currentDayColumn.classList.add('active-day');
        currentDayColumn.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }

    // 2. Подсветка текущей пары
    if (currentDayColumn) {
        const lessons = currentDayColumn.querySelectorAll('.lesson-item');
        lessons.forEach(lesson => {
            const start = lesson.dataset.start;
            const end = lesson.dataset.end;

            if (currentTime >= start && currentTime <= end) {
                lesson.classList.add('current-lesson');
                const badge = lesson.querySelector('.time-badge');
                badge.classList.replace('bg-light', 'bg-danger');
                badge.style.color = 'white';
                badge.innerHTML += " • СЕЙЧАС";
            }
        });
    }
});