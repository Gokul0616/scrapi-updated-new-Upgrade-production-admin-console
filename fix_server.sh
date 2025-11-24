#!/bin/bash
echo "Fixing server configuration..."

# Stop the existing worker
pm2 stop scraper-worker || true
pm2 delete scraper-worker || true

# Start with reduced concurrency (1) and memory limit (800M)
# We use 800M to be safe within the 1GB limit we want to enforce, leaving room for overhead
cd /home/ec2-user/scraper-service
pm2 start "venv/bin/celery -A celery_app worker --loglevel=info --concurrency=1" --name scraper-worker --max-memory-restart 800M

# Save PM2 list
pm2 save

echo "Configuration updated. Concurrency set to 1."
pm2 list
