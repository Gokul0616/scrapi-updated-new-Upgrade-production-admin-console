#!/bin/bash
set -e

echo "Starting deployment of ALL services (Ubuntu)..."

# --- System Dependencies ---

# Update package list
sudo apt-get update -y

# Install Node.js 20
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Python 3 and Pip
echo "Installing Python 3..."
sudo apt-get install -y python3 python3-pip python3-venv

# Install Redis (required for Celery)
echo "Installing Redis..."
sudo apt-get install -y redis-server
sudo systemctl enable --now redis-server

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install Serve
if ! command -v serve &> /dev/null; then
    sudo npm install -g serve
fi

# Extract archive
echo "Extracting files..."
# We assume the tarball contains: backend, admin-console/dist, frontend/build, scraper-service, deploy_all.sh
tar -xzf deployment.tar.gz

# --- Backend Setup (Port 8001) ---
echo "Setting up Backend..."
cd backend
cp env.production .env
npm install
pm2 delete scrapi-backend || true
pm2 start server.js --name scrapi-backend
cd ..

# --- Admin Console Setup (Port 3001) ---
echo "Setting up Admin Console..."
# dist folder is already uploaded
pm2 delete admin-console || true
pm2 start "serve -s /home/ubuntu/admin-console/dist -l 3001" --name admin-console

# --- Frontend Setup (Port 3000) ---
echo "Setting up Frontend..."
# build folder is already uploaded
pm2 delete scrapi-frontend || true
pm2 start "serve -s /home/ubuntu/frontend/build -l 3000" --name scrapi-frontend

# --- Scraper Service Setup (Port 8000 + Celery) ---
echo "Setting up Scraper Service..."
cd scraper-service
# Create venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install
# Install Playwright dependencies for Ubuntu
echo "Installing Playwright dependencies..."
sudo npx playwright install-deps
# Fallback manual install if needed
# sudo apt-get install -y libwoff1 libopus0 libwebp7 libwebpdemux2 libenchant-2-2 libgudev-1.0-0 libsecret-1-0 libhyphen0 libgdk-pixbuf2.0-0 libegl1 libnotify4 libxslt1.1 libevent-2.1-7 libgles2 libvpx7 libxcomposite1 libatk1.0-0 libatk-bridge2.0-0 libepoxy0 libgtk-3-0 libharfbuzz-icu0

# Start API Server
pm2 delete scraper-api || true
pm2 start "venv/bin/uvicorn server:app --host 0.0.0.0 --port 8002" --name scraper-api

# Start Celery Worker
pm2 delete scraper-worker || true
# Using concurrency=2 to be safe on t3.medium/large, can be adjusted
pm2 start "venv/bin/celery -A celery_app worker --loglevel=info --concurrency=2" --name scraper-worker

echo "Deployment complete! Services running:"
pm2 list
