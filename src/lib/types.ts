// ─── Guild Settings (cached in memory or Redis) ────────────────
export interface CachedGuildConfig {
  guildId: string;
  modLogChannelId: string | null;
  messageLogChannelId: string | null;
  joinLeaveLogChannelId: string | null;
  autoRoleIds: string[];
  automodEnabled: boolean;
  antiSpamEnabled: boolean;
  antiSpamMaxMessages: number;
  antiSpamInterval: number;
  blockedWords: string[];
  blockedLinks: string[];
  antiRaidEnabled: boolean;
  antiRaidThreshold: number;
  antiRaidWindow: number;
  beastModeActive: boolean;
  antiNukeEnabled: boolean;
  antiNukeMaxActions: number;
  antiNukeWindow: number;
  verificationEnabled: boolean;
  verificationChannelId: string | null;
  verificationRoleId: string | null;
  warnThresholdForMute: number;
  warnThresholdForKick: number;
  warnThresholdForBan: number;
}

// ─── Infraction Types ───────────────────────────────────────────
// Matches the PostgreSQL enum in schema.prisma
// After `prisma generate` with PostgreSQL, import from @prisma/client instead
export type InfractionType = 'WARN' | 'MUTE' | 'KICK' | 'BAN' | 'UNMUTE' | 'UNBAN';

// ─── Risk Score Assessment ──────────────────────────────────────
export interface RiskAssessment {
  userId: string;
  guildId: string;
  score: number;
  factors: string[];
  timestamp: number;
}

// ─── Automod Check Result ───────────────────────────────────────
export interface AutomodResult {
  triggered: boolean;
  reason: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'none' | 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
}

// ─── Infraction Data ────────────────────────────────────────────
export interface InfractionData {
  guildId: string;
  userId: string;
  moderatorId: string;
  type: InfractionType;
  reason: string;
  duration?: number; // ms
}

// ─── Destructive Action Tracking (Anti-Nuke) ────────────────────
export interface DestructiveAction {
  userId: string;
  guildId: string;
  action: string;
  timestamp: number;
}

// ─── Role Panel Config ──────────────────────────────────────────
export interface RolePanelRole {
  roleId: string;
  emoji: string;
  label: string;
  style: 'Primary' | 'Secondary' | 'Success' | 'Danger';
}

// ─── Log Types ──────────────────────────────────────────────────
export type LogType = 'mod' | 'message' | 'joinleave';
