#!/bin/bash
set -e

echo "Starting deployment..."

# Install Node.js 20 on Amazon Linux 2023 / 2
echo "Installing Node.js 20..."
sudo yum update -y
sudo yum install -y nodejs npm

# If node is not found or old, try nvm or nodesource (Amazon Linux usually has recent node via yum or dnf)
# Let's try to ensure we have a recent version
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    echo "Installing Node.js 20 via NodeSource..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
fi

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
# Assuming the tarball extracts admin-console/dist to /home/ec2-user/admin-console/dist
pm2 start "serve -s /home/ec2-user/admin-console/dist -l 3001" --name admin-console

echo "Deployment complete!"
