#!/bin/sh

python manage.py migrate --no-input
python manage.py collectstatic --no-input && echo "Collectstatic completed successfully"

# Создаём суперпользователя, если он ещё не существует
python manage.py shell << EOF
import os
from django.contrib.auth import get_user_model
User = get_user_model()
password = os.environ.get("SUPERUSERS_PASSWORD", "admin123")
if not User.objects.filter(username="admin").exists():
    User.objects.create_superuser("admin", "admin@example.com", password)
EOF

gunicorn config.wsgi:application --bind 0.0.0.0:8000