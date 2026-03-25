import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../modules/moderation/ModerationService';
import { LoggingService } from '../../modules/logging/LoggingService';
import { canModerate, botCanModerate, modEmbed, errorEmbed, safeDM, parseDuration, formatDuration } from '../../lib/utils';

export class MuteCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'mute',
      description: 'Timeout/mute a user',
      requiredUserPermissions: [PermissionFlagsBits.ModerateMembers]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('mute')
        .setDescription('Timeout/mute a user')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user to mute').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('duration').setDescription('Duration (e.g., 10m, 2h, 7d)').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the mute').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const durationStr = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason', true);
    const guild = interaction.guild!;
    const moderator = interaction.user;

    // Parse duration
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'Invalid duration format. Use: `10s`, `5m`, `2h`, `7d`')], ephemeral: true });
    }

    // Max timeout: 28 days (Discord limit)
    if (durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'Maximum timeout duration is 28 days.')], ephemeral: true });
    }

    // Fetch target member
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'User not found in this server.')], ephemeral: true });
    }

    // Hierarchy checks
    const modMember = await guild.members.fetch(moderator.id);
    if (!canModerate(modMember, targetMember)) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'You cannot moderate this user (role hierarchy).')], ephemeral: true });
    }
    if (!botCanModerate(guild, targetMember)) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'I cannot moderate this user (my role is too low).')], ephemeral: true });
    }

    // Apply Discord timeout
    try {
      await targetMember.timeout(durationMs, `${moderator.tag}: ${reason}`);
    } catch {
      return interaction.reply({ embeds: [errorEmbed('Error', 'Failed to apply timeout.')], ephemeral: true });
    }

    // Store infraction
    const result = await ModerationService.createInfraction({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type: 'MUTE',
      reason,
      duration: durationMs
    });

    // DM user
    await safeDM(target, modEmbed('Muted', `You have been muted in **${guild.name}** for **${formatDuration(durationMs)}**\n**Reason:** ${reason}`));

    // Log
    await LoggingService.logInfraction(guild, moderator, target, 'MUTE', reason, formatDuration(durationMs), result.infractionId);

    return interaction.reply({
      embeds: [modEmbed('User Muted', `**${target.tag}** has been muted for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`)]
    });
  }
}
