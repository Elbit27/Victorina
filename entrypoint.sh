#!/bin/sh

# Останавливаем скрипт при любой ошибке
set -e

echo "--> Applying migrations..."
python manage.py migrate --no-input

echo "--> Collecting static..."
python manage.py collectstatic --no-input

echo "--> Creating superuser..."
python manage.py shell << EOF
import os
from django.contrib.auth import get_user_model
User = get_user_model()
username = "admin"
password = os.environ.get("SUPERUSER_PASSWORD", "27")
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, "admin@example.com", password)
    print(f"Superuser {username} created successfully.")
else:
    print(f"Superuser {username} already exists.")
EOF

# ВАЖНО: Используем Daphne для поддержки WebSocket
# И используем переменную $PORT, которую дает Render
echo "--> Starting Server..."
exec daphne -b 0.0.0.0 -p $PORT config.asgi:application