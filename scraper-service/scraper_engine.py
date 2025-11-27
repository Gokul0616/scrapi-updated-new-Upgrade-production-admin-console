import asyncio
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from typing import Optional, Dict, Any, List
import logging
import random

logger = logging.getLogger(__name__)

class ScraperEngine:
    """Core scraping engine using Playwright with anti-detection."""
    
    def __init__(self, proxy_manager=None):
        self.proxy_manager = proxy_manager
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.contexts: List[BrowserContext] = []
    
    async def initialize(self):
        """Initialize Playwright browser."""
        self.playwright = await async_playwright().start()
        
        # Launch browser with anti-detection settings
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        )
        logger.info("Scraper engine initialized")
    
    async def create_context(self, use_proxy: bool = False, ultra_fast: bool = False, block_media: bool = False, block_fonts: bool = False) -> BrowserContext:
        """Create a new browser context with optional proxy and resource blocking."""
        if not self.browser:
            await self.initialize()
        
        context_options = {
            "viewport": {"width": 1920, "height": 1080},
            "user_agent": self._get_random_user_agent(),
            "locale": "en-US",
            "timezone_id": "America/New_York",
        }
        
        # Add proxy if available and requested
        if use_proxy and self.proxy_manager:
            proxy_dict = await self.proxy_manager.get_rotating_proxy("best")
            if proxy_dict:
                proxy_url = self.proxy_manager.format_proxy_url(proxy_dict)
                
                # Parse proxy URL for Playwright format
                from urllib.parse import urlparse
                parsed = urlparse(proxy_url)
                
                context_options["proxy"] = {
                    "server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"
                }
                
                if parsed.username and parsed.password:
                    context_options["proxy"]["username"] = parsed.username
                    context_options["proxy"]["password"] = parsed.password
                
                logger.info(f"Using proxy: {parsed.hostname}:{parsed.port}")
        
        context = await self.browser.new_context(**context_options)
        
        # Configure resource blocking
        if ultra_fast or block_media or block_fonts:
            logger.info(f"Resource blocking enabled: ultra_fast={ultra_fast}, media={block_media}, fonts={block_fonts}")
            await context.route("**/*", lambda route: self._handle_route(route, ultra_fast, block_media, block_fonts))
        
        # Add anti-detection scripts
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            window.chrome = {
                runtime: {}
            };
            
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
        """)
        
        self.contexts.append(context)
        return context
    
    async def _handle_route(self, route, ultra_fast: bool, block_media: bool, block_fonts: bool):
        """Handle route blocking based on configuration."""
        request = route.request
        resource_type = request.resource_type
        url = request.url.lower()
        
        # Block images
        if (ultra_fast or block_media) and resource_type == "image":
            await route.abort()
            return
        
        # Block fonts
        if (ultra_fast or block_fonts) and (resource_type == "font" or any(ext in url for ext in ['.woff', '.woff2', '.ttf', '.otf'])):
            await route.abort()
            return
        
        # Block stylesheets (only in ultra_fast mode as it might break layout dependent scraping)
        if ultra_fast and resource_type == "stylesheet":
            await route.abort()
            return
        
        # Block analytics and tracking (always good to block if blocking is enabled)
        if any(domain in url for domain in [
            'google-analytics.com',
            'googletagmanager.com',
            'facebook.com/tr',
            'doubleclick.net',
            'analytics.google.com',
            'stats.g.doubleclick.net'
        ]):
            await route.abort()
            return
        
        # Allow everything else
        await route.continue_()
    
    async def new_page(self, context: Optional[BrowserContext] = None) -> Page:
        """Create a new page in a context."""
        if context is None:
            context = await self.create_context()
        
        page = await context.new_page()
        
        # Set extra headers to avoid detection
        await page.set_extra_http_headers({
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        })
        
        return page
    
    async def navigate_with_retry(self, page: Page, url: str, max_retries: int = 3) -> bool:
        """Navigate to URL with retry logic."""
        for attempt in range(max_retries):
            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                if response and response.status < 400:
                    # Random delay to appear human-like
                    await asyncio.sleep(random.uniform(1, 3))
                    return True
                logger.warning(f"Navigation returned status {response.status if response else 'None'}")
            except Exception as e:
                logger.warning(f"Navigation attempt {attempt + 1} failed: {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        return False
    
    async def wait_for_selector_safe(self, page: Page, selector: str, timeout: int = 10000) -> bool:
        """Wait for selector with error handling."""
        try:
            await page.wait_for_selector(selector, timeout=timeout)
            return True
        except Exception as e:
            logger.debug(f"Selector '{selector}' not found: {str(e)}")
            return False
    
    async def scroll_page(self, page: Page, max_scrolls: int = 10):
        """Scroll page to load dynamic content."""
        for i in range(max_scrolls):
            await page.evaluate("window.scrollBy(0, window.innerHeight)")
            await asyncio.sleep(random.uniform(0.5, 1.5))
    
    async def extract_text_safe(self, page: Page, selector: str) -> Optional[str]:
        """Safely extract text from a selector."""
        try:
            element = await page.query_selector(selector)
            if element:
                return await element.text_content()
        except Exception as e:
            logger.debug(f"Failed to extract text from '{selector}': {str(e)}")
        return None
    
    async def extract_attribute_safe(self, page: Page, selector: str, attribute: str) -> Optional[str]:
        """Safely extract attribute from a selector."""
        try:
            element = await page.query_selector(selector)
            if element:
                return await element.get_attribute(attribute)
        except Exception as e:
            logger.debug(f"Failed to extract attribute '{attribute}' from '{selector}': {str(e)}")
        return None
    
    def _get_random_user_agent(self) -> str:
        """Get a random user agent string."""
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15"
        ]
        return random.choice(user_agents)
    
    async def cleanup(self):
        """Clean up browser resources."""
        for context in self.contexts:
            await context.close()
        
        if self.browser:
            await self.browser.close()
        
        if self.playwright:
            await self.playwright.stop()
        
        logger.info("Scraper engine cleaned up")
