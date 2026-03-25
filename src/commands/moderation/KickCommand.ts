import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../modules/moderation/ModerationService';
import { LoggingService } from '../../modules/logging/LoggingService';
import { canModerate, botCanModerate, modEmbed, errorEmbed, safeDM } from '../../lib/utils';

export class KickCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'kick',
      description: 'Kick a user from the server',
      requiredUserPermissions: [PermissionFlagsBits.KickMembers]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user to kick').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the kick').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const guild = interaction.guild!;
    const moderator = interaction.user;

    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'User not found in this server.')], ephemeral: true });
    }

    const modMember = await guild.members.fetch(moderator.id);
    if (!canModerate(modMember, targetMember)) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'You cannot moderate this user (role hierarchy).')], ephemeral: true });
    }
    if (!botCanModerate(guild, targetMember)) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'I cannot moderate this user (my role is too low).')], ephemeral: true });
    }

    // DM before kick
    await safeDM(target, modEmbed('Kicked', `You have been kicked from **${guild.name}**\n**Reason:** ${reason}`));

    // Kick
    try {
      await targetMember.kick(`${moderator.tag}: ${reason}`);
    } catch {
      return interaction.reply({ embeds: [errorEmbed('Error', 'Failed to kick user.')], ephemeral: true });
    }

    // Store infraction
    const result = await ModerationService.createInfraction({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type: 'KICK',
      reason
    });

    // Log
    await LoggingService.logInfraction(guild, moderator, target, 'KICK', reason, undefined, result.infractionId);

    return interaction.reply({
      embeds: [modEmbed('User Kicked', `**${target.tag}** has been kicked.\n**Reason:** ${reason}`)]
    });
  }
}
