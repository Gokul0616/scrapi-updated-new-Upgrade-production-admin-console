FROM mcr.microsoft.com/playwright/python:v1.49.1-jammy

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Playwright browsers are already installed in this image


# Copy application code
COPY . .

# Expose port
EXPOSE 8002

# Start command (can be overridden by docker-compose for celery worker)
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8002"]
