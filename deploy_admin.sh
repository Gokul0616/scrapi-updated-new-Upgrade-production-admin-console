#!/bin/bash
set -e

echo "Starting deployment..."

# Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pm2 globally if missing
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Extract archive
echo "Extracting files..."
tar -xzf admin_deploy.tar.gz

# Backend Setup
echo "Setting up Backend..."
cd backend
npm install
# Restart backend using PM2
pm2 delete scrapi-backend || true
pm2 start server.js --name scrapi-backend

# Admin Console Setup
echo "Setting up Admin Console..."
# dist folder is already uploaded
# cd ../admin-console # No need to cd if we just point serve to the right place, but let's be consistent

# Serve Admin Console using PM2 and serve
if ! command -v serve &> /dev/null; then
    sudo npm install -g serve
fi

pm2 delete admin-console || true
# Assuming the tarball extracts admin-console/dist to /home/ubuntu/admin-console/dist
pm2 start "serve -s /home/ubuntu/admin-console/dist -l 3001" --name admin-console

echo "Deployment complete!"
