import { Listener } from '@sapphire/framework';
import { Events, type Message, type PartialMessage } from 'discord.js';
import { LoggingService } from '../modules/logging/LoggingService';

export class MessageDeleteListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageDelete
    });
  }

  public override async run(message: Message | PartialMessage) {
    if (!message.guild || message.author?.bot) return;
    await LoggingService.logMessageDelete(message);
  }
}
