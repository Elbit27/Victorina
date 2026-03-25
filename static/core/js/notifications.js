if (window.isAuthenticated) {
    setInterval(checkNotifications, 10000);
    checkNotifications();
}

async function checkNotifications() {
    if (!window.isAuthenticated) return;
    try {
        const response = await fetch('/api/notifications/unread/');
        if (!response.ok) return;

        const notifications = await response.json();
        const badge = document.getElementById('notify-badge');
        const list = document.getElementById('notification-items');

        if (notifications.length > 0) {
            // красный индикатор
            badge.style.display = 'block';
            badge.innerText = notifications.length;

            // Очищаем текущий список (кроме заголовка)
            const header = list.querySelector('.notification-header');
            list.innerHTML = '';
            if (header) list.appendChild(header);

            notifications.forEach(note => {
                // 1. Если уведомление совсем свежее (создано менее 15 сек назад)
                // показываем prompt (alert), как ты просил
                const noteTime = new Date(note.created_at).getTime();
                const now = new Date().getTime();
                
                if (now - noteTime < 15000) { 
                    // Используем setTimeout, чтобы alert не блокировал отрисовку
                    setTimeout(() => { alert("🔔 " + note.message); }, 500);
                }

                // 2. Добавляем в выпадающий список
                const item = document.createElement('div');
                item.className = 'notification-item';
                item.innerHTML = `
                    <span class="time">${new Date(note.created_at).toLocaleTimeString()}</span>
                    <div class="message">${note.message}</div>
                `;
                list.appendChild(item);
            });
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error("Ошибка при получении уведомлений:", error);
    }
}

if (window.userName !== "AnonymousUser") {
    setInterval(checkNotifications, 10000);
    checkNotifications();
}

document.addEventListener('DOMContentLoaded', function() {
    const dropdownElement = document.getElementById('notificationDropdown');
    const badge = document.getElementById('notify-badge');

    if (dropdownElement) {
        dropdownElement.addEventListener('show.bs.dropdown', function () {

            badge.style.display = 'none';
            badge.innerText = '0';

            // Отправляем запрос на сервер, чтобы пометить уведомления как прочитанные
            markAllAsRead();
        });
    }
});

async function markAllAsRead() {
    if (!window.isAuthenticated) return;
    try {
        await fetch('/api/notifications/mark_all_read/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'Content-Type': 'application/json'
            }
        });
    } catch (e) {
        console.error("Не удалось пометить уведомления как прочитанные", e);
    }
}

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