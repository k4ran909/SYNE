import { Command } from '@sapphire/framework';
import { ChannelType, PermissionFlagsBits, type TextChannel } from 'discord.js';
import { RoleService } from '../../modules/roles/RoleService';
import { successEmbed, errorEmbed } from '../../lib/utils';
import type { RolePanelRole } from '../../lib/types';

export class ReactionRoleCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'reactionrole',
      description: 'Create a button-based role selection panel',
      requiredUserPermissions: [PermissionFlagsBits.ManageRoles]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('reactionrole')
        .setDescription('Create a button-based role selection panel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to post the role panel in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option.setName('role1').setDescription('First role').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('label1').setDescription('Label for first role button').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('emoji1').setDescription('Emoji for first role button').setRequired(false)
        )
        .addRoleOption((option) =>
          option.setName('role2').setDescription('Second role').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('label2').setDescription('Label for second role button').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('emoji2').setDescription('Emoji for second role button').setRequired(false)
        )
        .addRoleOption((option) =>
          option.setName('role3').setDescription('Third role').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('label3').setDescription('Label for third role button').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('emoji3').setDescription('Emoji for third role button').setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('channel', true) as TextChannel;

    // Collect roles from options
    const roles: RolePanelRole[] = [];

    for (let i = 1; i <= 3; i++) {
      const role = interaction.options.getRole(`role${i}`);
      const label = interaction.options.getString(`label${i}`);

      if (role && label) {
        roles.push({
          roleId: role.id,
          label,
          emoji: interaction.options.getString(`emoji${i}`) || '',
          style: 'Primary'
        });
      }
    }

    if (roles.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('Error', 'Please provide at least one role with a label.')],
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const messageId = await RoleService.createButtonPanel(channel, roles);
      return interaction.editReply({
        embeds: [successEmbed('Role Panel Created', `Button role panel posted in <#${channel.id}>\n**Message ID:** \`${messageId}\``)]
      });
    } catch (err) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Failed to create role panel. Make sure I have permissions in that channel.')]
      });
    }
  }
}
