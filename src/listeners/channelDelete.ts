import { Listener } from '@sapphire/framework';
import { Events, type DMChannel, type NonThreadGuildBasedChannel } from 'discord.js';
import { SecurityService } from '../modules/security/SecurityService';
import { LoggingService } from '../modules/logging/LoggingService';

export class ChannelDeleteListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.ChannelDelete
    });
  }

  public override async run(channel: DMChannel | NonThreadGuildBasedChannel) {
    // Ignore DM channels
    if (!('guild' in channel) || !channel.guild) return;

    const guild = channel.guild;

    // Try to find who deleted the channel via audit logs
    let executorId: string | null = null;
    try {
      const auditLogs = await guild.fetchAuditLogs({
        type: 12, // CHANNEL_DELETE
        limit: 1
      });
      const entry = auditLogs.entries.first();
      if (entry && entry.target?.id === channel.id) {
        executorId = entry.executor?.id || null;
      }
    } catch {}

    if (!executorId) return;

    // Skip if the executor is the bot itself
    if (executorId === guild.client.user?.id) return;

    // Track destructive action
    const result = await SecurityService.trackDestructiveAction(
      guild.id,
      executorId,
      'CHANNEL_DELETE'
    );

    if (result.shouldStop) {
      // Neutralize the threat
      await SecurityService.neutralizeThreat(guild, executorId);
      await LoggingService.logSecurityEvent(
        guild,
        'Anti-Nuke Triggered',
        `🚨 **${executorId}** exceeded destructive action limit!\n**Action:** Channel deletion\n**Count:** ${result.actionCount}\nAll dangerous permissions have been revoked.`
      );
    }
  }
}
