#!/bin/sh

# Останавливаем скрипт при любой ошибке
set -e

echo "--> Starting Server with Daphne..."
exec daphne -u /tmp/daphne.sock -b 0.0.0.0 -p $PORT config.asgi:application