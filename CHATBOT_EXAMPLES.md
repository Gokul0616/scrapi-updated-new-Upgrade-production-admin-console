# AI Chatbot - Example Conversations

## Basic Queries

### 1. Account Information
**User:** "What's my account status?"

**Bot:** "Let me fetch your account information...
- Username: john_doe
- Email: john@example.com
- Plan: Free
- Total Runs: 45
- Successful: 38 (84.44%)
- Failed: 7 (15.56%)
- Created: 2024-01-15"

### 2. Recent Activity
**User:** "Show me my last 5 runs"

**Bot:** "Here are your 5 most recent runs:
1. Google Maps Scraper - Succeeded - 127 results (2 mins ago)
2. LinkedIn Profile - Succeeded - 45 results (1 hour ago)
3. E-commerce Product - Failed - 0 results (3 hours ago)
4. Google Maps Scraper - Succeeded - 89 results (5 hours ago)
5. Twitter Scraper - Succeeded - 234 results (Yesterday)"

## Advanced Queries

### 3. Data Analysis
**User:** "Analyze the data from my last successful run"

**Bot:** "Analyzing your last successful run (Google Maps - 127 results):
- Total Records: 127
- Fields: name, address, rating, phone, website, category
- Average Rating: 4.3
- Rating Range: 2.5 to 5.0
- Top Categories: Restaurants (45), Cafes (32), Bars (18)
- Records with Phone: 98 (77%)
- Records with Website: 67 (53%)"

### 4. Filtering Data
**User:** "Find all entries from my last run with rating above 4.5"

**Bot:** "Found 43 entries with rating above 4.5 from your last run:
- Highest rated: 'The Perfect Brew' (5.0 stars)
- Average of filtered: 4.73 stars
- Categories: Coffee Shops (15), Restaurants (28)

Would you like me to export these filtered results?"

## Task Automation (Full Access)

### 5. Trigger Scraping
**User:** "Start a Google Maps scrape for pizza restaurants in Chicago"

**Bot:** "Starting Google Maps scraping task...
✅ Task Created Successfully!
- Actor: Google Maps Scraper
- Run ID: run_1732123456_abc123
- Query: pizza restaurants in Chicago
- Status: Queued
- Estimated Time: 3-5 minutes

I'll notify you when it's complete. You can check progress in the Runs page."

### 6. Update Run Status
**User:** "Mark run run_abc123 as failed"

**Bot:** "✅ Run status updated successfully
- Run ID: run_abc123
- Old Status: running
- New Status: failed
- Updated: Just now"

## Insights & Trends

### 7. Weekly Insights
**User:** "Give me insights from the last week"

**Bot:** "📊 Your Scraping Insights (Last 7 Days):
- Total Runs: 23
- Successful: 20 (87%)
- Failed: 3 (13%)
- Total Records Scraped: 2,847
- Average per Run: 124 records
- Most Used Actors:
  1. Google Maps Scraper (12 runs)
  2. LinkedIn Profile (6 runs)
  3. E-commerce Product (5 runs)

💡 Tip: Your success rate improved 5% compared to previous week!"

### 8. Performance Analysis
**User:** "Which actor gives me the best results?"

**Bot:** "Based on your usage history:

🥇 **Top Performer:** Google Maps Scraper
- Runs: 45
- Success Rate: 95%
- Avg Records: 156 per run
- Avg Duration: 3.2 minutes

🥈 **Runner Up:** E-commerce Product
- Runs: 28
- Success Rate: 89%
- Avg Records: 89 per run
- Avg Duration: 2.1 minutes

Recommendation: Google Maps Scraper is most reliable for your needs."

## Data Export

### 9. Export Request
**User:** "Export my latest run data in CSV format"

**Bot:** "✅ Data export prepared!
- Run: Google Maps - Chicago Pizza
- Records: 127
- Format: CSV
- Size: ~45 KB

Download link: [Download CSV]
The export includes all fields and will be available for 24 hours."

## Multi-Turn Conversations

### 10. Context-Aware Dialogue
**User:** "Show me my most recent run"

