# AWS Free Tier Hosting Guide

**Can you host this on AWS Free Tier?**
**Short Answer:** Yes, but it will be tight.
**Long Answer:** The AWS Free Tier offers a `t2.micro` or `t3.micro` instance with only **1 GB of RAM**. This is very limited for a stack that includes a web scraper (Browser Automation), Database, and API.

## The Challenge: RAM
- **Browser Automation (Playwright)**: Launching a Chromium browser is memory-intensive. A single page load can take 100MB-500MB+.
- **MongoDB & Redis**: Database services consume RAM to be performant.
- **Node.js & Python**: The application runtimes themselves need memory.

If you try to run everything on a standard 1GB instance, your application will likely crash with "Out of Memory" errors when you start scraping.

## The Solution: "Hybrid" Free Tier Strategy

To make this work for free, you need to be smart about resources:

### 1. Offload the Database & Cache (Recommended)
Don't run MongoDB and Redis on the EC2 instance. Use managed free tiers:
- **MongoDB**: Use [MongoDB Atlas](https://www.mongodb.com/atlas/database) (Free Shared Cluster). You get 512MB storage for free.
- **Redis**: Use [Redis Cloud](https://redis.com/try-free/) (Free Tier) or similar. 30MB is usually enough for a simple job queue.

### 2. Enable Swap Space (CRITICAL)
On your EC2 instance, you **MUST** create a "Swap File". This allows the OS to use the hard drive as "fake RAM" when real RAM runs out. It's slower, but it prevents crashes.

**Run these commands on your EC2 instance:**
```bash
# 1. Create a 4GB swap file
sudo fallocate -l 4G /swapfile

# 2. Secure the file
sudo chmod 600 /swapfile

# 3. Mark it as swap space
sudo mkswap /swapfile

# 4. Enable it
sudo swapon /swapfile

# 5. Make it permanent (add to fstab)
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Limit Concurrency
You cannot run multiple scrapers in parallel on a micro instance.
- In `docker-compose.yml`, ensure the Celery worker concurrency is set to **1**.
  ```yaml
  command: celery -A celery_app worker --loglevel=info --concurrency=1
  ```

## Revised Docker Compose for Free Tier
Create a `docker-compose.prod.yml` that removes the local databases and connects to the external ones.

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    restart: always

  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - PORT=8001
      - NODE_ENV=production
      # CONNECT TO EXTERNAL FREE TIERS
      - MONGO_URL=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/scrapi
      - REDIS_URL=redis://:<pass>@redis-endpoint:port
      - JWT_SECRET=change_this_secret
    restart: always

  scraper-service:
    build: ./scraper-service
    ports:
      - "8002:8002"
    environment:
      - SERVICE_HOST=0.0.0.0
      - SERVICE_PORT=8002
      - CELERY_BROKER_URL=redis://:<pass>@redis-endpoint:port
      - CELERY_RESULT_BACKEND=redis://:<pass>@redis-endpoint:port
    restart: always

  celery-worker:
    build: ./scraper-service
    # CRITICAL: Concurrency set to 1 to save RAM
    command: celery -A celery_app worker --loglevel=info --concurrency=1
    environment:
      - CELERY_BROKER_URL=redis://:<pass>@redis-endpoint:port
      - CELERY_RESULT_BACKEND=redis://:<pass>@redis-endpoint:port
    depends_on:
      - scraper-service
    restart: always
```

## Summary
1.  Launch **t3.micro** (Free Tier eligible).
2.  Set up **4GB Swap**.
3.  Use **MongoDB Atlas** (Free) and **Redis Cloud** (Free).
4.  Run with **Concurrency=1**.

This setup will cost $0/month (for the first 12 months of AWS account) and will be stable enough for light usage.
