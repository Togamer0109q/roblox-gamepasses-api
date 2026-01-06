const express = require('express');
const axios = require('axios');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Default route for health check or info
app.get('/', (req, res) => {
  res.json({
    name: 'Roblox Gamepasses API',
    status: 'Running',
    endpoints: {
      gamepasses: '/gamepasses/:userId'
    }
  });
});

// Trust proxy for rate limiting (needed on Replit/behind proxies)
app.set('trust proxy', 1);

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// In-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Roblox Gamepasses API
 * GET /gamepasses/:userId
 */
app.get('/gamepasses/:userId', async (req, res) => {
  const { userId } = req.params;

  // Validate userId
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid userId provided.' });
  }

  // Check cache
  const cachedData = cache.get(userId);
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TTL)) {
    console.log(`[Cache Hit] Returning cached data for userId: ${userId}`);
    return res.json(cachedData.data);
  }

  try {
    console.log(`[Roblox API] Fetching gamepasses for userId: ${userId}`);
    
    let allGamePasses = [];
    let cursor = '';
    let hasNextPage = true;

    // Fetch gamepasses from inventory API
    // https://inventory.roblox.com/v1/users/{userId}/assets/collectibles?assetType=GamePass&limit=100
    // Actually, inventory API for gamepasses is often:
    // https://games.roblox.com/v2/users/{userId}/games?accessFilter=Public&limit=50
    // Then for each game, fetch gamepasses.
    // However, the requirement says "all public gamepasses created by a specific Roblox user".
    // A better way is using the catalog search or the user's inventory if public.
    // Most reliable for "created by user" is fetching user's universes then their gamepasses.
    
    // Step 1: Get all universes (games) owned by the user
    // https://games.roblox.com/v2/users/{userId}/games?accessFilter=Public&limit=50
    const gamesResponse = await axios.get(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&limit=50`);
    const universes = gamesResponse.data.data || [];

    for (const universe of universes) {
      const universeId = universe.id;
      let gamePassCursor = '';
      
      do {
        console.log(`[Roblox API] Fetching gamepasses for universe: ${universeId} (Cursor: ${gamePassCursor})`);
        // https://games.roblox.com/v1/games/{universeId}/game-passes?limit=100&cursor={cursor}
        const gpResponse = await axios.get(`https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100&cursor=${gamePassCursor}`);
        
        const passes = gpResponse.data.data || [];
        allGamePasses.push(...passes.map(gp => ({
          id: gp.id,
          name: gp.name,
          price: gp.price || 0,
          iconImageUrl: '' // Will fetch in next step or use placeholder if not available directly
        })));

        gamePassCursor = gpResponse.data.nextPageCursor;
      } while (gamePassCursor);
    }

    // Step 2: Fetch icons for the gamepasses (Batch if possible)
    // https://thumbnails.roblox.com/v1/game-passes?gamePassIds=1,2,3&size=150x150&format=Png&isCircular=false
    if (allGamePasses.length > 0) {
      const passIds = allGamePasses.map(p => p.id);
      // Roblox thumbnail API allows up to 100 IDs at once
      const chunks = [];
      for (let i = 0; i < passIds.length; i += 100) {
        chunks.push(passIds.slice(i, i + 100));
      }

      for (const chunk of chunks) {
        console.log(`[Roblox API] Fetching thumbnails for ${chunk.length} gamepasses`);
        const thumbResponse = await axios.get(`https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${chunk.join(',')}&size=150x150&format=Png&isCircular=false`);
        const thumbs = thumbResponse.data.data || [];
        
        thumbs.forEach(thumb => {
          const pass = allGamePasses.find(p => p.id === thumb.targetId);
          if (pass) pass.iconImageUrl = thumb.imageUrl;
        });
      }
    }

    // Update cache
    cache.set(userId, {
      timestamp: Date.now(),
      data: allGamePasses
    });

    res.json(allGamePasses);
  } catch (error) {
    console.error(`[Error] Roblox API request failed for userId ${userId}:`, error.message);
    if (error.response && error.response.status === 403) {
      return res.status(502).json({ error: 'Access to Roblox API forbidden.' });
    }
    res.status(502).json({ error: 'Failed to fetch data from Roblox.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
