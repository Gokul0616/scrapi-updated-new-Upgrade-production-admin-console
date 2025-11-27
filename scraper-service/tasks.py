from celery_app import celery_app
from scrapers.google_maps import scrape_google_maps
from scrapers.google_business import scrape_google_business
from scrapers.amazon import scrape_amazon
from scrapers.instagram import scrape_instagram
from scrapers.twitter import scrape_twitter
from scrapers.facebook import scrape_facebook
from scrapers.linkedin import scrape_linkedin
from scrapers.tiktok import scrape_tiktok
from scrapers.website import scrape_website
from scrapers.apollo import scrape_apollo
from website_enrichment import enrichment_service
import traceback
import asyncio
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name='tasks.scrape_task')
def scrape_task(self, actor_id, input_data, run_id=None):
    """
    Universal scraping task that routes to appropriate scraper
    """
    # Extract run_id from input if not passed explicitly (backward compatibility)
    if not run_id and isinstance(input_data, dict) and 'run_id' in input_data:
        run_id = input_data.get('run_id')
        
    try:
        # Update task state to STARTED
        self.update_state(state='STARTED', meta={'status': 'Scraping started'})
        
        # Send STARTED webhook
        if run_id:
            asyncio.run(_send_status_update(run_id, 'started'))
        
        # Route to appropriate scraper based on actor_id
        scraper_map = {
            'google-maps': scrape_google_maps,
            'google-business': scrape_google_business,
            'amazon': scrape_amazon,
            'instagram': scrape_instagram,
            'twitter': scrape_twitter,
            'facebook': scrape_facebook,
            'linkedin': scrape_linkedin,
            'tiktok': scrape_tiktok,
            'website': scrape_website,
            'apollo': scrape_apollo,
        }
        
        scraper_func = scraper_map.get(actor_id)
        
        if not scraper_func:
            raise ValueError(f"Unknown actor_id: {actor_id}")
        
        # Execute scraping
        result = scraper_func(input_data)
        
        # Send SUCCESS webhook
        if run_id:
            asyncio.run(_send_status_update(run_id, 'success', result={'data': result}))
        
        return {
            'status': 'success',
            'data': result
        }
        
    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        # Send ERROR webhook
        if run_id:
            asyncio.run(_send_status_update(run_id, 'error', error=error_msg))
        
        return {
            'status': 'error',
            'error': error_msg,
            'traceback': error_trace
        }

async def _send_status_update(run_id, status, result=None, error=None):
    """
    Send status update to Node.js backend via HTTP
    """
    import aiohttp
    import os
    
    try:
        backend_url = os.getenv('BACKEND_URL', 'http://backend:8001')
        # Fallback for local development if not running in Docker network
        if 'localhost' in backend_url and os.getenv('SERVICE_HOST') == '0.0.0.0':
             # If we are inside docker but backend is localhost, we might need host.docker.internal
             # But usually backend:8001 is correct for docker-compose
             pass

        payload = {'status': status}
        if result:
            payload['result'] = result
        if error:
            payload['error'] = error
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{backend_url}/api/runs/{run_id}/status",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    logger.info(f"✅ Sent {status} update for run {run_id}")
                else:
                    logger.warning(f"⚠️ Failed to send {status} update: {response.status}")
                    
    except Exception as e:
        logger.warning(f"Failed to send status update: {str(e)}")


@celery_app.task(bind=True, name='tasks.enrich_websites_task')
def enrich_websites_task(self, run_id, places_data):
    """
    Background task to enrich website data for scraped places.
    Processes multiple websites in parallel and sends WebSocket updates.
    
    Args:
        run_id: The MongoDB run ID
        places_data: List of places with website URLs to enrich
    """
    try:
        self.update_state(state='STARTED', meta={'status': 'Enrichment started'})
        
        logger.info(f"🔍 Starting enrichment for run {run_id} with {len(places_data)} places")
        
        # Filter places that have websites
        places_with_websites = [
            place for place in places_data 
            if place.get('website') and isinstance(place.get('website'), str)
        ]
        
        if not places_with_websites:
            logger.info(f"No websites to enrich for run {run_id}")
            return {
                'status': 'success',
                'enriched_count': 0,
                'message': 'No websites to enrich'
            }
        
        logger.info(f"📊 Found {len(places_with_websites)} places with websites to enrich")
        
        # Run async enrichment in parallel
        enriched_count = asyncio.run(_enrich_places_parallel(run_id, places_with_websites))
        
        logger.info(f"✅ Enrichment completed for run {run_id}: {enriched_count}/{len(places_with_websites)} places enriched")
        
        return {
            'status': 'success',
            'enriched_count': enriched_count,
            'total_places': len(places_with_websites)
        }
        
    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        logger.error(f"❌ Enrichment error for run {run_id}: {error_msg}")
        logger.error(error_trace)
        
        return {
            'status': 'error',
            'error': error_msg,
            'traceback': error_trace
        }


