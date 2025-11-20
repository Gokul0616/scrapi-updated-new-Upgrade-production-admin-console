const express = require('express');
const router = express.Router();
const Run = require('../models/Run');
const Actor = require('../models/Actor');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const axios = require('axios');
const { emitRunCreated, emitRunStatusChange, emitRunCompleted, emitRunFailed, emitRunUpdate } = require('../utils/websocket');
const { notifyRunStarted, notifyRunCompleted, notifyRunFailed } = require('../utils/notificationService');

// Python Scraper Service configuration
const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:8002';

// Get all runs (protected - user-specific)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, actorId, limit = 20, page = 1, scheduled } = req.query;
    let query = { userId: req.userId }; // Only user's runs
    
    if (status) query.status = status;
    if (actorId) query.actorId = actorId;
    if (scheduled !== undefined) {
      query.scheduled = scheduled === 'true';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const runs = await Run.find(query)
      .sort({ startedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean(); // Use lean() for better performance
      
    // Populate pricing model from actors
    const actorIds = [...new Set(runs.map(run => run.actorId))];
    const actors = await Actor.find({ actorId: { $in: actorIds } }).select('actorId pricingModel');
    const actorPricingMap = {};
    actors.forEach(actor => {
      actorPricingMap[actor.actorId] = actor.pricingModel;
    });
    
    // Add pricing model to each run
    const runsWithPricing = runs.map(run => ({
      ...run,
      pricingModel: actorPricingMap[run.actorId] || 'Pay per event'
    }));
      
    const total = await Run.countDocuments(query);
    
    res.json({
      runs: runsWithPricing,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get run by ID (protected - user-specific)
router.get('/:runId', authMiddleware, async (req, res) => {
  try {
    const run = await Run.findOne({ 
      runId: req.params.runId,
      userId: req.userId // Only user's runs
    }).lean();
    
    if (!run) return res.status(404).json({ error: 'Run not found' });
    
    // Populate pricing model from actor
    const actor = await Actor.findOne({ actorId: run.actorId }).select('pricingModel');
    const runWithPricing = {
      ...run,
      pricingModel: actor?.pricingModel || 'Pay per event'
    };
    
    res.json(runWithPricing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate result count from output data
function calculateResultCount(output) {
  if (!output) return 0;
  
  // Handle different output structures
  // Case 1: Direct array
  if (Array.isArray(output)) {
    return output.length;
  }
  
  // Case 2: Object with results array
  if (output.results && Array.isArray(output.results)) {
    return output.results.length;
  }
  
  // Case 3: Object with data.results array
  if (output.data && output.data.results && Array.isArray(output.data.results)) {
    return output.data.results.length;
  }
  
  // Case 4: Object with items array
  if (output.items && Array.isArray(output.items)) {
    return output.items.length;
  }
  
  // Case 5: Object with data array
  if (output.data && Array.isArray(output.data)) {
    return output.data.length;
  }
  
  // Case 6: Explicit resultCount or resultsCount field
  if (typeof output.resultCount === 'number') {
    return output.resultCount;
  }
  if (typeof output.resultsCount === 'number') {
    return output.resultsCount;
  }
  
  return 0;
}

// Create and execute a run (protected)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { actorId, input } = req.body;
    
    // Validate input
    if (!actorId) {
      return res.status(400).json({ error: 'actorId is required' });
    }
    if (!input || typeof input !== 'object') {
      return res.status(400).json({ error: 'input must be an object' });
    }
    
    // Find actor
    const actor = await Actor.findOne({ actorId });
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    
    // Check if user has access to this actor
    if (!actor.isPublic && actor.userId && actor.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Access denied to this actor' });
    }
    
    // Sanitize and convert input types (convert string numbers to integers)
    const sanitizedInput = { ...input };
    if (sanitizedInput.maxResults && typeof sanitizedInput.maxResults === 'string') {
      sanitizedInput.maxResults = parseInt(sanitizedInput.maxResults, 10);
    }
    if (sanitizedInput.max_results && typeof sanitizedInput.max_results === 'string') {
      sanitizedInput.max_results = parseInt(sanitizedInput.max_results, 10);
    }
    
    // Create run with userId
    const runId = uuidv4();
    const run = new Run({
      runId,
      actorId,
      actorName: actor.name,
      userId: req.userId, // Set user ownership
      input: sanitizedInput,
      status: 'queued'  // Changed to queued (will be processed by Python service)
    });
    
    await run.save();
    
    // Emit WebSocket event for run creation
    try {
      emitRunCreated(req.userId, run.toObject());
    } catch (wsError) {
      console.error('WebSocket emission error:', wsError);
    }
    
    // Create notification for run started
    try {
      await notifyRunStarted(req.userId, {
        runId: run.runId,
        actorName: actor.name,
        actorId: actor.actorId
      });
    } catch (notifError) {
      console.error('Notification creation error:', notifError);
    }
    
    // Transform input data for Python scraper compatibility
    let transformedInput = { ...sanitizedInput };
    
    // Google Maps specific transformations
    if (actorId === 'google-maps') {
      // Transform query (string) to search_terms (array)
      if (transformedInput.query) {
        transformedInput.search_terms = [transformedInput.query];
        delete transformedInput.query;
      }
      
      // Transform camelCase to snake_case for Python
      if (transformedInput.maxResults !== undefined) {
        transformedInput.max_results = transformedInput.maxResults;
        delete transformedInput.maxResults;
      }
      
      if (transformedInput.extractReviews !== undefined) {
        transformedInput.extract_reviews = transformedInput.extractReviews;
        delete transformedInput.extractReviews;
      }
      
      if (transformedInput.extractImages !== undefined) {
        transformedInput.extract_images = transformedInput.extractImages;
        delete transformedInput.extractImages;
      }
      
      if (transformedInput.ultraFast !== undefined) {
        transformedInput.ultra_fast = transformedInput.ultraFast;
        delete transformedInput.ultraFast;
      }
    }
    
    // Amazon specific transformations
    if (actorId === 'amazon') {
      // FIX: Ensure search_keywords is always an array (not a string)
      // If user sends "laptop" instead of ["laptop"], convert it
      if (transformedInput.search_keywords) {
        if (typeof transformedInput.search_keywords === 'string') {
          transformedInput.search_keywords = [transformedInput.search_keywords];
        } else if (!Array.isArray(transformedInput.search_keywords)) {
          transformedInput.search_keywords = [];
        }
      }
      
      // Transform camelCase to snake_case for Python
      if (transformedInput.maxResults !== undefined) {
        transformedInput.max_results = transformedInput.maxResults;
        delete transformedInput.maxResults;
      }
      
      if (transformedInput.extractReviews !== undefined) {
        transformedInput.extract_reviews = transformedInput.extractReviews;
        delete transformedInput.extractReviews;
      }
      
      if (transformedInput.minRating !== undefined) {
        transformedInput.min_rating = transformedInput.minRating;
        delete transformedInput.minRating;
      }
      
      if (transformedInput.maxPrice !== undefined) {
        transformedInput.max_price = transformedInput.maxPrice;
        delete transformedInput.maxPrice;
      }
    }
    
    // Send scraping job to Python service via Celery queue
    try {
      await axios.post(`${SCRAPER_SERVICE_URL}/scrape`, {
        actor_id: actorId,
        input_data: transformedInput,
        run_id: runId
      });
      
      // Monitor task status asynchronously
      monitorScraperTask(runId, actorId, req.userId).catch(err => {
        console.error('Task monitoring error:', err);
      });
      
    } catch (error) {
      console.error('Failed to queue scraping task:', error);
      run.status = 'failed';
      run.error = 'Failed to queue scraping task';
      await run.save();
      
      // Emit failed status via WebSocket
      try {
        emitRunFailed(req.userId, runId, run.error);
      } catch (wsError) {
        console.error('WebSocket emission error:', wsError);
      }
    }
    
    res.status(201).json(run);
  } catch (error) {
    console.error('Error creating run:', error);
    res.status(400).json({ error: error.message });
  }
});

// Monitor scraper task status from Python service
async function monitorScraperTask(runId, actorId, userId) {
  const startTime = Date.now();
  const maxAttempts = 240; // 20 minutes max (240 * 5 seconds = 1200 seconds)
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    try {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      
      // Get task status from Python service
      const response = await axios.get(`${SCRAPER_SERVICE_URL}/task/${runId}`);
      const taskStatus = response.data;
      
      const run = await Run.findOne({ runId });
      if (!run) return;
      
      if (taskStatus.status === 'SUCCESS') {
        // Task completed successfully
        const result = taskStatus.result;
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        if (result.status === 'success') {
          run.status = 'succeeded';
          run.output = result.data;
          
          // Calculate result count using helper function
          const resultCount = calculateResultCount(result.data);
          run.resultCount = resultCount;
          
          console.log(`✅ Run ${runId} succeeded with ${resultCount} results`);
        } else {
          run.status = 'failed';
          run.error = result.error || 'Scraping failed';
        }
        
        run.duration = `${duration}s`;
        run.finishedAt = new Date();
        run.usage = parseFloat((Math.random() * 0.5).toFixed(2));
        
        await run.save();
        
        // Emit WebSocket event for completion
        try {
          if (run.status === 'succeeded') {
            emitRunCompleted(userId, runId, run.toObject());
          } else {
            emitRunFailed(userId, runId, run.error);
          }
        } catch (wsError) {
          console.error('WebSocket emission error:', wsError);
        }
        
        // Create notification for run completion/failure
        try {
          if (run.status === 'succeeded') {
            await notifyRunCompleted(userId, {
              runId: run.runId,
              actorName: run.actorName,
              actorId: run.actorId,
              resultCount: run.resultCount
            });
          } else {
            await notifyRunFailed(userId, {
              runId: run.runId,
              actorName: run.actorName,
              actorId: run.actorId,
              error: run.error
            });
          }
        } catch (notifError) {
          console.error('Notification creation error:', notifError);
        }
        
        // Update actor stats
        await Actor.updateOne(
          { actorId },
          { $inc: { 'stats.runs': 1 } }
        );
        
        // Trigger background enrichment for Google Maps (if successful)
        if (run.status === 'succeeded' && actorId === 'google-maps' && Array.isArray(result.data) && result.data.length > 0) {
          try {
            console.log(`🔍 Triggering background enrichment for ${result.data.length} places in run ${runId}`);
            
            await axios.post(`${SCRAPER_SERVICE_URL}/enrich`, {
              run_id: runId,
              places_data: result.data
            });
            
            console.log(`✅ Enrichment task queued for run ${runId}`);
          } catch (enrichError) {
            console.error('Failed to queue enrichment task:', enrichError);
            // Don't fail the run if enrichment fails to queue
          }
        }
        
        return;
        
      } else if (taskStatus.status === 'FAILURE') {
        // Task failed
        const duration = Math.round((Date.now() - startTime) / 1000);
        run.status = 'failed';
        run.error = taskStatus.error || 'Task execution failed';
        run.finishedAt = new Date();
        run.duration = `${duration}s`;
        await run.save();
        
        console.error(`❌ Run ${runId} failed: ${run.error}`);
        
        // Emit WebSocket event for failure
        try {
          emitRunFailed(userId, runId, run.error);
        } catch (wsError) {
          console.error('WebSocket emission error:', wsError);
        }
        
        // Create notification for failure
        try {
          await notifyRunFailed(userId, {
            runId: run.runId,
            actorName: run.actorName,
            actorId: run.actorId,
            error: run.error
          });
        } catch (notifError) {
          console.error('Notification creation error:', notifError);
        }
        
        return;
        
      } else if (taskStatus.status === 'STARTED') {
        // Task is running, update status
        if (run.status !== 'running') {
          run.status = 'running';
          await run.save();
          
          console.log(`⟳ Run ${runId} is now running...`);
          
          // Emit WebSocket event for status change
          try {
            emitRunStatusChange(runId, 'running', { userId });
            emitRunUpdate(userId, run.toObject());
          } catch (wsError) {
            console.error('WebSocket emission error:', wsError);
          }
        }
      }
      
      attempt++;
      
    } catch (error) {
      console.error('Error monitoring task:', error);
      attempt++;
      
      // If too many failures, mark run as failed
      if (attempt >= maxAttempts) {
        const run = await Run.findOne({ runId });
        if (run && run.status !== 'succeeded' && run.status !== 'failed') {
          run.status = 'failed';
          run.error = 'Task monitoring timeout - exceeded 20 minutes';
          run.finishedAt = new Date();
          const duration = Math.round((Date.now() - startTime) / 1000);
          run.duration = `${duration}s`;
          await run.save();
          
          console.error(`⏱️ Run ${runId} timed out after ${duration}s`);
          
          // Emit WebSocket event for failure
          try {
            emitRunFailed(userId, runId, run.error);
          } catch (wsError) {
            console.error('WebSocket emission error:', wsError);
          }
        }
      }
    }
  }
}

// Abort a single run
router.post('/:runId/abort', authMiddleware, async (req, res) => {
  try {
    const run = await Run.findOne({ 
      runId: req.params.runId,
      userId: req.userId 
    });
    
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Only allow aborting runs that are queued or running
    if (run.status !== 'queued' && run.status !== 'running') {
      return res.status(400).json({ error: 'Can only abort queued or running tasks' });
    }
    
    // Call Python service to terminate the Celery task
    try {
      await axios.delete(`${SCRAPER_SERVICE_URL}/task/${run.runId}`);
    } catch (error) {
      console.error('Error terminating Celery task:', error);
      // Continue even if termination fails - we still mark it as aborted
    }
    
    // Update run status to aborted
    const startTime = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    run.status = 'aborted';
    run.finishedAt = new Date();
    run.duration = `${duration}s`;
    run.error = 'Task aborted by user';
    
    await run.save();
    
    // Emit WebSocket event
    try {
      emitRunStatusChange(run.runId, 'aborted', { userId: req.userId });
      emitRunUpdate(req.userId, run.toObject());
    } catch (wsError) {
      console.error('WebSocket emission error:', wsError);
    }
    
    res.json({ message: 'Run aborted successfully', run: run.toObject() });
  } catch (error) {
    console.error('Error aborting run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Abort multiple runs (bulk abort)
router.post('/abort-bulk', authMiddleware, async (req, res) => {
  try {
    const { runIds } = req.body;
    
    if (!Array.isArray(runIds) || runIds.length === 0) {
      return res.status(400).json({ error: 'runIds must be a non-empty array' });
    }
    
    const results = {
      aborted: [],
      failed: [],
      skipped: []
    };
    
    for (const runId of runIds) {
      try {
        const run = await Run.findOne({ 
          runId,
          userId: req.userId 
        });
        
        if (!run) {
          results.failed.push({ runId, reason: 'Run not found' });
          continue;
        }
        
        // Only allow aborting runs that are queued or running
        if (run.status !== 'queued' && run.status !== 'running') {
          results.skipped.push({ runId, reason: 'Not queued or running' });
          continue;
        }
        
        // Call Python service to terminate the Celery task
        try {
          await axios.delete(`${SCRAPER_SERVICE_URL}/task/${run.runId}`);
        } catch (error) {
          console.error(`Error terminating Celery task ${runId}:`, error);
        }
        
        // Update run status to aborted
        const startTime = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        run.status = 'aborted';
        run.finishedAt = new Date();
        run.duration = `${duration}s`;
        run.error = 'Task aborted by user';
        
        await run.save();
        
        // Emit WebSocket event
        try {
          emitRunStatusChange(run.runId, 'aborted', { userId: req.userId });
          emitRunUpdate(req.userId, run.toObject());
        } catch (wsError) {
          console.error('WebSocket emission error:', wsError);
        }
        
        results.aborted.push({ runId, status: 'aborted' });
      } catch (error) {
        results.failed.push({ runId, reason: error.message });
      }
    }
    
    res.json({
      message: `Aborted ${results.aborted.length} run(s)`,
      results
    });
  } catch (error) {
    console.error('Error aborting runs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enrichment update endpoint - receives enriched data from Python service
router.post('/:runId/enrich-update', async (req, res) => {
  try {
    const { runId } = req.params;
    const { enrichedPlace } = req.body;
    
    if (!enrichedPlace) {
      return res.status(400).json({ error: 'enrichedPlace is required' });
    }
    
    // Find the run
    const run = await Run.findOne({ runId });
    
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    // Find and update the specific place in the output array
    const placeIdentifier = enrichedPlace.placeId || enrichedPlace.url;
    
    if (Array.isArray(run.output)) {
      const placeIndex = run.output.findIndex(
        place => place.placeId === placeIdentifier || place.url === placeIdentifier
      );
      
      if (placeIndex !== -1) {
        // Update the place with enriched data
        run.output[placeIndex] = {
          ...run.output[placeIndex],
          ...enrichedPlace
        };
        
        // Mark the field as modified for Mongoose to save it
        run.markModified('output');
        await run.save();
        
        console.log(`✅ Updated enrichment for ${enrichedPlace.title || 'Unknown'} in run ${runId}`);
        
        // Emit WebSocket event for enrichment update
        try {
          emitRunUpdate(run.userId, run.toObject());
        } catch (wsError) {
          console.error('WebSocket emission error:', wsError);
        }
        
        return res.json({ success: true, message: 'Enrichment updated' });
      }
    }
    
    res.status(404).json({ error: 'Place not found in run output' });
    
  } catch (error) {
    console.error('Error updating enrichment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
