# Google Maps Scraper - Background Website Enrichment Implementation

## Overview
Implemented background website enrichment that runs asynchronously after scraping completes, with real-time WebSocket updates to the frontend.

## Architecture Flow

```
1. User triggers Google Maps scrape
   ↓
2. Scraping completes → Results saved to MongoDB → Frontend shows scraped data
   ↓
3. Backend triggers enrichment task (background)
   ↓
4. Celery processes enrichment in parallel (5 websites at a time)
   ↓
5. Each enriched place → Updates MongoDB → WebSocket pushes to frontend
   ↓
6. Frontend receives updates in real-time and displays enriched data
```

## Key Features

### 1. **Background Enrichment Task** (`tasks.enrich_websites_task`)
- Runs asynchronously via Celery
- Processes multiple websites in parallel (batches of 5)
- Sends WebSocket updates for each enriched place
- Stores enriched data permanently in MongoDB

### 2. **Enrichment Data Extracted**
- ✅ Emails (from website, contact pages)
- ✅ Phone numbers (multiple formats)
- ✅ Social media profiles (Facebook, Instagram, Twitter, LinkedIn, YouTube, TikTok, etc.)
- ✅ Physical addresses
- ✅ Contact page URLs

### 3. **WebSocket Real-time Updates**
- Frontend receives updates as each place is enriched
- No need to refresh page - data appears automatically
- Enrichment status tracked per place

### 4. **Data Persistence**
- Enriched data stored in MongoDB Run.output array
- Survives page refreshes
- Merged with existing scraped data

## Files Modified

### Backend (Node.js)
- **`/app/backend/routes/runs.js`**
  - Added POST `/api/runs/:runId/enrich-update` endpoint
  - Triggers enrichment after successful Google Maps scrape
  - Updates MongoDB with enriched data
  - Emits WebSocket events

### Python Scraper Service
- **`/app/scraper-service/tasks.py`**
  - Added `enrich_websites_task()` - Main enrichment Celery task
  - Added `_enrich_places_parallel()` - Parallel processing
  - Added `_enrich_single_place()` - Single place enrichment
  - Added `_send_enrichment_update()` - WebSocket update sender

- **`/app/scraper-service/server.py`**
  - Added POST `/enrich` endpoint
  - Added `EnrichRequest` model
  - Queues enrichment tasks

- **`/app/scraper-service/website_enrichment.py`**
  - Already existed with full enrichment functionality
  - No changes needed

## How It Works

### Step 1: Scraping
```javascript
// User triggers scrape
POST /api/runs
{
  "actorId": "google-maps",
  "input": {
    "query": "restaurants in NYC",
    "location": "New York",
    "maxResults": 50
  }
}
```

### Step 2: Scraping Completes
```javascript
// Backend saves results to MongoDB
run.output = [
  {
    title: "Restaurant A",
    website: "https://restaurant-a.com",
    phone: "+1-555-0123",
    // ... other scraped data
  },
  // ... more places
]
```

### Step 3: Background Enrichment Triggered
```javascript
// Backend automatically triggers enrichment
POST http://localhost:8002/enrich
{
  "run_id": "abc123",
  "places_data": [...] // All scraped places
}
```

### Step 4: Parallel Enrichment
```python
# Celery processes in batches of 5
for batch in batches(places, batch_size=5):
    await asyncio.gather(*[enrich_place(p) for p in batch])
```

### Step 5: Real-time Updates
```javascript
// Each enriched place updates MongoDB
POST /api/runs/:runId/enrich-update
{
  "enrichedPlace": {
    "placeId": "xyz",
    "enrichedEmails": ["contact@restaurant-a.com"],
    "enrichedPhones": ["+1-555-9999"],
    "socialMedia": {
      "facebook": "https://facebook.com/restaurant-a",
      "instagram": "https://instagram.com/restaurant_a"
    },
    "enrichmentStatus": "completed"
  }
}

// WebSocket emits update to frontend
socket.emit('runUpdate', enrichedRun)
```

### Step 6: Frontend Receives Update
```javascript
// Frontend listens for WebSocket updates
socket.on('runUpdate', (run) => {
  // Update UI with enriched data
  // No page refresh needed!
})
```

## Enriched Data Schema

```javascript
{
  // Original scraped data
  "title": "Restaurant A",
  "website": "https://restaurant-a.com",
  "phone": "+1-555-0123",
  "address": "123 Main St",
  
  // Enriched data (added by background task)
  "enrichedEmails": ["contact@restaurant-a.com", "info@restaurant-a.com"],
  "enrichedPhones": ["+1-555-9999", "+1-555-8888"],
  "socialMedia": {
    "facebook": "https://facebook.com/restaurant-a",
    "instagram": "https://instagram.com/restaurant_a",
    "twitter": "https://twitter.com/restaurant_a"
  },
  "enrichedAddresses": ["123 Main St, City, State 12345"],
  "contactPageUrl": "https://restaurant-a.com/contact",
  "enrichmentStatus": "completed" // or "no_data", "failed"
}
```

## Performance

- **Parallel Processing**: 5 websites enriched simultaneously
- **Non-blocking**: Scraping returns immediately, enrichment runs in background
- **Efficient**: Only enriches places with websites
- **Resilient**: Enrichment failures don't affect scrape results

## Testing

### Check Services Status
```bash
echo "MongoDB: $(pgrep mongod > /dev/null && echo '✅' || echo '❌')"
echo "Redis: $(redis-cli ping)"
echo "Backend: $(pgrep -f 'node server.js' > /dev/null && echo '✅' || echo '❌')"
echo "Scraper: $(pgrep -f 'uvicorn server:app.*8002' > /dev/null && echo '✅' || echo '❌')"
echo "Celery: $(pgrep -f 'celery.*worker' > /dev/null && echo '✅' || echo '❌')"
echo "Frontend: $(netstat -tlnp | grep ':3000' > /dev/null && echo '✅' || echo '❌')"
```

### View Logs
```bash
# Backend logs
tail -f /var/log/supervisor/backend.out.log

# Scraper service logs
tail -f /var/log/scraper-service.out.log

# Celery worker logs
tail -f /var/log/celery-worker.out.log

# Frontend logs
tail -f /var/log/supervisor/frontend.out.log
```

### Test Enrichment Endpoint
```bash
curl -X POST http://localhost:8002/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "test-run-123",
    "places_data": [
      {
        "title": "Test Place",
        "website": "https://example.com",
        "placeId": "test123"
      }
    ]
  }'
```

## Troubleshooting

### Enrichment Not Running
1. Check Celery workers: `ps aux | grep celery`
2. Check Celery logs: `tail -f /var/log/celery-worker.out.log`
3. Check Redis: `redis-cli ping`

### WebSocket Updates Not Received
1. Check backend logs for WebSocket errors
2. Verify frontend is connected to WebSocket
3. Check browser console for WebSocket connection

### Enriched Data Not Persisting
1. Check MongoDB connection
2. Verify `/api/runs/:runId/enrich-update` endpoint is being called
3. Check backend logs for save errors

## Future Enhancements

1. **Retry Logic**: Auto-retry failed enrichments
2. **Rate Limiting**: Respect website rate limits
3. **Caching**: Cache enrichment results for common domains
4. **Bulk Enrichment**: Enrich historical runs
5. **Priority Queue**: Prioritize high-value websites

## Notes

- Enrichment only runs for Google Maps scraper (can be extended to other actors)
- Only places with valid website URLs are enriched
- Enrichment failures don't affect the main scrape result
- WebSocket updates are best-effort (if frontend is not connected, data is still saved)
