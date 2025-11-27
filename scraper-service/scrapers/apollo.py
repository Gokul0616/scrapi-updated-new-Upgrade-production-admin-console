import asyncio
import logging
import re
import urllib.parse
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
import sys
import os

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from base_scraper import BaseScraper
from scraper_engine import ScraperEngine

logger = logging.getLogger(__name__)

class ApolloScraper(BaseScraper):
    """
    Apollo.io Scraper using Google X-Ray search to bypass login requirements.
    Extracts professional contact details from public Apollo.io profiles.
    """
    
    def __init__(self, scraper_engine: ScraperEngine):
        super().__init__(scraper_engine)
        self.base_url = "https://www.apollo.io"
    
    @classmethod
    def get_name(cls) -> str:
        return "Apollo.io Scraper"
    
    @classmethod
    def get_description(cls) -> str:
        return "Extract professional contact details and company info from Apollo.io (via X-Ray search)"
    
    @classmethod
    def get_category(cls) -> str:
        return "Business & Leads"
    
    @classmethod
    def get_icon(cls) -> str:
        return "🚀"
    
    @classmethod
    def get_tags(cls) -> List[str]:
        return ["apollo", "leads", "email", "business", "contacts", "b2b"]
    
    @classmethod
    def is_premium(cls) -> bool:
        return True
    
    def get_input_schema(self) -> Dict[str, Any]:
        return {
            "search_terms": {
                "type": "array",
                "description": "List of people or companies to search for (e.g. 'Elon Musk Tesla', 'Software Engineer Google')"
            },
            "max_results": {
                "type": "integer",
                "default": 10,
                "description": "Maximum number of profiles to scrape per search term"
            }
        }
    
    def get_output_schema(self) -> Dict[str, Any]:
        return {
            "name": "string",
            "title": "string",
            "company": "string",
            "location": "string",
            "linkedin_url": "string",
            "twitter_url": "string",
            "facebook_url": "string",
            "website": "string",
            "keywords": "array",
            "description": "string",
            "apollo_url": "string",
            "source": "string"
        }
    
    async def scrape(self, config: Dict[str, Any], progress_callback=None) -> List[Dict[str, Any]]:
        """
        Main scraping method.
        1. Search Google for Apollo profiles matching terms.
        2. Visit Apollo profile pages and extract data.
        """
        search_terms = config.get('search_terms', [])
        max_results = config.get('max_results', 10)
        
        all_results = []
        context = await self.engine.create_context(
            use_proxy=True,
            block_media=True,
            block_fonts=True
        )
        
        try:
            for term in search_terms:
                await self._log_progress(f"🔍 Searching for: {term}", progress_callback)
                
                # 1. X-Ray Search via Google
                apollo_urls = await self._search_google_for_apollo(context, term, max_results)
                
                await self._log_progress(f"found {len(apollo_urls)} profiles. Extracting details...", progress_callback)
                
                # 2. Extract details from each profile
                for i, url in enumerate(apollo_urls):
                    await self._log_progress(f"👤 Processing {i+1}/{len(apollo_urls)}: {url.split('/')[-1]}", progress_callback)
                    
                    profile_data = await self._extract_profile(context, url)
                    if profile_data:
                        all_results.append(profile_data)
                    
                    # Random delay to be polite
                    await asyncio.sleep(2)
                    
        finally:
            await context.close()
        
        await self._log_progress(f"✅ Completed! Extracted {len(all_results)} profiles.", progress_callback)
            
        return all_results

