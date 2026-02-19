FROM python:3.12.3

WORKDIR /app

# Копируем файл зависимостей и устанавливаем их
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

# Копируем скрипт entrypoint и устанавливаем его как точку входа
COPY ./entrypoint.sh /entrypoint.sh
ENTRYPOINT ["sh", "/entrypoint.sh"]

# Копируем все остальные файлы в контейнер
COPY . .