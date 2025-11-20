"""
Amazon Product Scraper - Extract product data from Amazon.
Supports: products, prices, reviews, ratings, sellers, shipping info.
"""
import asyncio
import re
import logging
from typing import List, Dict, Any, Optional, Callable
from base_scraper import BaseScraper
from scraper_engine import ScraperEngine
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup
import json

logger = logging.getLogger(__name__)

class AmazonProductScraper(BaseScraper):
    """
    Comprehensive Amazon product scraper.
    
    Features:
    - Product search with multiple keywords
    - Price tracking (current, original, discount)
    - Reviews and ratings
    - Product specifications
    - Multiple images
    - Seller information
    - Availability and shipping
    - BSR (Best Sellers Rank)
    """
    
    def __init__(self, scraper_engine: ScraperEngine):
        super().__init__(scraper_engine)
        self.base_url = "https://www.amazon.com"
    
    @classmethod
    def get_name(cls) -> str:
        return "Amazon Product Scraper"
    
    @classmethod
    def get_description(cls) -> str:
        return "Extract products, prices, reviews, ratings, and seller info from Amazon search results and product pages"
    
    @classmethod
    def get_category(cls) -> str:
        return "E-commerce"
    
    @classmethod
    def get_icon(cls) -> str:
        return "📦"
    
    @classmethod
    def get_tags(cls) -> List[str]:
        return ["amazon", "ecommerce", "products", "prices", "reviews", "shopping"]
    
    def get_input_schema(self) -> Dict[str, Any]:
        return {
            "search_keywords": {
                "type": "array",
                "description": "List of product keywords to search (e.g., ['wireless headphones', 'laptop stand'])",
                "required": True
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of products to scrape per keyword",
                "default": 50,
                "min": 1,
                "max": 200
            },
            "extract_reviews": {
                "type": "boolean",
                "description": "Extract review text from product pages",
                "default": False
            },
            "min_rating": {
                "type": "number",
                "description": "Minimum product rating (0-5)",
                "default": 0,
                "min": 0,
                "max": 5
            },
            "max_price": {
                "type": "number",
                "description": "Maximum price filter in USD (optional)",
                "default": None
            }
        }
    
    def get_output_schema(self) -> Dict[str, Any]:
        return {
            "asin": "string - Amazon Standard Identification Number",
            "title": "string - Product title",
            "url": "string - Product URL",
            "price": "number - Current price in USD",
            "originalPrice": "number - Original price before discount",
            "discount": "number - Discount percentage",
            "currency": "string - Currency code",
            "rating": "number - Average rating (0-5)",
            "reviewCount": "number - Total number of reviews",
            "availability": "string - Stock availability status",
            "prime": "boolean - Amazon Prime eligible",
            "images": "array - List of product image URLs (high resolution)",
            "videos": "array - List of product video URLs",
            "description": "string - Product description",
            "features": "array - Key product features",
            "brand": "string - Product brand name",
            "dimensions": "object - Product dimensions and weight {size, weight}",
            "color": "string - Selected color variant",
            "size": "string - Selected size variant",
            "stock": "number - Available stock quantity",
            "shipping": "string - Shipping information",
            "specifications": "object - Technical specifications",
            "seller": "string - Seller name",
            "shipsFrom": "string - Ships from location",
            "soldBy": "string - Sold by (Amazon or 3rd party)",
            "category": "string - Product category",
            "bestSellerRank": "string - Best Sellers Rank",
            "reviews": "array - Review texts (if extract_reviews=true)"
        }
    
    async def scrape(
        self,
        config: Dict[str, Any],
        progress_callback: Optional[Callable] = None
    ) -> List[Dict[str, Any]]:
        """Main scraping method for Amazon products."""
        search_keywords = config.get('search_keywords', [])
        max_results = int(config.get('max_results', 50))
        extract_reviews = config.get('extract_reviews', False)
        min_rating = float(config.get('min_rating', 0))
        max_price = config.get('max_price', None)
        if max_price is not None and max_price != 0:
            max_price = float(max_price)
        else:
            max_price = None
        
        if not search_keywords:
            raise ValueError("search_keywords is required")
        
        all_products = []
        
        # Create browser context with anti-detection
        context = await self.engine.create_context(use_proxy=False)
        
        try:
            for keyword in search_keywords:
                await self._log_progress(
                    f"🔍 Searching Amazon for: {keyword}",
                    progress_callback
                )
                
                # Search and get product links
                product_asins = await self._search_products(
                    context,
                    keyword,
                    max_results,
                    progress_callback
                )
                
                await self._log_progress(
                    f"✅ Found {len(product_asins)} products for '{keyword}'",
                    progress_callback
                )
                
                # Extract details in batches
                batch_size = 3
                for i in range(0, len(product_asins), batch_size):
                    batch = product_asins[i:i+batch_size]
                    progress = min(i + batch_size, len(product_asins))
                    await self._log_progress(
                        f"📊 Extracting details: {progress}/{len(product_asins)}",
                        progress_callback
                    )
                    
                    # Parallel extraction within batch
                    tasks = [
                        self._extract_product_details(
                            context,
                            asin,
                            extract_reviews
                        )
                        for asin in batch
                    ]
                    batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                    
                    for result in batch_results:
                        if isinstance(result, dict):
                            # Apply filters
                            if min_rating > 0 and result.get('rating', 0) < min_rating:
                                continue
                            if max_price and result.get('price', float('inf')) > max_price:
                                continue
                            result['searchKeyword'] = keyword
                            all_products.append(result)
                
                await self._log_progress(
                    f"✅ Completed scraping for '{keyword}': {len([p for p in all_products if p.get('searchKeyword') == keyword])} products",
                    progress_callback
                )
            
            await self._log_progress(
                f"🎉 Scraping complete! Total products: {len(all_products)}",
                progress_callback
            )
        
        finally:
            await context.close()
        
        return all_products
    
    async def _search_products(
        self,
        context,
        keyword: str,
        max_results: int,
        progress_callback: Optional[Callable] = None
    ) -> List[str]:
        """Search Amazon and extract product ASINs with pagination support."""
        page = await context.new_page()
        asins = []
        current_page = 1
        max_pages = 20
        
        try:
            while len(asins) < max_results and current_page <= max_pages:
                search_url = f"{self.base_url}/s?k={keyword.replace(' ', '+')}&page={current_page}"
                
                await self._log_progress(
                    f"🔍 Searching page {current_page} for '{keyword}' (found {len(asins)}/{max_results})",
                    progress_callback
                )
                
                await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(2)
                
                # Scroll to load products
                for _ in range(3):
                    await page.evaluate("window.scrollBy(0, window.innerHeight)")
                    await asyncio.sleep(0.5)
                
                # Extract product ASINs from search results
                content = await page.content()
                soup = BeautifulSoup(content, 'html.parser')
                
                # Find product containers
                product_divs = soup.find_all('div', {'data-asin': True})
                page_asins_found = 0
                
                for div in product_divs:
                    asin = div.get('data-asin')
                    if asin and asin.strip() and len(asin) == 10:
                        if asin not in asins:
                            asins.append(asin)
                            page_asins_found += 1
                        if len(asins) >= max_results:
                            break
                
                # Try alternate selector if few products found on first page
                if current_page == 1 and page_asins_found < 5:
                    links = soup.find_all('a', href=re.compile(r'/dp/[A-Z0-9]{10}'))
                    for link in links:
                        match = re.search(r'/dp/([A-Z0-9]{10})', link['href'])
                        if match:
                            asin = match.group(1)
                            if asin not in asins:
                                asins.append(asin)
                                page_asins_found += 1
                            if len(asins) >= max_results:
                                break
                
                # If no products found on this page, break
                if page_asins_found == 0:
                    await self._log_progress(
                        f"⚠️ No more products found at page {current_page}. Total found: {len(asins)}",
                        progress_callback
                    )
                    break
                
                # Move to next page if we haven't reached max_results yet
                if len(asins) < max_results:
                    current_page += 1
                    await asyncio.sleep(1)
            
            await self._log_progress(
                f"✅ Completed search for '{keyword}': {len(asins)} products found",
                progress_callback
            )
        
        except Exception as e:
            logger.error(f"Search error for '{keyword}': {e}")
        
        finally:
            await page.close()
        
        return asins[:max_results]
    
    async def _extract_product_details(
        self,
        context,
        asin: str,
        extract_reviews: bool = False
    ) -> Dict[str, Any]:
        """Extract detailed information from a product page."""
        page = await context.new_page()
        product_data = {
            'asin': asin,
            'url': f"{self.base_url}/dp/{asin}"
        }
        
        try:
            await page.goto(product_data['url'], wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)
            
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            # Title
            title_elem = soup.find('span', {'id': 'productTitle'})
            if title_elem:
                product_data['title'] = title_elem.text.strip()
            
            # Price
            price_whole = soup.find('span', {'class': 'a-price-whole'})
            price_fraction = soup.find('span', {'class': 'a-price-fraction'})
            if price_whole:
                try:
                    price_str = price_whole.text.replace(',', '').strip('.')
                    if price_fraction:
                        price_str += '.' + price_fraction.text.strip()
                    product_data['price'] = float(price_str)
                    product_data['currency'] = 'USD'
                except:
                    pass
            
            # Original price / discount
            original_price = soup.find('span', {'class': 'a-price a-text-price'})
            if original_price:
                try:
                    orig_text = original_price.find('span', {'class': 'a-offscreen'})
                    if orig_text:
                        orig_price = float(orig_text.text.replace('$', '').replace(',', '').strip())
                        product_data['originalPrice'] = orig_price
                        if 'price' in product_data:
                            discount = ((orig_price - product_data['price']) / orig_price) * 100
                            product_data['discount'] = round(discount, 2)
                except:
                    pass
            
            # Rating
            rating_elem = soup.find('span', {'class': 'a-icon-alt'})
            if rating_elem:
                rating_text = rating_elem.text
                match = re.search(r'(\d+\.?\d*)\s*out of', rating_text)
                if match:
                    product_data['rating'] = float(match.group(1))
            
            # Review count
            review_elem = soup.find('span', {'id': 'acrCustomerReviewText'})
            if review_elem:
                review_text = review_elem.text
                match = re.search(r'([\d,]+)', review_text)
                if match:
                    product_data['reviewCount'] = int(match.group(1).replace(',', ''))
            
            # Availability
            avail_elem = soup.find('div', {'id': 'availability'})
            if avail_elem:
                product_data['availability'] = avail_elem.text.strip()
            
            # Prime eligible
            prime_elem = soup.find('i', {'class': 'a-icon-prime'})
            product_data['prime'] = prime_elem is not None
            
            # Images and Videos
            images = []
            videos = []
            
            # Main product image
            main_image = soup.find('img', {'id': 'landingImage'})
            if main_image and main_image.get('src'):
                main_src = main_image.get('src', '')
                if 'amazon.com' in main_src:
                    high_res = main_src.replace('._AC_SX355_', '._AC_SL1500_').replace('._AC_SY355_', '._AC_SL1500_')
                    images.append(high_res)
            
            # Additional images
            image_block = soup.find('div', {'id': 'altImages'})
            if image_block:
                img_tags = image_block.find_all('img')
                for img in img_tags:
                    src = img.get('src', '')
                    if src and 'amazon.com' in src and src not in images:
                        high_res = src.replace('_SS40_', '_SL1500_').replace('_US40_', '_SL1500_')
                        if high_res not in images:
                            images.append(high_res)
            
            # Extract videos
            video_scripts = soup.find_all('script', {'type': 'text/javascript'})
            for script in video_scripts:
                if script.string and '"videos"' in script.string:
                    try:
                        match = re.search(r'"videos"\s*:\s*(\[.*?\])', script.string)
                        if match:
                            video_data = json.loads(match.group(1))
                            for vid in video_data:
                                if isinstance(vid, dict) and 'url' in vid:
                                    video_url = vid['url']
                                    if video_url and video_url not in videos:
                                        if not video_url.startswith('http'):
                                            video_url = 'https:' + video_url if video_url.startswith('//') else video_url
                                        if video_url.startswith('http'):
                                            videos.append(video_url)
                    except:
                        pass
            
            product_data['images'] = images[:10]
            product_data['videos'] = videos[:3]
            
            # Features
            features = []
            feature_div = soup.find('div', {'id': 'feature-bullets'})
            if feature_div:
                feature_items = feature_div.find_all('span', {'class': 'a-list-item'})
                for item in feature_items:
                    text = item.text.strip()
                    if text and len(text) > 10:
                        features.append(text)
            product_data['features'] = features
            
            # Description
            desc_elem = soup.find('div', {'id': 'productDescription'})
            if desc_elem:
                product_data['description'] = desc_elem.text.strip()[:500]
            
            # Brand
            brand = None
            brand_elem = soup.find('a', {'id': 'bylineInfo'})
            if brand_elem:
                brand_text = brand_elem.text.strip()
                if 'Visit the' in brand_text:
                    brand = brand_text.replace('Visit the', '').replace('Store', '').strip()
                elif 'Brand:' in brand_text:
                    brand = brand_text.replace('Brand:', '').strip()
                else:
                    brand = brand_text
            product_data['brand'] = brand
            
            # Dimensions and weight
            dimensions = {}
            detail_bullets = soup.find('div', {'id': 'detailBullets_feature_div'})
            if detail_bullets:
                items = detail_bullets.find_all('li')
                for item in items:
                    text = item.text.strip()
                    if 'Product Dimensions' in text or 'Package Dimensions' in text:
                        dim_match = re.search(r':\s*(.+)', text)
                        if dim_match:
                            dimensions['size'] = dim_match.group(1).strip()
                    elif 'Item Weight' in text:
                        weight_match = re.search(r':\s*(.+)', text)
                        if weight_match:
                            dimensions['weight'] = weight_match.group(1).strip()
            product_data['dimensions'] = dimensions
            
            # Color and size variants
            color = None
            size = None
            variation_elem = soup.find('div', {'id': 'variation_color_name'})
            if variation_elem:
                selected_color = variation_elem.find('span', {'class': 'selection'})
                if selected_color:
                    color = selected_color.text.strip()
            
            variation_size = soup.find('div', {'id': 'variation_size_name'})
            if variation_size:
                selected_size = variation_size.find('span', {'class': 'selection'})
                if selected_size:
                    size = selected_size.text.strip()
            
            product_data['color'] = color
            product_data['size'] = size
            
            # Stock quantity
            stock_elem = soup.find('span', {'class': 'a-size-medium a-color-success'})
            if stock_elem:
                stock_text = stock_elem.text.strip()
                stock_match = re.search(r'(\d+)\s*in stock', stock_text, re.IGNORECASE)
                if stock_match:
                    product_data['stock'] = int(stock_match.group(1))
            
            # Shipping info
            shipping_elem = soup.find('div', {'id': 'deliveryBlockMessage'})
            if not shipping_elem:
                shipping_elem = soup.find('div', {'id': 'mir-layout-DELIVERY_BLOCK'})
            if shipping_elem:
                product_data['shipping'] = shipping_elem.text.strip()[:200]
            
            # Seller info
            seller_elem = soup.find('a', {'id': 'sellerProfileTriggerId'})
            if seller_elem:
                product_data['seller'] = seller_elem.text.strip()
            
            # Sold by
            soldby_elem = soup.find('div', {'id': 'merchant-info'})
            if soldby_elem:
                product_data['soldBy'] = soldby_elem.text.strip()
            
            # Category
            breadcrumb = soup.find('div', {'id': 'wayfinding-breadcrumbs_feature_div'})
            if breadcrumb:
                categories = breadcrumb.find_all('a')
                if categories:
                    product_data['category'] = categories[-1].text.strip()
            
            # Best Sellers Rank
            rank_table = soup.find('table', {'id': 'productDetails_detailBullets_sections1'})
            if rank_table:
                rows = rank_table.find_all('tr')
                for row in rows:
                    th = row.find('th')
                    if th and 'Best Sellers Rank' in th.text:
                        td = row.find('td')
                        if td:
                            product_data['bestSellerRank'] = td.text.strip()[:200]
            
            # Extract reviews if requested
            if extract_reviews:
                reviews = await self._extract_reviews(page, asin)
                product_data['reviews'] = reviews
        
        except Exception as e:
            logger.error(f"Error extracting product {asin}: {e}")
            product_data['error'] = str(e)
        
        finally:
            await page.close()
        
        return product_data
    
    async def _extract_reviews(self, page: Page, asin: str) -> List[str]:
        """Extract review texts from product reviews page."""
        reviews = []
        try:
            reviews_url = f"{self.base_url}/product-reviews/{asin}"
            await page.goto(reviews_url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(2)
            
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            review_divs = soup.find_all('div', {'data-hook': 'review'})
            for div in review_divs[:10]:
                review_text = div.find('span', {'data-hook': 'review-body'})
                if review_text:
                    reviews.append(review_text.text.strip())
        
        except Exception as e:
            logger.error(f"Error extracting reviews for {asin}: {e}")
        
        return reviews


# Wrapper function for backward compatibility with sync calls
def scrape_amazon(input_data):
    """
    Synchronous wrapper for the async AmazonProductScraper.
    """
    from proxy_manager import ProxyManager
    from scraper_engine import ScraperEngine
    import asyncio
    
    # Create engine and scraper
    proxy_manager = ProxyManager()
    engine = ScraperEngine(proxy_manager)
    scraper = AmazonProductScraper(engine)
    
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
        logger.error(f"Error in scrape_amazon: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {'error': str(e)}