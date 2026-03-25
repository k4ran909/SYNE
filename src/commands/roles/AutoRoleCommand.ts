import { Command } from '@sapphire/framework';
import { PermissionFlagsBits } from 'discord.js';
import { RoleService } from '../../modules/roles/RoleService';
import { prisma } from '../../lib/database';
import { successEmbed, errorEmbed, invalidateGuildConfig } from '../../lib/utils';

export class AutoRoleCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'autorole',
      description: 'Configure auto-role assignment for new members',
      requiredUserPermissions: [PermissionFlagsBits.ManageRoles]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('autorole')
        .setDescription('Configure auto-role assignment for new members')
        .addRoleOption((option) =>
          option.setName('role').setDescription('Role to auto-assign (toggle on/off)').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const role = interaction.options.getRole('role', true);
    const guild = interaction.guild!;

    // Check if bot can assign this role
    const botMember = guild.members.me;
    if (!botMember || botMember.roles.highest.position <= role.position) {
      return interaction.reply({
        embeds: [errorEmbed('Error', 'I cannot assign this role — it is above my highest role.')],
        ephemeral: true
      });
    }

    await RoleService.setAutoRole(guild.id, role.id);
    await invalidateGuildConfig(guild.id);

    // Get updated list
    const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
    const isNowActive = config?.autoRoleIds.includes(role.id);

    return interaction.reply({
      embeds: [successEmbed(
        'Auto-Role Updated',
        isNowActive
          ? `✅ **${role.name}** will now be auto-assigned to new members.`
          : `❌ **${role.name}** has been removed from auto-roles.`
      )],
      ephemeral: true
    });
  }
}
