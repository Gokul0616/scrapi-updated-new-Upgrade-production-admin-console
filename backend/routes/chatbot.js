const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');
const User = require('../models/User');
const Run = require('../models/Run');
const Actor = require('../models/Actor');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');

// OpenRouter API configuration (Primary)
const OPENROUTER_API_KEY = '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';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-3-pro-preview';

// Fallback LLM configuration
const EMERGENT_LLM_KEY = process.env.EMERGENT_LLM_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FALLBACK_MODEL = 'gpt-4o-mini'; // Use mini for cost effectiveness

// Initialize OpenAI client for fallback (try Emergent first, then OpenAI)
let fallbackClient = null;
if (EMERGENT_LLM_KEY) {
  // Try Kindo endpoint with Emergent key
  fallbackClient = {
    type: 'emergent',
    apiKey: EMERGENT_LLM_KEY
  };
} else if (OPENAI_API_KEY) {
  // Use OpenAI as fallback
  fallbackClient = {
    type: 'openai',
    client: new OpenAI({ apiKey: OPENAI_API_KEY })
  };
}

// System prompt for the agentic chatbot
const SYSTEM_PROMPT = `You are an intelligent AI assistant integrated into Scrapi, a web scraping platform. You have access to the user's database and can perform various operations to help them.

## Your Capabilities:
1. **Database Queries**: Query user data, scraping runs, actors, and statistics
2. **Scraping Tasks**: Trigger new scraping tasks with specific actors
3. **Data Analysis**: Analyze scraped data and provide insights
4. **Data Export**: Help users export data in various formats
5. **Advanced Analytics**: Generate reports, trends, and visualizations
6. **Task Management**: View, update, and manage scraping runs

## Available Tools:
- get_user_stats: Get user account statistics and usage
- get_recent_runs: Retrieve recent scraping runs with filters
- get_run_details: Get detailed information about a specific run
- query_scraped_data: Search and filter scraped data
- trigger_scraping_task: Start a new scraping task
- get_actors: List available scraping actors
- analyze_data: Perform analysis on scraped data
- export_data: Export data in CSV/JSON format
- update_run_status: Update run status or metadata
- get_insights: Generate insights and trends from data

## Instructions:
- Always be helpful, accurate, and proactive
- When asked to perform actions, use the appropriate tools
- Provide clear explanations of what you're doing
- Ask for clarification when needed
- Respect user permissions (read-only vs full access)
- Format responses clearly with proper structure
- For data queries, always show relevant metrics and summaries

Respond naturally and help users accomplish their goals efficiently.`;

/**
 * Execute tool/function calls based on chatbot requests
 */
