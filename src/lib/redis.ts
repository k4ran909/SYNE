import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let isConnected = false;

// ─── Primary Redis Client (commands) ────────────────────────────
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 5) return null;
    return Math.min(times * 500, 5000);
  },
  lazyConnect: true,
  enableReadyCheck: true,
  keepAlive: 30000
});

redis.on('connect', () => {
  isConnected = true;
  console.log('[Redis] Primary client connected');
});

redis.on('error', (err) => {
  isConnected = false;
  if (process.env.NODE_ENV !== 'production') {
    // Silently fail in dev — use memory fallback
  } else {
    console.error('[Redis] Connection error:', err.message);
  }
});

redis.on('close', () => {
  isConnected = false;
});

// ─── Subscriber Redis Client (Pub/Sub) ──────────────────────────
const redisSub = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 5) return null;
    return Math.min(times * 500, 5000);
  },
  lazyConnect: true,
  enableReadyCheck: true,
  keepAlive: 30000
});

redisSub.on('connect', () => {
  console.log('[Redis] Subscriber client connected');
});

redisSub.on('error', () => {
  // Subscriber errors handled silently
});

/**
 * Check if Redis is currently connected and available.
 */
function redisAvailable(): boolean {
  return isConnected;
}

export { redis, redisSub, redisAvailable };
