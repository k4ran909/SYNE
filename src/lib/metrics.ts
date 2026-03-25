import { redis, redisAvailable } from './redis';

interface MetricSnapshot {
  shardId: number | null;
  timestamp: number;
  commandsExecuted: number;
  eventsProcessed: number;
  cacheHits: number;
  cacheMisses: number;
  avgEventLatencyMs: number;
  memoryUsageMB: number;
  uptime: number;
}

// ─── Counters ───────────────────────────────────────────────────
let commandsExecuted = 0;
let eventsProcessed = 0;
let cacheHits = 0;
let cacheMisses = 0;
const eventLatencies: number[] = [];

// ─── Track Methods ──────────────────────────────────────────────

export function trackCommand(): void {
  commandsExecuted++;
}

export function trackEvent(): void {
  eventsProcessed++;
}

export function trackCacheHit(): void {
  cacheHits++;
}

export function trackCacheMiss(): void {
  cacheMisses++;
}

export function trackEventLatency(startTime: number): void {
  const latency = Date.now() - startTime;
  eventLatencies.push(latency);
  // Keep only last 100 measurements
  if (eventLatencies.length > 100) eventLatencies.shift();
}

// ─── Snapshot ───────────────────────────────────────────────────

export function getMetricSnapshot(shardId: number | null): MetricSnapshot {
  const mem = process.memoryUsage();
  const avgLatency = eventLatencies.length > 0
    ? eventLatencies.reduce((a, b) => a + b, 0) / eventLatencies.length
    : 0;

  return {
    shardId,
    timestamp: Date.now(),
    commandsExecuted,
    eventsProcessed,
    cacheHits,
    cacheMisses,
    avgEventLatencyMs: Math.round(avgLatency * 100) / 100,
    memoryUsageMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
    uptime: process.uptime()
  };
}

// ─── Report to Redis (for cross-shard dashboard) ────────────────

export async function reportMetrics(shardId: number | null): Promise<void> {
  if (!redisAvailable()) return;

  const snapshot = getMetricSnapshot(shardId);
  const key = `syne:metrics:shard:${shardId ?? 'unknown'}`;

  try {
    await redis.set(key, JSON.stringify(snapshot), 'EX', 60); // Expires in 60s
  } catch {}
}

// ─── Reset counters (call after each reporting interval) ────────

export function resetCounters(): void {
  commandsExecuted = 0;
  eventsProcessed = 0;
  cacheHits = 0;
  cacheMisses = 0;
  eventLatencies.length = 0;
}
