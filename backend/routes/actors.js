const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Actor = require('../models/Actor');
const logger = require('../utils/logger');

// Get actors - return array directly as frontend expects
router.get('/', auth, async (req, res) => {
    try {
        const { userActors } = req.query;

        // If userActors=true, filter for user's actors, otherwise return all
        const query = userActors === 'true' ? { userId: req.userId } : {};

        const actors = await Actor.find(query)
            .select('actorId name title description author category icon isPublic stats pricingModel isBookmarked')
            .sort({ createdAt: -1 });

        // Map to ensure all fields exist with defaults
        const mappedActors = actors.map(actor => ({
            ...actor.toObject(),
            author: actor.author || 'Scrapi',
            stats: actor.stats || { runs: 0, rating: 0, reviews: 0 },
            isBookmarked: actor.isBookmarked || false
        }));

        res.json(mappedActors);
    } catch (error) {
        logger.error('Failed to fetch actors:', error.message);
        res.status(500).json({ error: 'Failed to fetch actors' });
    }
});

// Get single actor by actorId or slug
router.get('/:idOrSlug', auth, async (req, res) => {
    try {
        const { idOrSlug } = req.params;

        // Try to find by actorId first, then by slug
        const actor = await Actor.findOne({
            $or: [
                { actorId: idOrSlug },
                { slug: idOrSlug }
            ]
        }).select('actorId name title description author slug category icon isPublic stats pricingModel isBookmarked inputFields outputFields');

        if (!actor) {
            return res.status(404).json({ error: 'Actor not found' });
        }

        // Ensure all fields exist with defaults
        const mappedActor = {
            ...actor.toObject(),
            author: actor.author || 'Scrapi',
            stats: actor.stats || { runs: 0, rating: 0, reviews: 0 },
            isBookmarked: actor.isBookmarked || false
        };

        res.json(mappedActor);
    } catch (error) {
        logger.error('Failed to fetch actor:', error.message);
        res.status(500).json({ error: 'Failed to fetch actor' });
    }
});

module.exports = router;
