import {
  type Guild,
  type GuildMember,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { redis } from '../../lib/redis';
import { prisma } from '../../lib/database';
import { RedisKeys, RiskScores, AntiNukeDefaults, Time } from '../../lib/constants';
import { getGuildConfig, securityEmbed, invalidateGuildConfig } from '../../lib/utils';
import type { RiskAssessment, DestructiveAction } from '../../lib/types';

export class SecurityService {
  // ─── Anti-Raid: Heuristic Risk Scoring ─────────────────────────

  /**
   * Assess the risk score of a newly joined member.
   */
  public static async assessRisk(member: GuildMember): Promise<RiskAssessment> {
    const factors: string[] = [];
    let score = 0;

    // Factor 1: No avatar
    if (!member.user.avatar) {
      score += RiskScores.NO_AVATAR;
      factors.push('No profile avatar');
    }

    // Factor 2: Account age
    const accountAge = Date.now() - member.user.createdTimestamp;
    if (accountAge < Time.DAY) {
      score += RiskScores.VERY_NEW_ACCOUNT;
      factors.push('Account created < 1 day ago');
    } else if (accountAge < Time.WEEK) {
      score += RiskScores.NEW_ACCOUNT;
      factors.push('Account created < 7 days ago');
    }

    // Factor 3: Join velocity (how many users joined in the recent window)
    const joinKey = `${RedisKeys.JOIN_VELOCITY}${member.guild.id}`;
    const now = Date.now();
    const config = await getGuildConfig(member.guild.id);

    // Add this join to the sorted set with timestamp as score
    await redis.zadd(joinKey, now, member.id);
    // Remove entries older than the anti-raid window
    await redis.zremrangebyscore(joinKey, 0, now - (config.antiRaidWindow || 10000));
    // Set expiry on the key itself
    await redis.pexpire(joinKey, config.antiRaidWindow || 10000);

    const recentJoinCount = await redis.zcard(joinKey);
    if (recentJoinCount >= 5) {
      score += RiskScores.JOIN_VELOCITY;
      factors.push(`Join row: ${recentJoinCount} joins in ${(config.antiRaidWindow || 10000) / 1000}s`);
    }

    // Factor 4: Suspicious name patterns
    const suspiciousPatterns = [
      /^[a-z]{2,4}\d{4,}$/i,       // e.g., "abc12345"
      /^user\d+$/i,                  // e.g., "user98765"
      /free.*nitro/i,                // scam names
      /discord.*mod/i                // impersonation
    ];
    if (suspiciousPatterns.some(p => p.test(member.user.username))) {
      score += RiskScores.SUSPICIOUS_NAME;
      factors.push('Suspicious username pattern');
    }

    return {
      userId: member.id,
      guildId: member.guild.id,
      score,
      factors,
      timestamp: now
    };
  }

  /**
   * Check if the guild should enter Beast Mode based on cumulative risk.
   */
  public static async shouldActivateBeastMode(guildId: string, currentScore: number): Promise<boolean> {
    const config = await getGuildConfig(guildId);
    if (!config.antiRaidEnabled || config.beastModeActive) return false;

    // Track cumulative risk in Redis
    const riskKey = `${RedisKeys.ANTI_RAID}risk:${guildId}`;
    const newTotal = await redis.incrby(riskKey, currentScore);
    await redis.pexpire(riskKey, config.antiRaidWindow || 10000);

    return newTotal >= (config.antiRaidThreshold || 30);
  }

  /**
   * Activate Beast Mode: lock down the server.
   */
  public static async activateBeastMode(guild: Guild): Promise<void> {
    // Update DB flag
    await prisma.guildConfig.update({
      where: { guildId: guild.id },
      data: { beastModeActive: true }
    });
    await invalidateGuildConfig(guild.id);

    // Lock all text channels for @everyone
    const everyoneRole = guild.roles.everyone;
    const textChannels = guild.channels.cache.filter(
      c => c.type === ChannelType.GuildText
    );

    for (const [, channel] of textChannels) {
      try {
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false
        });
      } catch {}
    }

    // Schedule auto-deactivation
    setTimeout(async () => {
      await this.deactivateBeastMode(guild);
    }, AntiNukeDefaults.BEAST_MODE_DURATION_MS);
  }

  /**
   * Deactivate Beast Mode: unlock the server.
   */
  public static async deactivateBeastMode(guild: Guild): Promise<void> {
    await prisma.guildConfig.update({
      where: { guildId: guild.id },
      data: { beastModeActive: false }
    });
    await invalidateGuildConfig(guild.id);

    // Restore @everyone send permission in text channels
    const everyoneRole = guild.roles.everyone;
    const textChannels = guild.channels.cache.filter(
      c => c.type === ChannelType.GuildText
    );

    for (const [, channel] of textChannels) {
      try {
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null // Reset to default
        });
      } catch {}
    }
  }

  // ─── Anti-Nuke: Destructive Action Rate Limiting ───────────────

  /**
   * Track a destructive action. Returns true if the actor should be stopped.
   */
  public static async trackDestructiveAction(
    guildId: string,
    userId: string,
    action: string
  ): Promise<{ shouldStop: boolean; actionCount: number }> {
    const config = await getGuildConfig(guildId);
    if (!config.antiNukeEnabled) return { shouldStop: false, actionCount: 0 };

    const key = `${RedisKeys.ANTI_NUKE}${guildId}:${userId}`;
    const now = Date.now();

    // Store action as JSON in a Redis sorted set (score = timestamp)
    await redis.zadd(key, now, `${action}:${now}`);
    await redis.zremrangebyscore(key, 0, now - (config.antiNukeWindow || AntiNukeDefaults.WINDOW_MS));
    await redis.pexpire(key, config.antiNukeWindow || AntiNukeDefaults.WINDOW_MS);

    const actionCount = await redis.zcard(key);
    const maxActions = config.antiNukeMaxActions || AntiNukeDefaults.MAX_DESTRUCTIVE_ACTIONS;

    return {
      shouldStop: actionCount >= maxActions,
      actionCount
    };
  }

  /**
   * Strip all dangerous permissions from a user detected as a nuke threat.
   */
  public static async neutralizeThreat(guild: Guild, userId: string): Promise<void> {
    try {
      const member = await guild.members.fetch(userId);

      // Remove all roles with dangerous permissions
      const dangerousRoles = member.roles.cache.filter(role =>
        role.permissions.has(PermissionFlagsBits.Administrator) ||
        role.permissions.has(PermissionFlagsBits.ManageGuild) ||
        role.permissions.has(PermissionFlagsBits.ManageChannels) ||
        role.permissions.has(PermissionFlagsBits.ManageRoles) ||
        role.permissions.has(PermissionFlagsBits.BanMembers) ||
        role.permissions.has(PermissionFlagsBits.KickMembers)
      );

      for (const [, role] of dangerousRoles) {
        if (role.editable) {
          await member.roles.remove(role, 'Anti-Nuke: Destructive action threshold exceeded');
        }
      }
    } catch {}
  }

  // ─── Server Backup ─────────────────────────────────────────────

  /**
   * Create a serialized snapshot of the guild structure.
   */
  public static async createBackup(guild: Guild, createdBy: string): Promise<string> {
    const data = {
      name: guild.name,
      icon: guild.iconURL(),
      channels: guild.channels.cache.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        position: 'position' in c ? (c as any).position : 0
      })),
      roles: guild.roles.cache
        .filter(r => r.id !== guild.id) // Exclude @everyone
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          position: r.position,
          permissions: r.permissions.bitfield.toString()
        }))
    };

    const backup = await prisma.serverBackup.create({
      data: {
        guildId: guild.id,
        createdBy,
        data
      }
    });

    return backup.id;
  }
}
