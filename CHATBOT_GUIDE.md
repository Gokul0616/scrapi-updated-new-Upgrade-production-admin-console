# AI Chatbot Assistant - User Guide

## Overview
The AI Chatbot Assistant is an intelligent agent powered by Google's Gemini 3 Pro Preview model via OpenRouter. It provides natural language interaction with your Scrapi platform data and operations.

## Features

### 🔍 Data Queries
- Get user statistics and account information
- Query recent scraping runs with filters
- Search through scraped data
- View detailed run information

### 🚀 Task Automation
- Trigger new scraping tasks
- Update run statuses
- Manage scraping operations

### 📊 Analytics & Insights
- Analyze scraped data
- Generate insights and trends
- View statistics and metrics
- Get data summaries

### 📤 Data Export
- Export data in CSV/JSON formats
- Download specific run results
- Prepare data for external use

## How to Use

### 1. Opening the Chatbot
- Click the floating chat button in the bottom-right corner
- The button shows a green indicator when the assistant is ready

### 2. Setting Permissions (First Time)
When you first open the chatbot, you'll be asked to choose permission level:

**Read-Only Access:**
- View data and query information
- Get insights and analytics
- No modifications to your data

**Full Access:**
- All read-only features
- Trigger scraping tasks
- Update run statuses
- Modify data

You can change permissions later in Settings.

### 3. Chatting with the Assistant

#### Example Queries:

**Get Your Stats:**
```
"Show me my account statistics"
"How many scraping runs have I done?"
"What's my success rate?"
```

**Query Recent Runs:**
```
"Show me my last 10 runs"
"Get all failed runs"
"Show me runs for Google Maps actor"
```

**Search Data:**
```
"Search for restaurants in my last run"
"Find all entries with rating above 4.5"
"Show me data from run ID: run_abc123"
```

**Trigger Scraping (Full Access Required):**
```
"Start a Google Maps scrape for restaurants in New York"
"Scrape business listings for 'coffee shops in Seattle'"
```

**Analytics:**
```
"Analyze my data trends this month"
"What are my most used actors?"
"Give me insights from the last week"
```

**Export Data:**
```
"Export data from run ID: run_abc123"
"Prepare my latest run for CSV download"
```

## Advanced Capabilities

### Multi-Turn Conversations
The chatbot maintains context across messages:
```
You: "Show me my last run"
Bot: [Shows last run details]
You: "Now analyze that data"
Bot: [Analyzes the run from previous message]
```

### Reasoning System
Gemini 3 Pro uses advanced reasoning to:
- Understand complex queries
- Break down multi-step tasks
- Provide accurate responses
- Handle ambiguous requests

### Tool Integration
Behind the scenes, the chatbot can:
- Query MongoDB database
- Trigger scraping services
- Perform calculations
- Format responses

## Tips for Best Results

1. **Be Specific:** Instead of "show data", say "show my last 5 successful runs"
2. **Use Context:** Reference previous messages or specific run IDs
3. **Ask Follow-ups:** The bot remembers conversation history
4. **Request Clarification:** The bot will ask if it needs more information
5. **Use Natural Language:** No need for special commands or syntax

## Keyboard Shortcuts
- **Enter:** Send message
- **Shift + Enter:** New line in message
- **ESC:** Close chatbot (when input is not focused)

## Privacy & Security
- All conversations are processed securely
- Only you can access your data
- Permissions control what the bot can modify
- No data is shared with third parties
- OpenRouter API key is securely stored server-side

## Troubleshooting

**Bot not responding:**
- Check your internet connection
- Refresh the page
- Check backend logs for errors

**Permission issues:**
- Go to Settings to update permissions
- Re-grant access if needed

**Tool execution fails:**
- Ensure you have proper permissions
- Check if the requested resource exists
- Verify your account has necessary access

## Technical Details

### API Integration
- Model: Google Gemini 3 Pro Preview
- Provider: OpenRouter
- Features: Multi-turn reasoning, function calling
- Response time: 2-5 seconds average

### Available Tools
The chatbot can execute these functions:
- `get_user_stats` - Account statistics
- `get_recent_runs` - Query runs
- `get_run_details` - Detailed run info
- `query_scraped_data` - Search data
- `trigger_scraping_task` - Start scraping
- `get_actors` - List actors
- `analyze_data` - Data analysis
- `export_data` - Prepare exports
- `update_run_status` - Modify runs
- `get_insights` - Generate insights

## Future Enhancements
- Voice input support
- Advanced data visualizations
- Custom automation scripts
- Integration with external tools
- Scheduled task recommendations
- Predictive analytics

## Feedback
Having issues or suggestions? Contact support or create an issue in the Issues page.
