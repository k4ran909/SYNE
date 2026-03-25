import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../modules/moderation/ModerationService';
import { LoggingService } from '../../modules/logging/LoggingService';
import { canModerate, modEmbed, errorEmbed, safeDM } from '../../lib/utils';

export class WarnCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'warn',
      description: 'Warn a user for rule violations',
      requiredUserPermissions: [PermissionFlagsBits.ModerateMembers]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('warn')
        .setDescription('Warn a user for rule violations')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user to warn').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the warning').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const guild = interaction.guild!;
    const moderator = interaction.user;

    // Fetch guild member
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'User not found in this server.')], ephemeral: true });
    }

    // Hierarchy check
    const modMember = await guild.members.fetch(moderator.id);
    if (!canModerate(modMember, targetMember)) {
      return interaction.reply({ embeds: [errorEmbed('Error', 'You cannot moderate this user (role hierarchy).')], ephemeral: true });
    }

    // Create infraction
    const result = await ModerationService.createInfraction({
      guildId: guild.id,
      userId: target.id,
      moderatorId: moderator.id,
      type: 'WARN',
      reason
    });

    // DM the user
    await safeDM(target, modEmbed('Warning Received', `You have been warned in **${guild.name}**\n**Reason:** ${reason}`));

    // Log to mod channel
    await LoggingService.logInfraction(guild, moderator, target, 'WARN', reason, undefined, result.infractionId);

    // Reply
    const embed = modEmbed('User Warned', `**${target.tag}** has been warned.\n**Reason:** ${reason}`);

    if (result.escalated) {
      embed.addFields({ name: '⚠️ Auto-Escalation', value: `User has reached the threshold for a **${result.escalationAction}**`, inline: false });
    }

    return interaction.reply({ embeds: [embed] });
  }
}
