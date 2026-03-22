document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('aiForm');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // чтобы страница не перезагружалась

            const topic = document.getElementById('topic').value;
            const count = document.getElementById('count').value;
            const loader = document.getElementById('loader');

            form.style.display = 'none';
            loader.style.display = 'block';

            try {
                const response = await fetch('/game/generate_ai/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        topic: topic,
                        count: parseInt(count)
                    })
                });

                if (response.ok) {
                    window.location.href = "/";
                } else {
                    const data = await response.json();
                    alert('Ошибка ИИ: ' + JSON.stringify(data.error));
                    form.style.display = 'flex';
                    loader.style.display = 'none';
                }
            } catch (error) {
                console.error('Fetch error:', error);
                alert('Ошибка сервера. Проверьте консоль.');
                form.style.display = 'flex';
                loader.style.display = 'none';
            }
        });
    }
});

// Функция получения куки
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