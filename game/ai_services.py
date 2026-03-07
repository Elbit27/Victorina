from google import genai
from config import settings
import json
import re
RAW_KEY = settings.GEMINI_API_KEY
CLEAN_KEY = re.sub(r'[^a-zA-Z0-9_\-]', '', RAW_KEY)

# Создаем клиент
client = genai.Client(api_key=CLEAN_KEY)


def generate_quiz_data(topic, count):
    prompt = f"""
        Create a quiz about "{topic}" with {count} questions.
        RETURN ONLY JSON. 
        JSON STRUCTURE:
        {{
            "title": "Topic Name",
            "questions": [
                {{
                    "text": "Question text here?",
                    "answers": [
                        {{"text": "Correct answer", "is_correct": true}},
                        {{"text": "Wrong answer 1", "is_correct": false}},
                        {{"text": "Wrong answer 2", "is_correct": false}},
                        {{"text": "Wrong answer 3", "is_correct": false}}
                    ]
                }}
            ]
        }}
        """

    try:
        # ВАЖНО: берем модель ровно так, как она написана в твоем списке,
        # но без приставки models/ (библиотека добавит её сама)
        response = client.models.generate_content(
            model='gemini-flash-latest',
            contents=prompt
        )

        text = response.text
        match = re.search(r'\{.*\}', text, re.DOTALL)
        return json.loads(match.group()) if match else json.loads(text)

    except Exception as e:
        print(f"Ошибка: {e}")
        raise ValueError(f"Не удалось сгенерировать тест. Попробуйте gemini-2.0-flash.")