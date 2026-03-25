import { Listener } from '@sapphire/framework';
import { Events, type Message } from 'discord.js';
import { AutomodService } from '../modules/moderation/AutomodService';
import { ModerationService } from '../modules/moderation/ModerationService';
import { LoggingService } from '../modules/logging/LoggingService';

export class MessageCreateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageCreate
    });
  }

  public override async run(message: Message) {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    // Run automod checks
    const result = await AutomodService.check(message);

    if (!result.triggered) return;

    // Execute the automod action
    switch (result.action) {
      case 'delete':
        try {
          await message.delete();
        } catch {}
        break;

      case 'warn':
        await ModerationService.createInfraction({
          guildId: message.guild.id,
          userId: message.author.id,
          moderatorId: message.client.user!.id,
          type: 'WARN',
          reason: `[Automod] ${result.reason}`
        });
        await LoggingService.logInfraction(
          message.guild,
          message.client.user!,
          message.author,
          'WARN',
          `[Automod] ${result.reason}`
        );
        try {
          await message.delete();
        } catch {}
        break;

      case 'mute':
        // Apply 10-minute timeout for spam
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        if (member && member.moderatable) {
          try {
            await member.timeout(10 * 60 * 1000, `[Automod] ${result.reason}`);
          } catch {}
        }
        await ModerationService.createInfraction({
          guildId: message.guild.id,
          userId: message.author.id,
          moderatorId: message.client.user!.id,
          type: 'MUTE',
          reason: `[Automod] ${result.reason}`,
          duration: 10 * 60 * 1000
        });
        await LoggingService.logInfraction(
          message.guild,
          message.client.user!,
          message.author,
          'MUTE',
          `[Automod] ${result.reason}`,
          '10m'
        );
        try {
          await message.delete();
        } catch {}
        break;
    }
  }
}
