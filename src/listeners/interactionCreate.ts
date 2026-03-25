import { Listener } from '@sapphire/framework';
import { Events, type Interaction } from 'discord.js';
import { RoleService } from '../modules/roles/RoleService';

export class InteractionCreateListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.InteractionCreate
    });
  }

  public override async run(interaction: Interaction) {
    // Only handle button interactions for role panels
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('role_panel:')) return;
    if (!interaction.guild || !interaction.member) return;

    const roleId = interaction.customId.replace('role_panel:', '');

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const result = await RoleService.toggleRole(member, roleId);

      await interaction.reply({
        content: result.added
          ? `✅ You now have the **${result.roleName}** role!`
          : `❌ The **${result.roleName}** role has been removed.`,
        ephemeral: true
      });
    } catch (error: any) {
      await interaction.reply({
        content: `⚠️ Could not toggle role: ${error.message}`,
        ephemeral: true
      }).catch(() => {});
    }
  }
}
