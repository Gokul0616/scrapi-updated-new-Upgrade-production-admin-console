from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

# Celery configuration
celery_app = Celery(
    'scraper_service',
    broker=os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    backend=os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0'),
    include=['tasks']
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=1200,  # 20 minutes hard limit (increased from 5 minutes)
    task_soft_time_limit=1080,  # 18 minutes soft limit (increased from 4 minutes)
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=10,
)

if __name__ == '__main__':
    celery_app.start()
