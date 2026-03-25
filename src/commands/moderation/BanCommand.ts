import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../modules/moderation/ModerationService';
import { LoggingService } from '../../modules/logging/LoggingService';
import { canModerate, modEmbed, errorEmbed, safeDM, parseDuration, formatDuration } from '../../lib/utils';

export class BanCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'ban',
      description: 'Ban a user from the server',
      requiredUserPermissions: [PermissionFlagsBits.BanMembers]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user to ban').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the ban').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('duration').setDescription('Duration for temp-ban (e.g., 7d). Leave empty for permanent.').setRequired(false)
        )
        .addIntegerOption((option) =>
          option.setName('purge_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const durationStr = interaction.options.getString('duration');
    const purgeDays = interaction.options.getInteger('purge_days') || 0;
    const guild = interaction.guild!;
    const moderator = interaction.user;

    // Parse optional duration
    let durationMs: number | undefined;
    if (durationStr) {
      durationMs = parseDuration(durationStr) || undefined;
      if (!durationMs) {
        return interaction.reply({ embeds: [errorEmbed('Error', 'Invalid duration format. Use: `10m`, `2h`, `7d`')], ephemeral: true });
      }
    }

    // Check if user is in guild for hierarchy check
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (targetMember) {
      const modMember = await guild.members.fetch(moderator.id);
      if (!canModerate(modMember, targetMember)) {
        return interaction.reply({ embeds: [errorEmbed('Error', 'You cannot moderate this user (role hierarchy).')], ephemeral: true });
      }
    }

    // DM before ban
    const durationText = durationMs ? formatDuration(durationMs) : 'Permanent';
    await safeDM(target, modEmbed('Banned', `You have been banned from **${guild.name}**\n**Duration:** ${durationText}\n**Reason:** ${reason}`));

    // Ban
    try {
      await guild.members.ban(target.id, {
        reason: `${moderator.tag}: ${reason}`,
        deleteMessageSeconds: purgeDays * 86400
      });
    } catch {
      return interaction.reply({ embeds: [errorEmbed('Error', 'Failed to ban user.')], ephemeral: true });
    }

    // Store infraction
    const result = await ModerationService.createInfraction({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type: 'BAN',
      reason,
      duration: durationMs
    });

    // Log
    await LoggingService.logInfraction(guild, moderator, target, 'BAN', reason, durationText, result.infractionId);

    return interaction.reply({
      embeds: [modEmbed('User Banned', `**${target.tag}** has been banned.\n**Duration:** ${durationText}\n**Reason:** ${reason}`)]
    });
  }
}
