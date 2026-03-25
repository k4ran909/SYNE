import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { prisma } from '../../lib/database';
import { successEmbed, invalidateGuildConfig } from '../../lib/utils';

export class AntiRaidCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'antiraid',
      description: 'Configure anti-raid protection settings',
      requiredUserPermissions: [PermissionFlagsBits.Administrator]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('antiraid')
        .setDescription('Configure anti-raid protection settings')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('Enable or disable anti-raid').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('threshold').setDescription('Risk score threshold to trigger Beast Mode (default: 30)').setMinValue(10).setMaxValue(100).setRequired(false)
        )
        .addIntegerOption((option) =>
          option.setName('window').setDescription('Time window in seconds (default: 10)').setMinValue(5).setMaxValue(60).setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const enabled = interaction.options.getBoolean('enabled', true);
    const threshold = interaction.options.getInteger('threshold');
    const windowSec = interaction.options.getInteger('window');
    const guild = interaction.guild!;

    const updateData: any = { antiRaidEnabled: enabled };
    if (threshold) updateData.antiRaidThreshold = threshold;
    if (windowSec) updateData.antiRaidWindow = windowSec * 1000;

    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      update: updateData,
      create: { guildId: guild.id, ...updateData }
    });

    await invalidateGuildConfig(guild.id);

    const status = enabled ? '✅ Enabled' : '❌ Disabled';
    return interaction.reply({
      embeds: [successEmbed('Anti-Raid Updated', `**Status:** ${status}\n**Threshold:** ${threshold || 30}\n**Window:** ${windowSec || 10}s`)],
      ephemeral: true
    });
  }
}