async def _enrich_places_parallel(run_id, places_with_websites):
    """
    Enrich multiple places in parallel and send WebSocket updates.
    """
    import aiohttp
    
    enriched_count = 0
    
    # Process in batches of 5 to avoid overwhelming the system
    batch_size = 5
    
    for i in range(0, len(places_with_websites), batch_size):
        batch = places_with_websites[i:i+batch_size]
        
        # Create enrichment tasks for this batch
        tasks = []
        for place in batch:
            tasks.append(_enrich_single_place(run_id, place))
        
        # Run batch in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count successful enrichments
        for result in results:
            if result and not isinstance(result, Exception):
                enriched_count += 1
        
        # Small delay between batches
        await asyncio.sleep(0.5)
    
    return enriched_count


async def _enrich_single_place(run_id, place):
    """
    Enrich a single place and send WebSocket update to backend.
    """
    try:
        website_url = place.get('website')
        place_id = place.get('placeId') or place.get('url', '')
        
        logger.info(f"🔍 Enriching {place.get('title', 'Unknown')} - {website_url}")
        
        # Perform enrichment
        enrichment_data = await enrichment_service.enrich_from_website(
            website_url=website_url,
            check_contact_page=True,
            timeout=10
        )
        
        # Merge enrichment data into place
        if enrichment_data:
            # Only update if we found new data
            if enrichment_data.get('emails'):
                place['enrichedEmails'] = enrichment_data['emails']
            if enrichment_data.get('phones'):
                place['enrichedPhones'] = enrichment_data['phones']
            if enrichment_data.get('socialMedia'):
                # Merge with existing social media
                existing_social = place.get('socialMedia', {})
                enriched_social = {**existing_social, **enrichment_data['socialMedia']}
                place['socialMedia'] = enriched_social
            if enrichment_data.get('addresses'):
                place['enrichedAddresses'] = enrichment_data['addresses']
            if enrichment_data.get('contactPageUrl'):
                place['contactPageUrl'] = enrichment_data['contactPageUrl']
            
            place['enrichmentStatus'] = 'completed'
            
            logger.info(f"✅ Enriched {place.get('title', 'Unknown')}: {len(enrichment_data.get('emails', []))} emails, {len(enrichment_data.get('phones', []))} phones")
        else:
            place['enrichmentStatus'] = 'no_data'
            logger.info(f"⚠️ No enrichment data found for {place.get('title', 'Unknown')}")
        
        # Send WebSocket update to backend
        await _send_enrichment_update(run_id, place)
        
        return True
        
    except Exception as e:
        logger.error(f"Error enriching place {place.get('title', 'Unknown')}: {str(e)}")
        place['enrichmentStatus'] = 'failed'
        return False


async def _send_enrichment_update(run_id, enriched_place):
    """
    Send enrichment update to Node.js backend via HTTP (backend will handle WebSocket).
    """
    import aiohttp
    import os
    
    try:
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:8001')
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{backend_url}/api/runs/{run_id}/enrich-update",
                json={'enrichedPlace': enriched_place},
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status == 200:
                    logger.debug(f"✅ Sent enrichment update for {enriched_place.get('title', 'Unknown')}")
                else:
                    logger.warning(f"⚠️ Failed to send enrichment update: {response.status}")
                    
    except Exception as e:
        logger.warning(f"Failed to send WebSocket update: {str(e)}")