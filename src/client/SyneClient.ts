import { SapphireClient, LogLevel } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';
// @ts-ignore - TS5.x moduleResolution node10 deprecation typing issue
import '@sapphire/plugin-logger/register';
import { redis } from '../lib/redis';
import { prisma } from '../lib/database';
import { initPubSub, subscribeAll, onEvent } from '../lib/pubsub';
import { join, dirname } from 'path';

export class SyneClient extends SapphireClient {
  public constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.GuildMember
      ],
      loadMessageCommandListeners: true,
      defaultPrefix: '!',
      baseUserDirectory: join(dirname(__dirname)),
      logger: {
        level: process.env.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Info
      }
    });
  }

  private get shardTag(): string {
    const id = this.shard?.ids[0] ?? 0;
    return `[SYNΞ:S${id}]`;
  }

  public override async login(token?: string): Promise<string> {
    // Connect Redis
    try {
      await redis.connect();
      this.logger.info(`${this.shardTag} Redis connected`);

      // Initialize Pub/Sub for cross-shard events
      await initPubSub();
      this.registerPubSubEvents();
      await subscribeAll();
      this.logger.info(`${this.shardTag} Pub/Sub initialized`);
    } catch (err) {
      this.logger.warn(`${this.shardTag} Redis connection failed — running without cache`);
    }

    // Verify Prisma connection
    try {
      await prisma.$connect();
      this.logger.info(`${this.shardTag} Database connected`);
    } catch (err) {
      this.logger.error(`${this.shardTag} Database connection failed`);
      throw err;
    }

    return super.login(token);
  }

  /**
   * Register cross-shard event handlers via Redis Pub/Sub.
   */
  private registerPubSubEvents(): void {
    // Example: Beast Mode broadcast
    onEvent('beastMode:activate', (data: { guildId: string }) => {
      this.logger.info(`${this.shardTag} Received Beast Mode activation for guild ${data.guildId}`);
      // Each shard can react to cross-shard events here
    });

    onEvent('beastMode:deactivate', (data: { guildId: string }) => {
      this.logger.info(`${this.shardTag} Received Beast Mode deactivation for guild ${data.guildId}`);
    });
  }

  public override async destroy(): Promise<void> {
    this.logger.info(`${this.shardTag} Shutting down gracefully...`);

    // Disconnect Redis
    try {
      await redis.quit();
      this.logger.info(`${this.shardTag} Redis disconnected`);
    } catch {}

    // Disconnect Prisma
    try {
      await prisma.$disconnect();
      this.logger.info(`${this.shardTag} Database disconnected`);
    } catch {}

    return super.destroy();
  }
}
