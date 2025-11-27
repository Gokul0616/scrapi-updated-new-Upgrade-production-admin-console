# AWS Deployment Guide for Scrapi

This guide outlines how to deploy the containerized Scrapi application to Amazon Web Services (AWS).

## Architecture Overview

For a production environment on AWS, we recommend the following changes from the local `docker-compose` setup:
- **Compute**: AWS ECS (Elastic Container Service) or EC2.
- **Database**: AWS DocumentDB (MongoDB compatible) instead of a local Mongo container.
- **Cache**: AWS ElastiCache (Redis) instead of a local Redis container.
- **Storage**: Amazon S3 for storing scraped data/files (if applicable).

---

## Option 1: EC2 with Docker Compose (Simplest)

This is the fastest way to get your application running, similar to your local environment.

### 1. Launch an EC2 Instance
- **AMI**: Ubuntu Server 22.04 LTS.
- **Instance Type**: `t3.medium` or larger (need enough RAM for Puppeteer/Playwright).
- **Security Group**: Allow Inbound ports `80` (HTTP), `443` (HTTPS), `22` (SSH).

### 2. Install Docker & Docker Compose
SSH into your instance and run:
```bash
# Update and install Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Deploy Application
1.  **Transfer the deployment package**:
    Copy `deployment.tar.gz` to your EC2 instance (e.g., using `scp`).
    ```bash
    scp -i <your-key.pem> deployment.tar.gz ec2-user@<EC2-Public-IP>:~/
    ```
2.  **SSH into your instance**:
    ```bash
    ssh -i <your-key.pem> ec2-user@<EC2-Public-IP>
    ```
3.  **Run the deployment script**:
    ```bash
    # Extract the script first (or just run the following if you have the tarball)
    tar -xzf deployment.tar.gz deploy_all.sh
    
    # Run the deployment script
    chmod +x deploy_all.sh
    ./deploy_all.sh
    ```
    This script will:
    - Install Node.js, Python, Redis, and PM2.
    - Extract the application files.
    - Install dependencies for Backend and Scraper Service.
    - Start all services using PM2.

### 4. Access
- **Frontend**: `http://<EC2-Public-IP>:3000`
- **Admin Console**: `http://<EC2-Public-IP>:3001`
- **Backend API**: `http://<EC2-Public-IP>:8001`

---

## Option 2: AWS ECS Fargate (Scalable & Managed)

This is the recommended approach for a robust production environment.

### 1. Push Images to Amazon ECR
Create repositories for your services and push your Docker images:
```bash
# Login
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Build and Push Frontend
docker build -t scrapi-frontend ./frontend
docker tag scrapi-frontend:latest <ecr-repo-url>/scrapi-frontend:latest
docker push <ecr-repo-url>/scrapi-frontend:latest

# Build and Push Backend
docker build -t scrapi-backend ./backend
docker push ...

# Build and Push Scraper
docker build -t scrapi-scraper ./scraper-service
docker push ...
```

### 2. Infrastructure Setup
- **VPC**: Use default or create a new one with Public/Private subnets.
- **Load Balancer (ALB)**: Create an Application Load Balancer to route traffic to your Frontend and Backend services.
- **Databases**:
    - Create an **Amazon DocumentDB** cluster (MongoDB).
    - Create an **Amazon ElastiCache** for Redis.

### 3. Create ECS Task Definitions
Create task definitions for each service.
- **Environment Variables**: Point `MONGO_URL` and `REDIS_URL` to your managed AWS instances.

### 4. Create ECS Services
- **Frontend Service**: Map port 80. Connect to ALB Listener (e.g., path `/`).
- **Backend Service**: Map port 8001. Connect to ALB Listener (e.g., path `/api/*`).
- **Scraper Service**: No public access needed. Internal communication via Redis/Celery.
- **Celery Worker**: No ports needed. Just needs access to Redis.

---

## Important Production Considerations

### 1. Database Persistence
In the `docker-compose.yml`, we use volumes (`mongo_data`). On EC2, this saves data to the instance disk. **If the instance is terminated, data is lost** unless you use EBS snapshots.
**Recommendation**: Use AWS DocumentDB for critical data.

### 2. SSL/HTTPS
- **EC2**: Install Certbot/Let's Encrypt on the Nginx container or host.
- **ECS**: Use AWS Certificate Manager (ACM) with the Application Load Balancer for free, managed SSL certificates.

### 3. Scaling
- **Scraper Service**: This is resource-intensive (browser automation). Monitor CPU/RAM usage. ECS allows you to scale the number of scraper containers/tasks based on queue depth (Redis list length).
