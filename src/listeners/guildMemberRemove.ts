import { Listener } from '@sapphire/framework';
import { Events, type GuildMember } from 'discord.js';
import { LoggingService } from '../modules/logging/LoggingService';

export class GuildMemberRemoveListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.GuildMemberRemove
    });
  }

  public override async run(member: GuildMember) {
    await LoggingService.logMemberLeave(member);
  }
}
