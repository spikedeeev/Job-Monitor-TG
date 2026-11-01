import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { getProfile, scoreMessage } from '../scoring/scoring';
import { AiService } from './ai.service';
import { extractContact } from './contact';
import { DbService } from './db.service';
import { contentHash } from './dedupe';
import { NotifierService } from './notifier.service';

export interface RawMessage {
  channel: string;
  messageId: number;
  text: string;
  date: string;
}

const QUEUE = 'messages';

@Injectable()
export class PipelineService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PipelineService.name);
  private readonly connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  private queue = new Queue<RawMessage>(QUEUE, { connection: this.connection });
  private worker?: Worker<RawMessage>;

  constructor(
    private readonly db: DbService,
    private readonly ai: AiService,
    private readonly notifier: NotifierService,
  ) {}

  onModuleInit() {
    getProfile(); // fail fast on a broken profile.json
    this.worker = new Worker<RawMessage>(QUEUE, (job) => this.process(job.data), {
      connection: this.connection,
      concurrency: 2,
    });
    this.worker.on('failed', (job, err) => this.log.error(`job ${job?.id} failed: ${err.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue.close();
    this.connection.disconnect();
  }

  /** jobId only de-duplicates in-flight messages; persistent dedup is done by the DB. */
  async enqueue(msg: RawMessage) {
    await this.queue.add('process', msg, {
      jobId: `${msg.channel}-${msg.messageId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  private async process(msg: RawMessage) {
    const rule = scoreMessage(msg.text);
    if (rule.excluded || rule.score < Math.min(config.minScore, 30)) return;

    const hash = contentHash(msg.text);
    if (await this.db.existsByHash(hash)) return; // repost from another channel

    const ai = await this.ai.analyze(msg.text);
    const score = ai ? Math.round(rule.score * 0.4 + ai.score * 0.6) : rule.score;
    if (score < config.minScore) return;

    const firstLine = msg.text.split('\n').find((l) => l.trim())?.trim().slice(0, 120) ?? 'Заказ';
    const row = await this.db.insertJob({
      channel: msg.channel,
      message_id: msg.messageId,
      title: ai?.title || firstLine,
      text: msg.text,
      link: `https://t.me/${msg.channel}/${msg.messageId}`,
      score,
      tags: rule.tags,
      payment: ai?.payment || rule.payment,
      posted_at: new Date(msg.date),
      content_hash: hash,
      contact: extractContact(msg.text, msg.channel),
    });
    if (!row) return; // duplicate

    if (await this.notifier.send(row, ai?.summary)) await this.db.markNotified(row.id);
  }
}
