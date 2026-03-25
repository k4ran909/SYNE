import { redis, redisSub, redisAvailable } from './redis';

const CHANNEL_PREFIX = 'syne:events:';

type EventHandler = (data: any) => void;
const handlers = new Map<string, EventHandler[]>();

let isSubscribed = false;

/**
 * Initialize the Pub/Sub listener.
 * Call this once per shard after Redis connects.
 */
export async function initPubSub(): Promise<void> {
  if (!redisAvailable() || isSubscribed) return;

  try {
    await redisSub.connect();
    isSubscribed = true;

    redisSub.on('message', (channel: string, message: string) => {
      const eventName = channel.replace(CHANNEL_PREFIX, '');
      const eventHandlers = handlers.get(eventName);
      if (!eventHandlers) return;

      try {
        const data = JSON.parse(message);
        for (const handler of eventHandlers) {
          handler(data);
        }
      } catch (err) {
        console.error(`[PubSub] Failed to parse message on ${channel}:`, err);
      }
    });
  } catch {
    console.warn('[PubSub] Failed to initialize — cross-shard events disabled');
  }
}

/**
 * Broadcast an event to all shards via Redis Pub/Sub.
 */
export async function broadcastEvent(event: string, data: object): Promise<void> {
  if (!redisAvailable()) return;

  try {
    await redis.publish(`${CHANNEL_PREFIX}${event}`, JSON.stringify(data));
  } catch (err) {
    console.error(`[PubSub] Failed to broadcast ${event}:`, err);
  }
}

/**
 * Register a handler for a cross-shard event.
 */
export function onEvent(event: string, handler: EventHandler): void {
  const channel = `${CHANNEL_PREFIX}${event}`;

  if (!handlers.has(event)) {
    handlers.set(event, []);
    // Subscribe to the Redis channel
    if (isSubscribed) {
      redisSub.subscribe(channel).catch(() => {});
    }
  }

  handlers.get(event)!.push(handler);
}

/**
 * Subscribe to all registered channels.
 * Call after initPubSub() and all onEvent() registrations.
 */
export async function subscribeAll(): Promise<void> {
  if (!isSubscribed) return;

  for (const event of handlers.keys()) {
    try {
      await redisSub.subscribe(`${CHANNEL_PREFIX}${event}`);
    } catch {}
  }
}
