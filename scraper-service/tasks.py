from celery_app import celery_app
from scrapers.google_maps import scrape_google_maps
from scrapers.amazon import scrape_amazon
from scrapers.instagram import scrape_instagram
from scrapers.twitter import scrape_twitter
from scrapers.facebook import scrape_facebook
from scrapers.linkedin import scrape_linkedin
from scrapers.tiktok import scrape_tiktok
from scrapers.website import scrape_website
from website_enrichment import enrichment_service
import traceback
import asyncio
import logging

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name='tasks.scrape_task')
def scrape_task(self, actor_id, input_data):
    """
    Universal scraping task that routes to appropriate scraper
    """
    try:
        # Update task state to STARTED
        self.update_state(state='STARTED', meta={'status': 'Scraping started'})
        
        # Route to appropriate scraper based on actor_id
        scraper_map = {
            'google-maps': scrape_google_maps,
            'amazon': scrape_amazon,
            'instagram': scrape_instagram,
            'twitter': scrape_twitter,
            'facebook': scrape_facebook,
            'linkedin': scrape_linkedin,
            'tiktok': scrape_tiktok,
            'website': scrape_website,
        }
        
        scraper_func = scraper_map.get(actor_id)
        
        if not scraper_func:
            raise ValueError(f"Unknown actor_id: {actor_id}")
        
        # Execute scraping
        result = scraper_func(input_data)
        
        return {
            'status': 'success',
            'data': result
        }
        
    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        return {
            'status': 'error',
            'error': error_msg,
            'traceback': error_trace
        }