async function executeTool(toolName, args, userId, hasFullAccess) {
  try {
    logger.info(`Executing tool: ${toolName} for user ${userId}`);

    switch (toolName) {
      case 'get_user_stats': {
        const user = await User.findById(userId);
        if (!user) return { error: 'User not found' };

        const totalRuns = await Run.countDocuments({ userId });
        const successfulRuns = await Run.countDocuments({ userId, status: 'succeeded' });
        const failedRuns = await Run.countDocuments({ userId, status: 'failed' });

        return {
          username: user.username,
          email: user.email,
          plan: user.plan,
          usage: user.usage,
          stats: {
            totalRuns,
            successfulRuns,
            failedRuns,
            successRate: totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(2) + '%' : '0%'
          },
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        };
      }

      case 'get_recent_runs': {
        const limit = args.limit || 10;
        const status = args.status;
        const actorId = args.actorId;

        const query = { userId };
        if (status) query.status = status;
        if (actorId) query.actorId = actorId;

        const runs = await Run.find(query)
          .sort({ startedAt: -1 })
          .limit(limit)
          .select('-output'); // Don't return full output data

        return {
          total: runs.length,
          runs: runs.map(run => ({
            runId: run.runId,
            actorName: run.actorName,
            status: run.status,
            resultCount: run.resultCount,
            duration: run.duration,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt
          }))
        };
      }

      case 'get_run_details': {
        const { runId } = args;
        if (!runId) return { error: 'runId is required' };

        const run = await Run.findOne({ runId, userId });
        if (!run) return { error: 'Run not found' };

        return {
          runId: run.runId,
          actorName: run.actorName,
          status: run.status,
          input: run.input,
          resultCount: run.resultCount,
          duration: run.duration,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          error: run.error,
          outputSample: run.output.slice(0, 5) // First 5 results as sample
        };
      }

      case 'query_scraped_data': {
        const { runId, searchTerm, limit = 20 } = args;
        if (!runId) return { error: 'runId is required' };

        const run = await Run.findOne({ runId, userId });
        if (!run) return { error: 'Run not found' };

        let results = run.output;

        // Apply search filter if provided
        if (searchTerm) {
          results = results.filter(item => 
            JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        return {
          total: results.length,
          data: results.slice(0, limit)
        };
      }

      case 'trigger_scraping_task': {
        if (!hasFullAccess) {
          return { error: 'Full database access required to trigger scraping tasks' };
        }

        const { actorId, input } = args;
        if (!actorId || !input) {
          return { error: 'actorId and input are required' };
        }

        const actor = await Actor.findOne({ actorId });
        if (!actor) return { error: 'Actor not found' };

        // Create new run
        const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newRun = new Run({
          runId,
          actorId,
          actorName: actor.name,
          userId,
          status: 'queued',
          input,
          startedAt: new Date()
        });

        await newRun.save();

        // Trigger scraping via scraper service
        try {
          await axios.post('http://localhost:8002/scrape', {
            runId,
            actorId,
            input,
            userId: userId.toString()
          });
        } catch (error) {
          logger.error('Failed to trigger scraping:', error.message);
        }

        return {
          success: true,
          runId,
          actorName: actor.name,
          status: 'queued',
          message: 'Scraping task started successfully'
        };
      }

      case 'get_actors': {
        const actors = await Actor.find({})
          .select('actorId name description category featured')
          .sort({ featured: -1, name: 1 });

        return {
          total: actors.length,
          actors: actors.map(a => ({
            actorId: a.actorId,
            name: a.name,
            description: a.description,
            category: a.category
          }))
        };
      }

      case 'analyze_data': {
        const { runId } = args;
        if (!runId) return { error: 'runId is required' };

        const run = await Run.findOne({ runId, userId });
        if (!run) return { error: 'Run not found' };

        const data = run.output;
        if (!data || data.length === 0) {
          return { message: 'No data available for analysis' };
        }

        // Perform basic analysis
        const totalRecords = data.length;
        const fields = Object.keys(data[0] || {});
        const analysis = {
          totalRecords,
          fields,
          fieldCount: fields.length,
          sampleData: data.slice(0, 3)
        };

        // Analyze specific fields if available
        if (data[0]?.rating) {
          const ratings = data.map(d => parseFloat(d.rating)).filter(r => !isNaN(r));
          if (ratings.length > 0) {
            analysis.ratings = {
              average: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2),
              min: Math.min(...ratings),
              max: Math.max(...ratings)
            };
          }
        }

        return analysis;
      }

      case 'export_data': {
        const { runId, format = 'json' } = args;
        if (!runId) return { error: 'runId is required' };

        const run = await Run.findOne({ runId, userId });
        if (!run) return { error: 'Run not found' };

        return {
          success: true,
          message: `Data export prepared. ${run.resultCount} records available in ${format.toUpperCase()} format.`,
          downloadUrl: `/api/runs/${runId}/export?format=${format}`,
          recordCount: run.resultCount
        };
      }

      case 'update_run_status': {
        if (!hasFullAccess) {
          return { error: 'Full database access required to update runs' };
        }

        const { runId, status } = args;
        if (!runId || !status) {
          return { error: 'runId and status are required' };
        }

        const run = await Run.findOneAndUpdate(
          { runId, userId },
          { status },
          { new: true }
        );

        if (!run) return { error: 'Run not found' };

        return {
          success: true,
          runId: run.runId,
          newStatus: run.status,
          message: 'Run status updated successfully'
        };
      }

      case 'get_insights': {
        const { period = 'week' } = args;
        
        // Calculate date range
        const now = new Date();
        const startDate = new Date();
        if (period === 'week') startDate.setDate(now.getDate() - 7);
        else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
        else if (period === 'year') startDate.setFullYear(now.getFullYear() - 1);

        const runs = await Run.find({
          userId,
          startedAt: { $gte: startDate }
        });

        const insights = {
          period,
          totalRuns: runs.length,
          successfulRuns: runs.filter(r => r.status === 'succeeded').length,
          failedRuns: runs.filter(r => r.status === 'failed').length,
          totalRecordsScraped: runs.reduce((sum, r) => sum + (r.resultCount || 0), 0),
          averageRecordsPerRun: runs.length > 0 
            ? Math.round(runs.reduce((sum, r) => sum + (r.resultCount || 0), 0) / runs.length)
            : 0,
          mostUsedActors: []
        };

        // Find most used actors
        const actorCounts = {};
        runs.forEach(r => {
          actorCounts[r.actorName] = (actorCounts[r.actorName] || 0) + 1;
        });

        insights.mostUsedActors = Object.entries(actorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

        return insights;
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    logger.error(`Tool execution error (${toolName}):`, error.message);
    return { error: error.message };
  }
}

/**
 * Parse tool calls from assistant message
 */
function parseToolCalls(content) {
  const tools = [];
  
  // Look for tool call patterns like: TOOL[tool_name]{"arg": "value"}
  const toolPattern = /TOOL\[(\w+)\]\s*(\{[^}]+\})?/g;
  let match;
  
  while ((match = toolPattern.exec(content)) !== null) {
    const toolName = match[1];
    const argsStr = match[2] || '{}';
    
    try {
      const args = JSON.parse(argsStr);
      tools.push({ toolName, args });
    } catch (error) {
      logger.warn(`Failed to parse tool args: ${argsStr}`);
    }
  }
  
  return tools;
}

/**
 * Helper function to call fallback LLM (Emergent or OpenAI)
 */
async function callFallbackLLM(messages) {
  if (!fallbackClient) {
    throw new Error('No fallback LLM configured');
  }

  logger.info('Using fallback LLM with model:', FALLBACK_MODEL);
  logger.info('Fallback type:', fallbackClient.type);

  try {
    if (fallbackClient.type === 'emergent') {
      // Try Kindo API with Emergent key
      logger.info('Attempting Kindo API with Emergent key');
      
      const response = await axios.post(
        'https://llm.kindo.ai/v1/chat/completions',
        {
          model: FALLBACK_MODEL,
          messages: messages
        },
        {
          headers: {
            'content-type': 'application/json',
            'api-key': fallbackClient.apiKey
          },
          timeout: 30000
        }
      );

      return {
        content: response.data.choices[0].message.content || '',
        usedFallback: true,
        fallbackType: 'emergent'
      };
    } else if (fallbackClient.type === 'openai') {
      // Use OpenAI client
      logger.info('Using OpenAI as fallback');
      
      const response = await fallbackClient.client.chat.completions.create({
        model: FALLBACK_MODEL,
        messages: messages,
      });

      return {
        content: response.choices[0].message.content || '',
        usedFallback: true,
        fallbackType: 'openai'
      };
    }
  } catch (emergen error) {
    logger.error('Emergent/Kindo fallback failed:', error.message);
    
    // If Emergent fails and we have OpenAI key, try OpenAI as final fallback
    if (fallbackClient.type === 'emergent' && OPENAI_API_KEY) {
      logger.info('Emergent failed, trying OpenAI as final fallback');
      try {
        const openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
        const response = await openaiClient.chat.completions.create({
          model: FALLBACK_MODEL,
          messages: messages,
        });

        return {
          content: response.choices[0].message.content || '',
          usedFallback: true,
          fallbackType: 'openai'
        };
      } catch (openaiError) {
        logger.error('OpenAI final fallback also failed:', openaiError.message);
        throw openaiError;
      }
    }
    
    throw error;
  }
}

/**
 * Helper function to call OpenRouter API (primary)
 */
async function callOpenRouter(messages) {
  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: MODEL,
        messages,
        extra_body: { reasoning: { enabled: true } }
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 second timeout
      }
    );

    const assistantMessage = response.data.choices[0].message;
    return {
      content: assistantMessage.content || '',
      reasoning: assistantMessage.reasoning_details,
      usedFallback: false
    };
  } catch (error) {
    logger.warn('OpenRouter API failed:', error.message);
    logger.warn('OpenRouter error details:', error.response?.data || error.code);
    throw error;
  }
}

