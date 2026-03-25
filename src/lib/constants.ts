// ─── Embed Colors ────────────────────────────────────────────────
export const Colors = {
  Success: 0x57f287,    // Green
  Error: 0xed4245,      // Red
  Warning: 0xfee75c,    // Yellow
  Info: 0x5865f2,       // Blurple
  Moderation: 0xe67e22, // Orange
  Security: 0xe91e63,   // Pink
  Logging: 0x3498db,    // Blue
  Roles: 0x9b59b6       // Purple
} as const;

// ─── Anti-Raid Risk Scoring Defaults ─────────────────────────────
export const RiskScores = {
  NO_AVATAR: 5,
  NEW_ACCOUNT: 5,     // Account created < 7 days ago
  VERY_NEW_ACCOUNT: 10, // Account created < 1 day ago
  JOIN_VELOCITY: 10,  // Part of a join row
  SUSPICIOUS_NAME: 3  // Username matches known raid patterns
} as const;

// ─── Automod Defaults ────────────────────────────────────────────
export const AutomodDefaults = {
  MAX_MESSAGES_PER_INTERVAL: 5,
  INTERVAL_MS: 5000,
  MAX_MENTIONS_PER_MESSAGE: 5,
  MAX_DUPLICATE_MESSAGES: 3,
  DUPLICATE_WINDOW_MS: 10000,
  EMOJI_SPAM_THRESHOLD: 10,
  NEWLINE_SPAM_THRESHOLD: 15
} as const;

// ─── Anti-Nuke Defaults ─────────────────────────────────────────
export const AntiNukeDefaults = {
  MAX_DESTRUCTIVE_ACTIONS: 3,
  WINDOW_MS: 10000,
  BEAST_MODE_DURATION_MS: 300000 // 5 minutes
} as const;

// ─── Time Constants ─────────────────────────────────────────────
export const Time = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000
} as const;

// ─── Redis Key Prefixes ─────────────────────────────────────────
export const RedisKeys = {
  GUILD_CONFIG: 'guild:config:',
  COOLDOWN: 'cooldown:',
  ANTI_SPAM: 'antispam:',
  ANTI_RAID: 'antiraid:',
  ANTI_NUKE: 'antinuke:',
  TEMP_BAN: 'tempban:',
  TEMP_MUTE: 'tempmute:',
  JOIN_VELOCITY: 'joinvelocity:'
} as const;
