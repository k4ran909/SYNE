import {
  type Guild,
  type GuildMember,
  type Message,
  type PartialMessage,
  type TextChannel,
  type User,
  EmbedBuilder
} from 'discord.js';
import { InfractionType } from '@prisma/client';
import { Colors } from '../../lib/constants';
import { getGuildConfig } from '../../lib/utils';
import type { LogType } from '../../lib/types';

export class LoggingService {
  // ─── Send Log to Configured Channel ────────────────────────────

  private static async sendLog(guild: Guild, logType: LogType, embed: EmbedBuilder): Promise<void> {
    const config = await getGuildConfig(guild.id);

    let channelId: string | null = null;
    switch (logType) {
      case 'mod':
        channelId = config.modLogChannelId;
        break;
      case 'message':
        channelId = config.messageLogChannelId;
        break;
      case 'joinleave':
        channelId = config.joinLeaveLogChannelId;
        break;
    }

    if (!channelId) return;

    try {
      const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    } catch {}
  }

  // ─── Moderation Logs ──────────────────────────────────────────

  public static async logInfraction(
    guild: Guild,
    moderator: User,
    target: User,
    type: InfractionType,
    reason: string,
    duration?: string,
    infractionId?: string
  ): Promise<void> {
    const typeLabels: Record<string, string> = {
      WARN: '⚠️ Warning',
      MUTE: '🔇 Mute',
      KICK: '👢 Kick',
      BAN: '🔨 Ban',
      UNMUTE: '🔊 Unmute',
      UNBAN: '🔓 Unban'
    };

    const embed = new EmbedBuilder()
      .setColor(type === 'WARN' ? Colors.Warning : Colors.Moderation)
      .setTitle(`${typeLabels[type] || type}`)
      .addFields(
        { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.tag} (${moderator.id})`, inline: true },
        { name: 'Reason', value: reason || 'No reason provided' }
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    if (duration) {
      embed.addFields({ name: 'Duration', value: duration, inline: true });
    }

    if (infractionId) {
      embed.setFooter({ text: `Infraction ID: ${infractionId}` });
    }

    await this.sendLog(guild, 'mod', embed);
  }

  // ─── Message Logs ─────────────────────────────────────────────

  public static async logMessageDelete(message: Message | PartialMessage): Promise<void> {
    if (!message.guild || message.author?.bot) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Error)
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: 'Author', value: `${message.author?.tag || 'Unknown'} (${message.author?.id || 'N/A'})`, inline: true },
        { name: 'Channel', value: `<#${message.channelId}>`, inline: true }
      )
      .setTimestamp();

    if (message.content) {
      embed.addFields({
        name: 'Content',
        value: message.content.length > 1024
          ? message.content.slice(0, 1021) + '...'
          : message.content
      });
    }

    if (message.attachments.size > 0) {
      embed.addFields({
        name: 'Attachments',
        value: message.attachments.map(a => a.name || a.url).join('\n')
      });
    }

    await this.sendLog(message.guild, 'message', embed);
  }

  public static async logMessageEdit(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
  ): Promise<void> {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.Info)
      .setTitle('✏️ Message Edited')
      .addFields(
        { name: 'Author', value: `${newMessage.author?.tag || 'Unknown'} (${newMessage.author?.id || 'N/A'})`, inline: true },
        { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
        {
          name: 'Before',
          value: (oldMessage.content || '*No content cached*').slice(0, 1024)
        },
        {
          name: 'After',
          value: (newMessage.content || '*Empty*').slice(0, 1024)
        }
      )
      .setTimestamp();

    await this.sendLog(newMessage.guild, 'message', embed);
  }

  // ─── Join / Leave Logs ────────────────────────────────────────

  public static async logMemberJoin(member: GuildMember, riskScore?: number, riskFactors?: string[]): Promise<void> {
    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

    const embed = new EmbedBuilder()
      .setColor(Colors.Success)
      .setTitle('📥 Member Joined')
      .addFields(
        { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
        { name: 'Account Age', value: `${accountAgeDays} days`, inline: true },
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    if (riskScore !== undefined && riskScore > 0) {
      embed.addFields({
        name: '⚠️ Risk Score',
        value: `**${riskScore}**\n${riskFactors?.join('\n') || ''}`,
        inline: false
      });
    }

    await this.sendLog(member.guild, 'joinleave', embed);
  }

  public static async logMemberLeave(member: GuildMember): Promise<void> {
    const roles = member.roles.cache
      .filter(r => r.id !== member.guild.id)
      .map(r => r.name)
      .join(', ') || 'None';

    const embed = new EmbedBuilder()
      .setColor(Colors.Error)
      .setTitle('📤 Member Left')
      .addFields(
        { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
        { name: 'Roles', value: roles.slice(0, 1024), inline: false },
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    await this.sendLog(member.guild, 'joinleave', embed);
  }

  // ─── Security Logs ────────────────────────────────────────────

  public static async logSecurityEvent(guild: Guild, title: string, description: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(Colors.Security)
      .setTitle(`🔐 ${title}`)
      .setDescription(description)
      .setTimestamp();

    await this.sendLog(guild, 'mod', embed);
  }
}