# Wrapper function for backward compatibility with sync calls
def scrape_apollo(input_data):
    """
    Synchronous wrapper for the async ApolloScraper.
    """
    from proxy_manager import ProxyManager
    
    # Create engine and scraper
    proxy_manager = ProxyManager()
    engine = ScraperEngine(proxy_manager)
    scraper = ApolloScraper(engine)
    
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
        logger.error(f"Error in scrape_apollo: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise e
        
    async def _search_google_for_apollo(self, context, term: str, max_results: int) -> List[str]:
        """Search Google for site:apollo.io/people matching the term."""
        page = await context.new_page()
        urls = []
        
        try:
            # Construct Google X-Ray query
            query = f"site:apollo.io/people {term}"
            encoded_query = urllib.parse.quote(query)
            google_url = f"https://www.google.com/search?q={encoded_query}&num={max_results * 2}" # Request more to filter
            
            await self.engine.navigate_with_retry(page, google_url)
            
            # Handle cookie consent
            try:
                consent_button = await page.query_selector('button[aria-label="Accept all"], button:has-text("Accept all")')
                if consent_button:
                    logger.info("Found consent button, clicking...")
                    await consent_button.click()
                    await asyncio.sleep(2)
                
                # Check for another type of consent form
                consent_form = await page.query_selector('form[action*="consent.google.com"]')
                if consent_form:
                    logger.info("Found consent form, trying to accept...")
                    accept_btn = await consent_form.query_selector('button')
                    if accept_btn:
                        await accept_btn.click()
                        await asyncio.sleep(2)
            except Exception as e:
                logger.debug(f"Consent handling error: {str(e)}")
            
            await asyncio.sleep(2)
            
            # Extract links
            links = await page.query_selector_all("a[href*='apollo.io/people/']")
            
            for link in links:
                href = await link.get_attribute("href")
                if href and "apollo.io/people/" in href and "google.com" not in href:
                    # Clean URL if needed
                    if href not in urls:
                        urls.append(href)
                        if len(urls) >= max_results:
                            break
            
            if not urls:
                logger.warning(f"No URLs found on Google. Page title: {await page.title()}")
                await page.screenshot(path="google_search_fail.png")
                
                # Fallback to DuckDuckGo
                logger.info("Falling back to DuckDuckGo...")
                ddg_url = f"https://duckduckgo.com/?q={encoded_query}"
                await self.engine.navigate_with_retry(page, ddg_url)
                await asyncio.sleep(2)
                
                links = await page.query_selector_all("a[href*='apollo.io/people/']")
                for link in links:
                    href = await link.get_attribute("href")
                    if href and "apollo.io/people/" in href and "duckduckgo.com" not in href:
                         if href not in urls:
                            urls.append(href)
                            if len(urls) >= max_results:
                                break
            
                # Fallback to generic search
                logger.info("Falling back to generic search...")
                generic_query = f"Apollo.io {term}"
                encoded_generic = urllib.parse.quote(generic_query)
                generic_url = f"https://www.google.com/search?q={encoded_generic}&num={max_results * 2}"
                
                await self.engine.navigate_with_retry(page, generic_url)
                await asyncio.sleep(2)
                
                links = await page.query_selector_all("a[href*='apollo.io/people/']")
                for link in links:
                    href = await link.get_attribute("href")
                    if href and "apollo.io/people/" in href and "google.com" not in href:
                         if href not in urls:
                            urls.append(href)
                            if len(urls) >= max_results:
                                break
            
            logger.info(f"Found {len(urls)} Apollo URLs for term '{term}'")
            
        except Exception as e:
            logger.error(f"Error searching Google: {e}")
        finally:
            await page.close()
            
        return urls

    async def _extract_profile(self, context, url: str) -> Optional[Dict[str, Any]]:
        """Visit Apollo profile page and extract details."""
        page = await context.new_page()
        data = {"apollo_url": url, "source": "apollo.io"}
        
        try:
            await self.engine.navigate_with_retry(page, url)
            
            # Wait for main content
            # Apollo public profiles often have a specific structure
            try:
                await page.wait_for_selector("h1", timeout=10000)
            except:
                logger.warning(f"Timeout waiting for profile content: {url}")
                return None

            # Extract Name
            name_elem = await page.query_selector("h1")
            if name_elem:
                data["name"] = (await name_elem.text_content()).strip()
            
            # Extract Title and Company
            # Usually in a subtitle or breadcrumbs
            # Look for the current position section
            
            # Try to find the "Current" section or similar
            # This is heuristic as Apollo changes classes often. 
            # We'll try to grab text from the header section.
            
            # Meta description often contains the summary: "First Last - Title - Company | Apollo.io"
            title = await page.title()
            if title:
                parts = title.split("-")
                if len(parts) >= 3:
                    # Format often: Name - Title - Company | Apollo.io
                    # Or: Name - Title at Company | Apollo.io
                    if "name" not in data:
                        data["name"] = parts[0].strip()
                    
                    # Try to parse title and company
                    rest = "-".join(parts[1:]).replace("| Apollo.io", "").strip()
                    if " at " in rest:
                        t, c = rest.split(" at ", 1)
                        data["title"] = t.strip()
                        data["company"] = c.strip()
                    else:
                        data["description"] = rest
            
            # Extract Social Links
            social_links = await page.query_selector_all("a[href*='linkedin.com'], a[href*='twitter.com'], a[href*='facebook.com']")
            for link in social_links:
                href = await link.get_attribute("href")
                if "linkedin.com" in href:
                    data["linkedin_url"] = href
                elif "twitter.com" in href:
                    data["twitter_url"] = href
                elif "facebook.com" in href:
                    data["facebook_url"] = href
            
            # Extract Location
            # Often near the name
            body_text = await page.inner_text("body")
            # Simple heuristic for location if structured data fails
            # (Apollo classes are obfuscated, so text analysis is sometimes safer for maintenance)
            
            # Try to find structured JSON-LD
            # Apollo often includes JSON-LD for Person
            json_ld = await page.query_selector("script[type='application/ld+json']")
            if json_ld:
                import json
                try:
                    content = await json_ld.text_content()
                    ld_data = json.loads(content)
                    if ld_data.get("@type") == "Person":
                        data["name"] = ld_data.get("name", data.get("name"))
                        data["title"] = ld_data.get("jobTitle", data.get("title"))
                        
                        if "worksFor" in ld_data:
                            wf = ld_data["worksFor"]
                            if isinstance(wf, dict):
                                data["company"] = wf.get("name")
                        
                        if "address" in ld_data:
                            addr = ld_data["address"]
                            if isinstance(addr, dict):
                                data["location"] = addr.get("addressLocality")
                            elif isinstance(addr, str):
                                data["location"] = addr
                                
                        data["description"] = ld_data.get("description", data.get("description"))
                        
                        if "sameAs" in ld_data:
                            for link in ld_data["sameAs"]:
                                if "linkedin" in link: data["linkedin_url"] = link
                                if "twitter" in link: data["twitter_url"] = link
                                if "facebook" in link: data["facebook_url"] = link
                                
                except Exception as e:
                    logger.debug(f"JSON-LD parsing failed: {e}")

            logger.info(f"Extracted profile: {data.get('name', 'Unknown')}")
            return data

        except Exception as e:
            logger.error(f"Error extracting profile {url}: {e}")
            return None
        finally:
            await page.close()
