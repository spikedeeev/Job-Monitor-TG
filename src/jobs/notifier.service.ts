import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';
import { JobRow } from './db.service';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

@Injectable()
export class NotifierService {
  private readonly log = new Logger(NotifierService.name);

  async send(job: JobRow, summary?: string): Promise<boolean> {
    if (!config.botToken || !config.ownerChatId) {
      this.log.warn('BOT_TOKEN / OWNER_CHAT_ID not set - notification skipped');
      return false;
    }
    const age = Math.max(0, Math.round((Date.now() - new Date(job.posted_at).getTime()) / 60000));
    const preview = esc(summary || job.text.replace(/\s+/g, ' ').slice(0, 400));
    const text = [
      '🔔 <b>Найден новый заказ</b>',
      `<b>${job.score}% совпадение</b>`,
      '',
      `<b>${esc(job.title)}</b>`,
      `Канал: ${esc(job.channel)} · ${age} мин. назад`,
      '',
      preview,
      '',
      job.tags.map((t) => `#${t.replace(/[^\p{L}\p{N}]/gu, '')}`).join(' '),
      `💰 Оплата: ${esc(job.payment)}`,
      ...(job.contact ? [`👤 Контакт: ${esc(job.contact)}`] : []),
    ].join('\n');

    const buttons = [
      ...(job.contact?.startsWith('@') ? [{ text: '✉️ Написать', url: `https://t.me/${job.contact.slice(1)}` }] : []),
      { text: '🔗 Оригинал', url: job.link },
    ];

    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.ownerChatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: [buttons] },
      }),
    });
    if (!res.ok) {
      this.log.error(`sendMessage failed: HTTP ${res.status}`);
      return false;
    }
    return true;
  }
}
