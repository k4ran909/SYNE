import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { SecurityService } from '../../modules/security/SecurityService';
import { LoggingService } from '../../modules/logging/LoggingService';
import { successEmbed, securityEmbed } from '../../lib/utils';

export class LockdownCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'lockdown',
      description: 'Emergency server lockdown (Beast Mode)',
      requiredUserPermissions: [PermissionFlagsBits.Administrator]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('lockdown')
        .setDescription('Emergency server lockdown')
        .addStringOption((option) =>
          option
            .setName('action')
            .setDescription('Lockdown action')
            .setRequired(true)
            .addChoices(
              { name: 'Activate', value: 'activate' },
              { name: 'Release', value: 'release' }
            )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const action = interaction.options.getString('action', true);
    const guild = interaction.guild!;

    await interaction.deferReply();

    if (action === 'activate') {
      await SecurityService.activateBeastMode(guild);
      await LoggingService.logSecurityEvent(
        guild,
        'Beast Mode Activated',
        `🔒 Manual lockdown triggered by **${interaction.user.tag}**\nAll text channels locked for @everyone.`
      );
      return interaction.editReply({
        embeds: [securityEmbed('Beast Mode Activated', '🔒 All text channels have been locked.\nUse `/lockdown release` to unlock.')]
      });
    } else {
      await SecurityService.deactivateBeastMode(guild);
      await LoggingService.logSecurityEvent(
        guild,
        'Beast Mode Released',
        `🔓 Lockdown released by **${interaction.user.tag}**\nAll text channels restored.`
      );
      return interaction.editReply({
        embeds: [successEmbed('Lockdown Released', '🔓 All text channels have been unlocked.')]
      });
    }
  }
}
