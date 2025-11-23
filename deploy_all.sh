#!/bin/bash
set -e

echo "Starting deployment of ALL services..."

# --- System Dependencies ---

# Install Node.js 20
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    echo "Installing Node.js 20..."
    sudo yum update -y
    sudo yum install -y nodejs npm
    # Fallback/Ensure
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
fi

# Install Python 3 and Pip
echo "Installing Python 3..."
sudo yum install -y python3 python3-pip

# Install Redis (required for Celery)
echo "Installing Redis..."
# Amazon Linux 2023
sudo dnf install -y redis6 || sudo amazon-linux-extras install redis6 || sudo yum install -y redis
# Try enabling redis6 or redis
sudo systemctl enable --now redis6 || sudo systemctl enable --now redis

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
npm install
pm2 delete scrapi-backend || true
pm2 start server.js --name scrapi-backend
cd ..

# --- Admin Console Setup (Port 3001) ---
echo "Setting up Admin Console..."
# dist folder is already uploaded
pm2 delete admin-console || true
pm2 start "serve -s /home/ec2-user/admin-console/dist -l 3001" --name admin-console

# --- Frontend Setup (Port 3000) ---
echo "Setting up Frontend..."
# build folder is already uploaded
pm2 delete scrapi-frontend || true
pm2 start "serve -s /home/ec2-user/frontend/build -l 3000" --name scrapi-frontend

# --- Scraper Service Setup (Port 8000 + Celery) ---
echo "Setting up Scraper Service..."
cd scraper-service
# Create venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install
# playwright install-deps doesn't work well on Amazon Linux, installing manually
echo "Installing Playwright dependencies..."
sudo yum install -y alsa-lib atk cups-libs gtk3 libXcomposite libXcursor libXdamage libXext libXi libXrandr libXScrnSaver libXtst pango xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-utils xorg-x11-fonts-cyrillic xorg-x11-fonts-Type1 xorg-x11-fonts-misc libdrm mesa-libgbm

# Start API Server
pm2 delete scraper-api || true
pm2 start "venv/bin/uvicorn server:app --host 0.0.0.0 --port 8002" --name scraper-api

# Start Celery Worker
pm2 delete scraper-worker || true
pm2 start "venv/bin/celery -A celery_app worker --loglevel=info" --name scraper-worker

echo "Deployment complete! Services running:"
pm2 list
