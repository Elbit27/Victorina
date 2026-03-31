#!/bin/sh

set -e

echo "--> Starting Server with Daphne..."
exec daphne -b 0.0.0.0 -p $PORT config.asgi:application