FROM python:3.9-slim

WORKDIR /app

# Copy the whole project
COPY . .

# Expose port (Cloud providers / Coolify typically use 80, but Coolify maps it dynamically)
# Wait, we need to run it from backend directory or ensure module paths match.
# In server.py we used __file__ so it should be fine.

EXPOSE 80

CMD ["python", "backend/server.py"]
