import { Listener } from '@sapphire/framework';
import { Events, type GuildMember } from 'discord.js';
import { SecurityService } from '../modules/security/SecurityService';
import { RoleService } from '../modules/roles/RoleService';
import { LoggingService } from '../modules/logging/LoggingService';
import { getGuildConfig } from '../lib/utils';

export class GuildMemberAddListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildMemberAdd
    });
  }

  public override async run(member: GuildMember) {
    const config = await getGuildConfig(member.guild.id);

    // 1. Anti-raid: Assess risk score
    let riskAssessment = { score: 0, factors: [] as string[] };
    if (config.antiRaidEnabled) {
      riskAssessment = await SecurityService.assessRisk(member);

      // Check if Beast Mode should activate
      if (riskAssessment.score > 0) {
        const shouldActivate = await SecurityService.shouldActivateBeastMode(
          member.guild.id,
          riskAssessment.score
        );

        if (shouldActivate) {
          await SecurityService.activateBeastMode(member.guild);
          await LoggingService.logSecurityEvent(
            member.guild,
            'Beast Mode Activated (Auto)',
            `🚨 Anti-raid threshold breached!\nTriggered by: ${member.user.tag}\nRisk Score: ${riskAssessment.score}\nFactors: ${riskAssessment.factors.join(', ')}`
          );
        }
      }
    }

    // 2. Auto-role assignment (skip if beast mode is active)
    if (!config.beastModeActive) {
      await RoleService.assignAutoRoles(member);
    }

    // 3. Log the join event
    await LoggingService.logMemberJoin(member, riskAssessment.score, riskAssessment.factors);
  }
}
