import { Command, Args } from '@sapphire/framework';
import { PermissionFlagsBits, type Message } from 'discord.js';
import { successEmbed, errorEmbed } from '../../lib/utils';

export class MoveCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'mv',
      aliases: ['drag', 'move', 'vcmove'],
      description: 'Move/drag a user to your current voice channel',
      requiredUserPermissions: [PermissionFlagsBits.MoveMembers]
    });
  }

  // ─── Prefix command: !mv @user ─────────────────────────────────
  public override async messageRun(message: Message, args: Args) {
    if (!message.guild || !message.member) return;

    // Parse the target user
    const targetUser = await args.pick('member').catch(() => null);
    if (!targetUser) {
      return message.reply({
        embeds: [errorEmbed('Error', 'Please mention a user to move.\n**Usage:** `!mv @user`')]
      });
    }

    // Check if the moderator is in a voice channel
    const modVoice = message.member.voice.channel;
    if (!modVoice) {
      return message.reply({
        embeds: [errorEmbed('Error', 'You must be in a voice channel to use this command.')]
      });
    }

    // Check if the target is in a voice channel
    if (!targetUser.voice.channel) {
      return message.reply({
        embeds: [errorEmbed('Error', `**${targetUser.displayName}** is not in a voice channel.`)]
      });
    }

    // Already in the same channel?
    if (targetUser.voice.channelId === modVoice.id) {
      return message.reply({
        embeds: [errorEmbed('Error', `**${targetUser.displayName}** is already in your voice channel.`)]
      });
    }

    // Move the user
    try {
      await targetUser.voice.setChannel(modVoice, `Moved by ${message.author.tag}`);
      return message.reply({
        embeds: [successEmbed('User Moved', `🔊 **${targetUser.displayName}** has been moved to **${modVoice.name}**`)]
      });
    } catch {
      return message.reply({
        embeds: [errorEmbed('Error', `Failed to move **${targetUser.displayName}**. Check my permissions and role hierarchy.`)]
      });
    }
  }

  // ─── Slash command: /mv ────────────────────────────────────────
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('mv')
        .setDescription('Move/drag a user to your current voice channel')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user to move').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const guild = interaction.guild!;
    const member = await guild.members.fetch(interaction.user.id);

    // Check mod is in VC
    const modVoice = member.voice.channel;
    if (!modVoice) {
      return interaction.reply({
        embeds: [errorEmbed('Error', 'You must be in a voice channel to use this command.')],
        ephemeral: true
      });
    }

    // Fetch target member
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        embeds: [errorEmbed('Error', 'User not found in this server.')],
        ephemeral: true
      });
    }

    if (!targetMember.voice.channel) {
      return interaction.reply({
        embeds: [errorEmbed('Error', `**${targetMember.displayName}** is not in a voice channel.`)],
        ephemeral: true
      });
    }

    if (targetMember.voice.channelId === modVoice.id) {
      return interaction.reply({
        embeds: [errorEmbed('Error', `**${targetMember.displayName}** is already in your voice channel.`)],
        ephemeral: true
      });
    }

    try {
      await targetMember.voice.setChannel(modVoice, `Moved by ${interaction.user.tag}`);
      return interaction.reply({
        embeds: [successEmbed('User Moved', `🔊 **${targetMember.displayName}** has been moved to **${modVoice.name}**`)]
      });
    } catch {
      return interaction.reply({
        embeds: [errorEmbed('Error', `Failed to move **${targetMember.displayName}**. Check my permissions and role hierarchy.`)],
        ephemeral: true
      });
    }
  }
}
