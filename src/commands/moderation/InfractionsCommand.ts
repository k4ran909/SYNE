import { Command } from '@sapphire/framework';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { ModerationService } from '../../modules/moderation/ModerationService';
import { Colors } from '../../lib/constants';

export class InfractionsCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: 'infractions',
      description: 'View a user\'s infraction history',
      requiredUserPermissions: [PermissionFlagsBits.ModerateMembers]
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('infractions')
        .setDescription('View a user\'s infraction history')
        .addUserOption((option) =>
          option.setName('user').setDescription('The user to check').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const guild = interaction.guild!;

    const infractions = await ModerationService.getHistory(guild.id, target.id);

    if (infractions.length === 0) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(Colors.Success)
          .setTitle(`📋 Infractions for ${target.tag}`)
          .setDescription('This user has no infractions. Clean record! ✨')
          .setThumbnail(target.displayAvatarURL())
          .setTimestamp()
        ],
        ephemeral: true
      });
    }

    const typeEmojis: Record<string, string> = {
      WARN: '⚠️',
      MUTE: '🔇',
      KICK: '👢',
      BAN: '🔨',
      UNMUTE: '🔊',
      UNBAN: '🔓'
    };

    const lines = infractions.map((inf: any, i: number) => {
      const emoji = typeEmojis[inf.type] || '📌';
      const date = inf.createdAt.toLocaleDateString();
      const status = inf.active ? '🔴 Active' : '⚪ Resolved';
      return `**${i + 1}.** ${emoji} **${inf.type}** — ${date}\n   Reason: ${inf.reason}\n   ${status} | ID: \`${inf.id.slice(0, 8)}\``;
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Moderation)
      .setTitle(`📋 Infractions for ${target.tag}`)
      .setDescription(lines.join('\n\n'))
      .setThumbnail(target.displayAvatarURL())
      .setFooter({ text: `Total: ${infractions.length} infractions` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
