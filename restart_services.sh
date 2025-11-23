#!/bin/bash
# Manual service restart script
# Run this after a reboot if services don't auto-start

echo "Restarting all Scrapi services..."

# Ensure MongoDB and Redis are running
echo "Starting MongoDB..."
sudo systemctl start mongod

echo "Starting Redis..."
sudo systemctl start redis6 || sudo systemctl start redis

# Start/Restart PM2 services
echo "Starting PM2 services..."
cd /home/ec2-user

# Resurrect saved PM2 processes
pm2 resurrect

# If resurrect doesn't work, start manually
if [ $? -ne 0 ]; then
    echo "PM2 resurrect failed, starting services manually..."
    
    # Backend
    cd /home/ec2-user/backend
    pm2 start server.js --name scrapi-backend
    
    # Admin Console
    pm2 start "serve -s /home/ec2-user/admin-console/dist -l 3001" --name admin-console
    
    # Frontend
    pm2 start "serve -s /home/ec2-user/frontend/build -l 3000" --name scrapi-frontend
    
    # Scraper Service
    cd /home/ec2-user/scraper-service
    pm2 start "venv/bin/uvicorn server:app --host 0.0.0.0 --port 8002" --name scraper-api
    pm2 start "venv/bin/celery -A celery_app worker --loglevel=info" --name scraper-worker
fi

echo "All services started!"
pm2 list
