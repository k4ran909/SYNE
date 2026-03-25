import { Listener } from '@sapphire/framework';
import { Events, type Role, PermissionFlagsBits } from 'discord.js';
import { SecurityService } from '../modules/security/SecurityService';
import { LoggingService } from '../modules/logging/LoggingService';

const DANGEROUS_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers
];

export class RoleUpdateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildRoleUpdate
    });
  }

  public override async run(oldRole: Role, newRole: Role) {
    // Check if any dangerous permissions were added
    const addedDangerous = DANGEROUS_PERMISSIONS.filter(
      perm => !oldRole.permissions.has(perm) && newRole.permissions.has(perm)
    );

    if (addedDangerous.length === 0) return;

    // Try to find who updated the role via audit logs
    let executorId: string | null = null;
    try {
      const auditLogs = await newRole.guild.fetchAuditLogs({
        type: 31, // ROLE_UPDATE
        limit: 1
      });
      const entry = auditLogs.entries.first();
      if (entry && entry.target?.id === newRole.id) {
        executorId = entry.executor?.id || null;
      }
    } catch {}

    if (!executorId || executorId === newRole.guild.client.user?.id) return;

    // Track as potentially destructive
    const result = await SecurityService.trackDestructiveAction(
      newRole.guild.id,
      executorId,
      'ROLE_UPDATE'
    );

    // Log the permission escalation
    const permNames = addedDangerous.map(p => {
      const names: Record<string, string> = {
        [PermissionFlagsBits.Administrator.toString()]: 'Administrator',
        [PermissionFlagsBits.ManageGuild.toString()]: 'Manage Guild',
        [PermissionFlagsBits.ManageChannels.toString()]: 'Manage Channels',
        [PermissionFlagsBits.ManageRoles.toString()]: 'Manage Roles',
        [PermissionFlagsBits.BanMembers.toString()]: 'Ban Members',
        [PermissionFlagsBits.KickMembers.toString()]: 'Kick Members'
      };
      return names[p.toString()] || 'Unknown';
    });

    await LoggingService.logSecurityEvent(
      newRole.guild,
      'Permission Escalation Detected',
      `⚠️ Role **${newRole.name}** was given dangerous permissions:\n${permNames.map(p => `• ${p}`).join('\n')}\n\nModified by: <@${executorId}>`
    );

    if (result.shouldStop) {
      await SecurityService.neutralizeThreat(newRole.guild, executorId);
      await LoggingService.logSecurityEvent(
        newRole.guild,
        'Anti-Nuke Triggered',
        `🚨 **<@${executorId}>** exceeded destructive action limit!\nAll dangerous permissions have been revoked.`
      );
    }
  }
}
