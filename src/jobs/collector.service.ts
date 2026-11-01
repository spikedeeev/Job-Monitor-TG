import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Api, TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { StringSession } from 'telegram/sessions';
import { config } from '../config';
import { PipelineService } from './pipeline.service';

const BACKFILL_LIMIT = 30;

@Injectable()
export class CollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CollectorService.name);
  private client?: TelegramClient;

  constructor(private readonly pipeline: PipelineService) {}

  async onModuleInit() {
    if (!config.apiId || !config.apiHash || !config.session) {
      this.log.warn('TG_API_ID / TG_API_HASH / TG_SESSION missing - collector disabled (run `npm run login`)');
      return;
    }
    this.client = new TelegramClient(new StringSession(config.session), config.apiId, config.apiHash, {
      connectionRetries: 5,
    });
    await this.client.connect();

    const entities: Api.Channel[] = [];
    for (const name of config.channels) {
      try {
        const e = await this.client.getEntity(name);
        if (e instanceof Api.Channel) entities.push(e);
        else this.log.warn(`${name} is not a channel - skipped`);
      } catch (err) {
        this.log.warn(`cannot resolve ${name}: ${(err as Error).message}`);
      }
    }
    const byId = new Map(entities.map((e) => [e.id.toString(), e]));

    // Backfill recent posts (dedup in the pipeline makes restarts safe)
    for (const e of entities) {
      const msgs = await this.client.getMessages(e, { limit: BACKFILL_LIMIT });
      for (const m of msgs) await this.push(e.username ?? String(e.id), m);
    }

    this.client.addEventHandler(
      async (ev: NewMessageEvent) => {
        const id = ev.message.peerId instanceof Api.PeerChannel ? ev.message.peerId.channelId.toString() : '';
        const e = byId.get(id);
        if (e) await this.push(e.username ?? String(e.id), ev.message);
      },
      new NewMessage({ chats: entities.map((e) => e.id) }),
    );
    this.log.log(`Monitoring ${entities.length} channel(s)`);
  }

  private async push(channel: string, m: Api.Message) {
    if (!m.message?.trim()) return;
    await this.pipeline.enqueue({
      channel,
      messageId: m.id,
      text: m.message,
      date: new Date(m.date * 1000).toISOString(),
    });
  }

  async onModuleDestroy() {
    await this.client?.disconnect();
  }
}
