import type { InfractionType } from '../../lib/types';
import { type GuildMember, type User } from 'discord.js';
import { prisma } from '../../lib/database';
import { redis, redisAvailable } from '../../lib/redis';
import { RedisKeys, Time } from '../../lib/constants';
import {
  modEmbed,
  safeDM,
  canModerate,
  botCanModerate,
  getGuildConfig,
  parseDuration,
  formatDuration
} from '../../lib/utils';
import type { InfractionData } from '../../lib/types';

export class ModerationService {
  /**
   * Create an infraction and apply the punishment.
   */
  public static async createInfraction(data: InfractionData): Promise<{
    infractionId: string;
    escalated: boolean;
    escalationAction?: string;
  }> {
    const expiresAt = data.duration
      ? new Date(Date.now() + data.duration)
      : null;

    // Store infraction in database
    const infraction = await prisma.infraction.create({
      data: {
        guildId: data.guildId,
        userId: data.userId,
        moderatorId: data.moderatorId,
        type: data.type,
        reason: data.reason,
        duration: data.duration || null,
        expiresAt,
        active: true
      }
    });

    // If temp punishment, store TTL in Redis for auto-expiry tracking
    if (data.duration && (data.type === 'MUTE' || data.type === 'BAN')) {
      const key = data.type === 'MUTE'
        ? `${RedisKeys.TEMP_MUTE}${data.guildId}:${data.userId}`
        : `${RedisKeys.TEMP_BAN}${data.guildId}:${data.userId}`;

      await redis.set(key, infraction.id, 'PX', data.duration);
    }

    // Check for auto-escalation
    const escalation = await this.checkEscalation(data.guildId, data.userId);

    return {
      infractionId: infraction.id,
      escalated: escalation.shouldEscalate,
      escalationAction: escalation.action
    };
  }

  /**
   * Check if the user's infraction count warrants auto-escalation.
   */
  private static async checkEscalation(guildId: string, userId: string): Promise<{
    shouldEscalate: boolean;
    action?: string;
  }> {
    const config = await getGuildConfig(guildId);
    const warnCount = await prisma.infraction.count({
      where: {
        guildId,
        userId,
        type: 'WARN',
        active: true
      }
    });

    if (warnCount >= config.warnThresholdForBan) {
      return { shouldEscalate: true, action: 'BAN' };
    }
    if (warnCount >= config.warnThresholdForKick) {
      return { shouldEscalate: true, action: 'KICK' };
    }
    if (warnCount >= config.warnThresholdForMute) {
      return { shouldEscalate: true, action: 'MUTE' };
    }

    return { shouldEscalate: false };
  }

  /**
   * Get a user's infraction history for a guild.
   */
  public static async getHistory(guildId: string, userId: string) {
    return prisma.infraction.findMany({
      where: { guildId, userId },
      orderBy: { createdAt: 'desc' },
      take: 25
    });
  }

  /**
   * Deactivate an infraction (e.g., on unmute/unban).
   */
  public static async deactivateInfraction(infractionId: string): Promise<void> {
    await prisma.infraction.update({
      where: { id: infractionId },
      data: { active: false }
    });
  }

  /**
   * Count active infractions of a given type.
   */
  public static async countActive(guildId: string, userId: string, type: InfractionType): Promise<number> {
    return prisma.infraction.count({
      where: { guildId, userId, type, active: true }
    });
  }
}
