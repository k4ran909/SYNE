import { type Message } from 'discord.js';
import { redis } from '../../lib/redis';
import { RedisKeys, AutomodDefaults } from '../../lib/constants';
import { getGuildConfig } from '../../lib/utils';
import type { AutomodResult, CachedGuildConfig } from '../../lib/types';

export class AutomodService {
  /**
   * Run all automod checks on a message. Returns the first triggered result.
   */
  public static async check(message: Message): Promise<AutomodResult> {
    if (!message.guild || message.author.bot) {
      return { triggered: false, reason: null, severity: 'low', action: 'none' };
    }

    const config = await getGuildConfig(message.guild.id);
    if (!config.automodEnabled) {
      return { triggered: false, reason: null, severity: 'low', action: 'none' };
    }

    // Run checks in order of severity
    const checks: AutomodResult[] = [
      await this.checkSpam(message, config),
      this.checkBlockedWords(message, config),
      this.checkBlockedLinks(message, config),
      this.checkMentionSpam(message),
      this.checkEmojiSpam(message)
    ];

    // Return the highest severity triggered check
    const triggered = checks
      .filter(c => c.triggered)
      .sort((a, b) => this.severityRank(b.severity) - this.severityRank(a.severity));

    return triggered[0] || { triggered: false, reason: null, severity: 'low', action: 'none' };
  }

  /**
   * Anti-spam: track message frequency per user in Redis.
   */
  private static async checkSpam(message: Message, config: CachedGuildConfig): Promise<AutomodResult> {
    if (!config.antiSpamEnabled) {
      return { triggered: false, reason: null, severity: 'low', action: 'none' };
    }

    const key = `${RedisKeys.ANTI_SPAM}${message.guild!.id}:${message.author.id}`;
    const count = await redis.incr(key);

    if (count === 1) {
      // First message in this window — set expiry
      await redis.pexpire(key, config.antiSpamInterval || AutomodDefaults.INTERVAL_MS);
    }

    if (count > (config.antiSpamMaxMessages || AutomodDefaults.MAX_MESSAGES_PER_INTERVAL)) {
      return {
        triggered: true,
        reason: `Spam detected: ${count} messages in ${(config.antiSpamInterval || AutomodDefaults.INTERVAL_MS) / 1000}s`,
        severity: 'high',
        action: 'mute'
      };
    }

    // Check for duplicate content
    const dupKey = `${RedisKeys.ANTI_SPAM}dup:${message.guild!.id}:${message.author.id}`;
    const contentHash = Buffer.from(message.content.toLowerCase().trim()).toString('base64').slice(0, 32);
    const dupCount = await redis.hincrby(dupKey, contentHash, 1);

    if (dupCount === 1) {
      await redis.pexpire(dupKey, AutomodDefaults.DUPLICATE_WINDOW_MS);
    }

    if (dupCount > AutomodDefaults.MAX_DUPLICATE_MESSAGES) {
      return {
        triggered: true,
        reason: `Duplicate message spam detected`,
        severity: 'medium',
        action: 'delete'
      };
    }

    return { triggered: false, reason: null, severity: 'low', action: 'none' };
  }

  /**
   * Blocked words filter.
   */
  private static checkBlockedWords(message: Message, config: CachedGuildConfig): AutomodResult {
    if (!config.blockedWords.length) {
      return { triggered: false, reason: null, severity: 'low', action: 'none' };
    }

    const content = message.content.toLowerCase();
    const matched = config.blockedWords.find(word => content.includes(word.toLowerCase()));

    if (matched) {
      return {
        triggered: true,
        reason: `Blocked word detected: ||${matched}||`,
        severity: 'medium',
        action: 'delete'
      };
    }

    return { triggered: false, reason: null, severity: 'low', action: 'none' };
  }

  /**
   * Blocked links filter.
   */
  private static checkBlockedLinks(message: Message, config: CachedGuildConfig): AutomodResult {
    if (!config.blockedLinks.length) {
      return { triggered: false, reason: null, severity: 'low', action: 'none' };
    }

    const content = message.content.toLowerCase();
    const matched = config.blockedLinks.find(link => content.includes(link.toLowerCase()));

    if (matched) {
      return {
        triggered: true,
        reason: `Blocked link detected`,
        severity: 'high',
        action: 'delete'
      };
    }

    return { triggered: false, reason: null, severity: 'low', action: 'none' };
  }

  /**
   * Mass-mention detection.
   */
  private static checkMentionSpam(message: Message): AutomodResult {
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;

    if (mentionCount > AutomodDefaults.MAX_MENTIONS_PER_MESSAGE) {
      return {
        triggered: true,
        reason: `Mass mention detected: ${mentionCount} mentions`,
        severity: 'high',
        action: 'mute'
      };
    }

    return { triggered: false, reason: null, severity: 'low', action: 'none' };
  }

  /**
   * Emoji flood detection.
   */
  private static checkEmojiSpam(message: Message): AutomodResult {
    const emojiRegex = /(<a?:\w+:\d+>|[\u{1F000}-\u{1FFFF}])/gu;
    const emojiCount = (message.content.match(emojiRegex) || []).length;

    if (emojiCount > AutomodDefaults.EMOJI_SPAM_THRESHOLD) {
      return {
        triggered: true,
        reason: `Emoji spam detected: ${emojiCount} emojis`,
        severity: 'medium',
        action: 'delete'
      };
    }

    return { triggered: false, reason: null, severity: 'low', action: 'none' };
  }

  private static severityRank(severity: string): number {
    const ranks: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    return ranks[severity] || 0;
  }
}
