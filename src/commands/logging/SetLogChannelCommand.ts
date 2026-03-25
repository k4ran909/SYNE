import { Command } from '@sapphire/framework';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../../lib/database';
import { successEmbed, invalidateGuildConfig } from '../../lib/utils';
import type { LogType } from '../../lib/types';

export class SetLogChannelCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'setlog',
      description: 'Set the logging channel for a specific log type',
      requiredUserPermissions: [PermissionFlagsBits.Administrator]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('setlog')
        .setDescription('Set the logging channel for a specific log type')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('The type of log')
            .setRequired(true)
            .addChoices(
              { name: 'Moderation', value: 'mod' },
              { name: 'Messages', value: 'message' },
              { name: 'Join/Leave', value: 'joinleave' }
            )
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel to log to (leave empty to disable)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const logType = interaction.options.getString('type', true) as LogType;
    const channel = interaction.options.getChannel('channel');
    const guild = interaction.guild!;

    const fieldMap: Record<LogType, string> = {
      mod: 'modLogChannelId',
      message: 'messageLogChannelId',
      joinleave: 'joinLeaveLogChannelId'
    };

    const field = fieldMap[logType];
    const channelId = channel?.id || null;

    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      update: { [field]: channelId },
      create: { guildId: guild.id, [field]: channelId }
    });

    await invalidateGuildConfig(guild.id);

    const typeLabel = { mod: 'Moderation', message: 'Message', joinleave: 'Join/Leave' }[logType];

    if (channelId) {
      return interaction.reply({
        embeds: [successEmbed('Log Channel Set', `**${typeLabel}** logs will now be sent to <#${channelId}>`)],
        ephemeral: true
      });
    } else {
      return interaction.reply({
        embeds: [successEmbed('Log Channel Disabled', `**${typeLabel}** logging has been disabled.`)],
        ephemeral: true
      });
    }
  }
}
