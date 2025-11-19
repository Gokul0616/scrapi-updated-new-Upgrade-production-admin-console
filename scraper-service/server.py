from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import os
from dotenv import load_dotenv
from tasks import scrape_task, enrich_websites_task
from celery.result import AsyncResult
from celery_app import celery_app
from proxy_manager import ProxyManager
from models import ProxyCreate, ProxyUpdate, Proxy, ProxyStats

load_dotenv()

app = FastAPI(title="Scraper Service", version="1.0.0")

# Initialize proxy manager
proxy_manager = ProxyManager()

class ScrapeRequest(BaseModel):
    actor_id: str
    input_data: Dict[str, Any]
    run_id: str  # MongoDB run ID from Node.js backend

class EnrichRequest(BaseModel):
    run_id: str
    places_data: List[Dict[str, Any]]

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@app.get("/")
async def root():
    return {
        "service": "Scraper Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    try:
        # Check Redis connection
        celery_app.connection().ensure_connection(max_retries=1)
        return {"status": "healthy", "redis": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.post("/scrape")
async def create_scrape_task(request: ScrapeRequest):
    """
    Create a new scraping task
    """
    try:
        # Send task to Celery queue
        task = scrape_task.apply_async(
            args=[request.actor_id, request.input_data],
            task_id=request.run_id  # Use MongoDB run_id as Celery task_id
        )
        
        return {
            "task_id": task.id,
            "status": "queued",
            "message": "Scraping task queued successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """
    Get the status of a scraping task
    """
    try:
        task_result = AsyncResult(task_id, app=celery_app)
        
        response = {
            "task_id": task_id,
            "status": task_result.state,
        }
        
        if task_result.state == 'PENDING':
            response["message"] = "Task is waiting in queue"
        elif task_result.state == 'STARTED':
            response["message"] = "Task is being processed"
        elif task_result.state == 'SUCCESS':
            response["result"] = task_result.result
        elif task_result.state == 'FAILURE':
            response["error"] = str(task_result.info)
        else:
            response["message"] = f"Task state: {task_result.state}"
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/task/{task_id}")
async def cancel_task(task_id: str):
    """
    Cancel a running task
    """
    try:
        celery_app.control.revoke(task_id, terminate=True)
        return {"message": f"Task {task_id} cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Proxy Management Endpoints
# ============================================

@app.get("/proxies", response_model=List[Proxy])
async def get_all_proxies():
    """
    Get all configured proxies
    """
    return proxy_manager.get_all_proxies()


@app.get("/proxies/stats", response_model=List[ProxyStats])
async def get_proxy_stats():
    """
    Get statistics for all proxies
    """
    return proxy_manager.get_proxy_stats()


@app.get("/proxies/{proxy_id}", response_model=Proxy)
async def get_proxy(proxy_id: str):
    """
    Get a specific proxy by ID
    """
    proxy = proxy_manager.get_proxy(proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    return proxy


@app.post("/proxies", response_model=Proxy)
async def add_proxy(proxy_data: ProxyCreate):
    """
    Add a new proxy to the pool
    """
    try:
        proxy = proxy_manager.add_proxy(proxy_data)
        return proxy
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/proxies/{proxy_id}", response_model=Proxy)
async def update_proxy(proxy_id: str, proxy_update: ProxyUpdate):
    """
    Update an existing proxy
    """
    proxy = proxy_manager.get_proxy(proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    
    # Update proxy fields
    if proxy_update.host is not None:
        proxy.host = proxy_update.host
    if proxy_update.port is not None:
        proxy.port = proxy_update.port
    if proxy_update.username is not None:
        proxy.username = proxy_update.username
    if proxy_update.password is not None:
        proxy.password = proxy_update.password
    if proxy_update.protocol is not None:
        proxy.protocol = proxy_update.protocol
    if proxy_update.is_active is not None:
        proxy.is_active = proxy_update.is_active
    
    return proxy


@app.delete("/proxies/{proxy_id}")
async def delete_proxy(proxy_id: str):
    """
    Remove a proxy from the pool
    """
    removed = proxy_manager.remove_proxy(proxy_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Proxy not found")
    return {"message": f"Proxy {proxy_id} removed successfully"}


@app.post("/proxies/{proxy_id}/check")
async def check_proxy_health(proxy_id: str, test_url: Optional[str] = "https://httpbin.org/ip"):
    """
    Check the health of a specific proxy
    """
    proxy = proxy_manager.get_proxy(proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    
    is_healthy = await proxy_manager.check_proxy_health(proxy, test_url)
    
    return {
        "proxy_id": proxy_id,
        "is_healthy": is_healthy,
        "success_rate": proxy.get_success_rate(),
        "response_time": proxy.response_time
    }


@app.post("/proxies/check-all")
async def check_all_proxies(test_url: Optional[str] = "https://httpbin.org/ip"):
    """
    Check the health of all proxies
    """
    await proxy_manager.check_all_proxies(test_url)
    return {
        "message": "Health check complete",
        "stats": proxy_manager.get_proxy_stats()
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("SERVICE_PORT", 8002))
    uvicorn.run(app, host=host, port=port)