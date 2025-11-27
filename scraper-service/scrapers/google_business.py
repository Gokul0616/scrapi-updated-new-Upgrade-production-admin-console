import asyncio
import logging
import re
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
from bs4 import BeautifulSoup
import aiohttp
import sys
import os

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from base_scraper import BaseScraper
from scraper_engine import ScraperEngine
from proxy_manager import ProxyManager
from scrapers.google_maps import GoogleMapsScraperV3

logger = logging.getLogger(__name__)

class GoogleBusinessScraper(GoogleMapsScraperV3):
    """
    Google Business Details Scraper.
    Specialized for extracting detailed information for specific businesses.
    """
    
    @classmethod
    def get_name(cls) -> str:
        return "Google Business Details Scraper"
    
    @classmethod
    def get_description(cls) -> str:
        return "Extract detailed business information including verified contacts, social media, and reviews."
    
    @classmethod
    def get_category(cls) -> str:
        return "Business & Leads"
    
    @classmethod
    def get_icon(cls) -> str:
        return "🏢"
    
    @classmethod
    def get_tags(cls) -> List[str]:
        return ["business", "google", "contacts", "leads", "email", "phone"]
    
    def get_input_schema(self) -> Dict[str, Any]:
        return {
            "business_name": {"type": "string", "description": "Name of the business"},
            "location": {"type": "string", "description": "Location (City, State, or Address)"},
            "extract_reviews": {"type": "boolean", "default": True},
            "extract_images": {"type": "boolean", "default": True}
        }
    
    async def scrape(self, config: Dict[str, Any], progress_callback=None) -> List[Dict[str, Any]]:
        """
        Scrape specific business details.
        """
        business_name = config.get('business_name', '')
        location = config.get('location', '')
        extract_reviews = config.get('extract_reviews', True)
        extract_images = config.get('extract_images', True)
        
        # Construct search query
        search_query = f"{business_name} {location}".strip()
        
        # Reuse the search logic from GoogleMapsScraperV3 but limit to fewer results as we are looking for a specific business
        # We'll fetch a few to ensure we get the right one, but the user likely wants the top match.
        config['search_terms'] = [search_query]
        config['max_results'] = 5 # Fetch top 5 to be safe, but we can filter later if needed.
        
        # We can just call the parent scrape method which handles the search and extraction
        # But we need to adapt the config to match what GoogleMapsScraperV3 expects
        
        # Create a temporary config for the parent method
        parent_config = {
            'search_terms': [search_query],
            'location': '', # Location is already in search query
            'max_results': 5,
            'extract_reviews': extract_reviews,
            'extract_images': extract_images
        }
        
        return await super().scrape(parent_config, progress_callback)

# Wrapper function for sync calls
def scrape_google_business(input_data):
    """
    Synchronous wrapper for the async GoogleBusinessScraper.
    """
    # Create engine and scraper
    proxy_manager = ProxyManager()
    engine = ScraperEngine(proxy_manager)
    scraper = GoogleBusinessScraper(engine)
    
    # Run async scrape in event loop
    try:
        # Get or create event loop
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Run the async scrape method
        results = loop.run_until_complete(scraper.scrape(input_data))
        
        # Cleanup
        loop.run_until_complete(engine.cleanup())
        
        return results
    except Exception as e:
        logger.error(f"Error in scrape_google_business: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {'error': str(e)}
