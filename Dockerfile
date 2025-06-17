FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application files
COPY setlist_service.py .
COPY setlist_scraper.py .
COPY proxy_provider.py .
COPY proxy-list.txt .

EXPOSE 8000

CMD ["uvicorn", "setlist_service:app", "--host", "0.0.0.0", "--port", "8000"]