/**
 * POST /api/chatbot/chat
 * Send message to chatbot and get response
 */
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userId = req.userId;  // Fixed: use req.userId instead of req.user.userId

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get user and check permissions
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hasFullAccess = user.chatbotPermissions?.fullAccess || false;

    // Build messages array for API call
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Try OpenRouter first, fallback to Emergent LLM on failure
    let assistantResponse;
    let usedFallback = false;
    let reasoningDetails = null;

    try {
      // Primary: Try OpenRouter API
      assistantResponse = await callOpenRouter(messages);
      usedFallback = assistantResponse.usedFallback;
      reasoningDetails = assistantResponse.reasoning;
    } catch (openRouterError) {
      // Fallback: Use Emergent LLM key
      logger.info('Falling back to Emergent LLM due to OpenRouter failure');
      try {
        assistantResponse = await callEmergentLLM(messages);
        usedFallback = assistantResponse.usedFallback;
      } catch (fallbackError) {
        logger.error('Both OpenRouter and Emergent LLM failed:', fallbackError.message);
        return res.status(500).json({ 
          error: 'All AI services are currently unavailable. Please try again later.',
          details: 'Both primary and fallback services failed'
        });
      }
    }

    let content = assistantResponse.content;

    // Check if assistant wants to use tools
    const toolCalls = parseToolCalls(content);
    const toolResults = [];

    if (toolCalls.length > 0) {
      // Execute each tool
      for (const { toolName, args } of toolCalls) {
        const result = await executeTool(toolName, args, userId, hasFullAccess);
        toolResults.push({ tool: toolName, result });
      }

      // Make a follow-up call with tool results
      const followUpMessages = [
        ...messages,
        {
          role: 'assistant',
          content: content
        },
        {
          role: 'user',
          content: `Tool results: ${JSON.stringify(toolResults, null, 2)}. Please provide a natural response based on these results.`
        }
      ];

      // Try follow-up with same fallback logic
      try {
        assistantResponse = await callOpenRouter(followUpMessages);
        content = assistantResponse.content;
      } catch (openRouterError) {
        logger.info('Using fallback for follow-up call');
        try {
          assistantResponse = await callEmergentLLM(followUpMessages);
          content = assistantResponse.content;
          usedFallback = true;
        } catch (fallbackError) {
          logger.error('Follow-up call failed on both services');
          // Use the original content with tool results
        }
      }
    }

    res.json({
      response: content,
      reasoning: reasoningDetails,
      toolsUsed: toolCalls.length > 0,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
      usedFallback: usedFallback // Indicate if fallback was used
    });

  } catch (error) {
    logger.error('Chatbot error:', error.message);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * POST /api/chatbot/permissions
 * Update chatbot permissions
 */
router.post('/permissions', auth, async (req, res) => {
  try {
    const { fullAccess } = req.body;
    const userId = req.userId;  // Fixed: use req.userId instead of req.user.userId

    const user = await User.findByIdAndUpdate(
      userId,
      {
        'chatbotPermissions.enabled': true,
        'chatbotPermissions.fullAccess': fullAccess === true,
        'chatbotPermissions.lastUpdated': new Date()
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      permissions: user.chatbotPermissions
    });

  } catch (error) {
    logger.error('Update permissions error:', error.message);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

/**
 * GET /api/chatbot/permissions
 * Get current chatbot permissions
 */
router.get('/permissions', auth, async (req, res) => {
  try {
    const userId = req.userId;  // Fixed: use req.userId instead of req.user.userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      permissions: user.chatbotPermissions || {
        enabled: false,
        fullAccess: false
      }
    });

  } catch (error) {
    logger.error('Get permissions error:', error.message);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

module.exports = router;