**Bot:** "Your most recent run:
- Actor: Google Maps Scraper
- Query: coffee shops in Seattle
- Status: Succeeded
- Results: 89 records
- Duration: 2m 34s"

**User:** "Analyze that data"

**Bot:** "Analyzing the coffee shops data from Seattle run:
- Total Places: 89
- Average Rating: 4.4 stars
- Price Range: $ to $$$
- Most Common: $$ (56%)
- Top Neighborhoods: Capitol Hill (18), Downtown (15), Fremont (12)
- Open Now: 67 (75%)"

**User:** "Export the top-rated ones"

**Bot:** "Filtering and exporting top-rated coffee shops (4.5+ stars)...
✅ Export ready! 34 premium coffee shops
[Download CSV]"

## Error Handling

### 11. Permission Required
**User:** "Delete all my old runs"

**Bot:** "⚠️ I don't have permission to delete runs. I can only:
- View and query your data
- Generate reports and insights
- Help you find information

To modify or delete runs, please:
1. Go to Settings
2. Update chatbot permissions to 'Full Access'
3. Or manually manage runs in the Runs page"

### 12. Invalid Request
**User:** "Show me run xyz789"

**Bot:** "❌ I couldn't find run 'xyz789' in your account.
- The run ID might be incorrect
- The run might belong to another user
- It may have been deleted

Your most recent runs:
1. run_abc123 (5 mins ago)
2. run_def456 (1 hour ago)
3. run_ghi789 (3 hours ago)

Would you like details on any of these?"

## Complex Workflows

### 13. Multi-Step Task
**User:** "I need to scrape Italian restaurants in Boston, analyze the ratings, and export the top 20"

**Bot:** "I'll help you with that! Let me break this down:

Step 1: Starting Google Maps scrape for Italian restaurants in Boston...
✅ Scraping started (Run ID: run_boston_italian_123)

⏳ Waiting for results... (This usually takes 3-5 minutes)

[After completion]
✅ Scraping complete! Found 156 Italian restaurants

Step 2: Analyzing ratings...
- Average Rating: 4.2 stars
- Top-rated: 23 with 4.5+ stars
- Rating distribution: Excellent analysis complete

Step 3: Preparing export of top 20 rated restaurants...
✅ Export ready!
- Top 20 Italian restaurants in Boston
- Sorted by rating (highest first)
- Includes: name, address, rating, reviews, phone, website

[Download Top 20 CSV]

Is there anything else you'd like me to do with this data?"

## Tips & Tricks

### 14. Quick Stats
**User:** "Quick stats"

**Bot:** "⚡ Quick Stats:
- Runs Today: 5
- Success Rate: 100%
- Records Today: 456
- Active Actors: 3
- Storage Used: 45%
- Credits Used: $2.30 / $5.00"

### 15. Help Request
**User:** "What can you help me with?"

**Bot:** "I can help you with many tasks! Here are some examples:

📊 **Data & Analytics:**
- 'Show my recent runs'
- 'Analyze data from run xyz'
- 'Give me weekly insights'

🚀 **Task Management:**
- 'Start a scraping task for...'
- 'What actors are available?'
- 'Update run status'

🔍 **Search & Filter:**
- 'Find entries with rating > 4'
- 'Search for keywords in my data'
- 'Show failed runs this week'

📤 **Export:**
- 'Export run data'
- 'Prepare CSV for latest run'

💬 **General:**
- 'Account statistics'
- 'Usage summary'
- 'Best performing actors'

Just ask in natural language - I'll understand!"

## Pro Tips

1. **Be Specific with IDs:** When referencing runs, use complete run IDs
2. **Use Filters:** "Show successful runs from last week" is better than "show runs"
3. **Chain Commands:** "Show my last run, then analyze it, then export top results"
4. **Ask for Clarification:** If unsure, just ask "What do you mean?"
5. **Context Matters:** Reference previous messages - I remember our conversation!
6. **Natural Language:** No need for commands - just talk normally
7. **Request Examples:** "Show me an example of..." works great
8. **Get Creative:** Try complex queries - I can handle them!
