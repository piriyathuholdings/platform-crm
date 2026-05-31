FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 9000

CMD ["sh", "-c", "export DATABASE_URL=\"postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}\" && python -c \"from app.db import init_db; init_db()\" && python seed_user.py && uvicorn app.main:app --host 0.0.0.0 --port 9000"]
