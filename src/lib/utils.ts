import {
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type TextChannel,
  type User,
  PermissionFlagsBits
} from 'discord.js';
import { Colors, Time } from './constants';
import { redis, redisAvailable } from './redis';
import { prisma } from './database';
import type { CachedGuildConfig } from './types';

// ─── Duration Parsing ───────────────────────────────────────────
const DURATION_REGEX = /^(\d+)(s|m|h|d|w)$/i;

const DURATION_MULTIPLIERS: Record<string, number> = {
  s: Time.SECOND,
  m: Time.MINUTE,
  h: Time.HOUR,
  d: Time.DAY,
  w: Time.WEEK
};

export function parseDuration(input: string): number | null {
  const match = input.match(DURATION_REGEX);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  return value * (DURATION_MULTIPLIERS[unit] || 0);
}

export function formatDuration(ms: number): string {
  if (ms >= Time.WEEK) return `${Math.floor(ms / Time.WEEK)}w`;
  if (ms >= Time.DAY) return `${Math.floor(ms / Time.DAY)}d`;
  if (ms >= Time.HOUR) return `${Math.floor(ms / Time.HOUR)}h`;
  if (ms >= Time.MINUTE) return `${Math.floor(ms / Time.MINUTE)}m`;
  return `${Math.floor(ms / Time.SECOND)}s`;
}

// ─── Embed Builders ─────────────────────────────────────────────

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Success).setTitle(`✅ ${title}`).setDescription(description).setTimestamp();
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Error).setTitle(`❌ ${title}`).setDescription(description).setTimestamp();
}

export function warningEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Warning).setTitle(`⚠️ ${title}`).setDescription(description).setTimestamp();
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Info).setTitle(`ℹ️ ${title}`).setDescription(description).setTimestamp();
}

export function modEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Moderation).setTitle(`🛡️ ${title}`).setDescription(description).setTimestamp();
}

export function securityEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Security).setTitle(`🔐 ${title}`).setDescription(description).setTimestamp();
}

// ─── In-memory config cache (fallback when Redis unavailable) ───
const memoryCache = new Map<string, { data: CachedGuildConfig; expires: number }>();

// ─── Guild Config Cache ─────────────────────────────────────────

export async function getGuildConfig(guildId: string): Promise<CachedGuildConfig> {
  const cacheKey = `guild:config:${guildId}`;

  // Try Redis first, then memory cache
  if (redisAvailable()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as CachedGuildConfig;
    } catch {}
  } else {
    const memCached = memoryCache.get(cacheKey);
    if (memCached && memCached.expires > Date.now()) return memCached.data;
  }

  // Fetch from database or create default
  let config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config) {
    config = await prisma.guildConfig.create({ data: { guildId } });
  }

  // PostgreSQL returns native arrays directly — no CSV parsing needed
  const cachedConfig: CachedGuildConfig = {
    guildId: config.guildId,
    modLogChannelId: config.modLogChannelId,
    messageLogChannelId: config.messageLogChannelId,
    joinLeaveLogChannelId: config.joinLeaveLogChannelId,
    autoRoleIds: config.autoRoleIds,
    automodEnabled: config.automodEnabled,
    antiSpamEnabled: config.antiSpamEnabled,
    antiSpamMaxMessages: config.antiSpamMaxMessages,
    antiSpamInterval: config.antiSpamInterval,
    blockedWords: config.blockedWords,
    blockedLinks: config.blockedLinks,
    antiRaidEnabled: config.antiRaidEnabled,
    antiRaidThreshold: config.antiRaidThreshold,
    antiRaidWindow: config.antiRaidWindow,
    beastModeActive: config.beastModeActive,
    antiNukeEnabled: config.antiNukeEnabled,
    antiNukeMaxActions: config.antiNukeMaxActions,
    antiNukeWindow: config.antiNukeWindow,
    verificationEnabled: config.verificationEnabled,
    verificationChannelId: config.verificationChannelId,
    verificationRoleId: config.verificationRoleId,
    warnThresholdForMute: config.warnThresholdForMute,
    warnThresholdForKick: config.warnThresholdForKick,
    warnThresholdForBan: config.warnThresholdForBan
  };

  // Cache for 5 minutes
  if (redisAvailable()) {
    try { await redis.set(cacheKey, JSON.stringify(cachedConfig), 'EX', 300); } catch {}
  } else {
    memoryCache.set(cacheKey, { data: cachedConfig, expires: Date.now() + 300000 });
  }
  return cachedConfig;
}

export async function invalidateGuildConfig(guildId: string): Promise<void> {
  const cacheKey = `guild:config:${guildId}`;
  if (redisAvailable()) {
    try { await redis.del(cacheKey); } catch {}
  }
  memoryCache.delete(cacheKey);
}

// ─── Permission Checks ─────────────────────────────────────────

export function canModerate(moderator: GuildMember, target: GuildMember): boolean {
  if (target.id === moderator.guild.ownerId) return false;
  if (moderator.id === moderator.guild.ownerId) return true;
  return moderator.roles.highest.position > target.roles.highest.position;
}

export function botCanModerate(guild: Guild, target: GuildMember): boolean {
  const botMember = guild.members.me;
  if (!botMember) return false;
  return botMember.roles.highest.position > target.roles.highest.position;
}

// ─── DM Helper ──────────────────────────────────────────────────

export async function safeDM(user: User, embed: EmbedBuilder): Promise<boolean> {
  try { await user.send({ embeds: [embed] }); return true; } catch { return false; }
}
