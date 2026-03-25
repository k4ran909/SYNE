import 'dotenv/config';
import { SyneClient } from './client/SyneClient';

const client = new SyneClient();

const main = async () => {
  try {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      throw new Error('DISCORD_TOKEN is not set in .env file');
    }

    client.logger.info('[SYNΞ] Starting SYNΞ Management Bot...');
    await client.login(token);
    client.logger.info(`[SYNΞ] Logged in as ${client.user?.tag} — Ready!`);
  } catch (error) {
    client.logger.fatal('[SYNΞ] Failed to start:', error);
    await client.destroy();
    process.exit(1);
  }
};

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  client.logger.info('[SYNΞ] Received SIGINT');
  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  client.logger.info('[SYNΞ] Received SIGTERM');
  await client.destroy();
  process.exit(0);
});

main();
