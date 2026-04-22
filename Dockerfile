FROM python:3.9-slim

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY . .

# Expose port
EXPOSE 80

CMD ["uvicorn", "server:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "80"]
