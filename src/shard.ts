import 'dotenv/config';
import { ShardingManager } from 'discord.js';
import { join } from 'path';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('[SYNΞ] DISCORD_TOKEN is not set in .env file');
  process.exit(1);
}

const extension = __filename.endsWith('.ts') ? 'ts' : 'js';
const manager = new ShardingManager(join(__dirname, `index.${extension}`), {
  token,
  totalShards: 'auto',   // Discord determines optimal shard count
  respawn: true,           // Auto-restart crashed shards
  execArgv: extension === 'ts' ? ['--import', 'tsx'] : [],  // Only use tsx in dev
});

// ─── Shard Lifecycle Events ─────────────────────────────────────

manager.on('shardCreate', (shard) => {
  console.log(`[SYNΞ] Shard ${shard.id} launched`);

  shard.on('ready', () => {
    console.log(`[SYNΞ] Shard ${shard.id} ready`);
  });

  shard.on('disconnect', () => {
    console.warn(`[SYNΞ] Shard ${shard.id} disconnected`);
  });

  shard.on('reconnecting', () => {
    console.log(`[SYNΞ] Shard ${shard.id} reconnecting...`);
  });

  shard.on('death', (process) => {
    console.error(`[SYNΞ] Shard ${shard.id} died (PID: ${'pid' in process ? process.pid : 'unknown'})`);
  });

  shard.on('error', (error) => {
    console.error(`[SYNΞ] Shard ${shard.id} error:`, error);
  });
});

// ─── Start All Shards ───────────────────────────────────────────
console.log('[SYNΞ] Starting Shard Manager...');
manager.spawn({ timeout: 60_000 }).then((shards) => {
  console.log(`[SYNΞ] All ${shards.size} shard(s) spawned successfully`);
}).catch((error) => {
  console.error('[SYNΞ] Failed to spawn shards:', error);
  process.exit(1);
});

// ─── Graceful Shutdown ──────────────────────────────────────────
const shutdown = () => {
  console.log('[SYNΞ] Shutting down all shards...');
  manager.shards.forEach((shard) => shard.kill());
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
