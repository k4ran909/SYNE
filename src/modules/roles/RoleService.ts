import {
  type GuildMember,
  type TextChannel,
  type Role,
  type Guild,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { prisma } from '../../lib/database';
import { getGuildConfig } from '../../lib/utils';
import type { RolePanelRole } from '../../lib/types';

export class RoleService {
  // ─── Auto-Role Assignment ──────────────────────────────────────

  /**
   * Assign configured auto-roles to a new member.
   */
  public static async assignAutoRoles(member: GuildMember): Promise<string[]> {
    const config = await getGuildConfig(member.guild.id);
    const assignedRoles: string[] = [];

    if (!config.autoRoleIds.length) return assignedRoles;

    for (const roleId of config.autoRoleIds) {
      try {
        const role = member.guild.roles.cache.get(roleId);
        if (role && role.editable && !member.roles.cache.has(roleId)) {
          await member.roles.add(role, 'Auto-role assignment on join');
          assignedRoles.push(role.name);
        }
      } catch {}
    }

    return assignedRoles;
  }

  // ─── Button Role Panel ─────────────────────────────────────────

  /**
   * Create a persistent button-role panel in a channel.
   */
  public static async createButtonPanel(
    channel: TextChannel,
    roles: RolePanelRole[],
    title: string = 'Role Selection'
  ): Promise<string> {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();

    for (let i = 0; i < roles.length; i++) {
      if (i > 0 && i % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
      }

      const buttonStyle = this.parseButtonStyle(roles[i].style);
      const button = new ButtonBuilder()
        .setCustomId(`role_panel:${roles[i].roleId}`)
        .setLabel(roles[i].label)
        .setStyle(buttonStyle);

      if (roles[i].emoji) {
        button.setEmoji(roles[i].emoji);
      }

      currentRow.addComponents(button);
    }

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    const message = await channel.send({
      embeds: [{
        title: `🎭 ${title}`,
        description: 'Click a button below to toggle a role.',
        color: 0x9b59b6,
        footer: { text: 'Click again to remove the role' }
      }],
      components: rows
    });

    // Persist to database
    await prisma.rolePanel.create({
      data: {
        guildId: channel.guild.id,
        channelId: channel.id,
        messageId: message.id,
        roles: roles as any,
        mode: 'toggle'
      }
    });

    return message.id;
  }

  // ─── Role Toggle (Button Interaction Handler) ──────────────────

  /**
   * Toggle a role on/off for a member.
   */
  public static async toggleRole(member: GuildMember, roleId: string): Promise<{
    added: boolean;
    roleName: string;
  }> {
    const role = member.guild.roles.cache.get(roleId);
    if (!role || !role.editable) {
      throw new Error('Role not found or not editable');
    }

    // Hierarchy check: bot must be able to manage this role
    const botMember = member.guild.members.me;
    if (!botMember || botMember.roles.highest.position <= role.position) {
      throw new Error('Bot cannot manage this role due to hierarchy');
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(role, 'Role panel: role removed');
      return { added: false, roleName: role.name };
    } else {
      await member.roles.add(role, 'Role panel: role added');
      return { added: true, roleName: role.name };
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private static parseButtonStyle(style: string): ButtonStyle {
    const styles: Record<string, ButtonStyle> = {
      'Primary': ButtonStyle.Primary,
      'Secondary': ButtonStyle.Secondary,
      'Success': ButtonStyle.Success,
      'Danger': ButtonStyle.Danger
    };
    return styles[style] || ButtonStyle.Secondary;
  }

  /**
   * Set auto-roles for a guild.
   */
  public static async setAutoRole(guildId: string, roleId: string): Promise<void> {
    const config = await prisma.guildConfig.findUnique({
      where: { guildId }
    });

    const currentRoles = config?.autoRoleIds || [];

    if (currentRoles.includes(roleId)) {
      // Remove auto-role
      await prisma.guildConfig.update({
        where: { guildId },
        data: {
          autoRoleIds: currentRoles.filter(r => r !== roleId)
        }
      });
    } else {
      // Add auto-role
      await prisma.guildConfig.update({
        where: { guildId },
        data: {
          autoRoleIds: [...currentRoles, roleId]
        }
      });
    }
  }
}
