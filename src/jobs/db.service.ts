import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from '../config';

export interface JobRow {
  id: number;
  channel: string;
  message_id: number;
  title: string;
  text: string;
  link: string;
  score: number;
  tags: string[];
  payment: string;
  posted_at: Date;
  notified: boolean;
  content_hash: string;
  contact: string | null;
}

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({ connectionString: config.databaseUrl });

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        channel TEXT NOT NULL,
        message_id BIGINT NOT NULL,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        link TEXT NOT NULL,
        score INT NOT NULL,
        tags TEXT[] NOT NULL DEFAULT '{}',
        payment TEXT NOT NULL,
        posted_at TIMESTAMPTZ NOT NULL,
        notified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (channel, message_id)
      );
      CREATE INDEX IF NOT EXISTS jobs_score_idx ON jobs (score DESC, posted_at DESC);
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS content_hash TEXT;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS jobs_content_hash_idx ON jobs (content_hash);
    `);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /** Returns the row only if it was newly inserted (dedupes by channel+message and by content hash). */
  async insertJob(j: Omit<JobRow, 'id' | 'notified'>): Promise<JobRow | null> {
    const { rows } = await this.pool.query<JobRow>(
      `INSERT INTO jobs (channel, message_id, title, text, link, score, tags, payment, posted_at, content_hash, contact)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [j.channel, j.message_id, j.title, j.text, j.link, j.score, j.tags, j.payment, j.posted_at, j.content_hash, j.contact],
    );
    return rows[0] ?? null;
  }

  async existsByHash(hash: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('SELECT 1 FROM jobs WHERE content_hash = $1', [hash]);
    return (rowCount ?? 0) > 0;
  }

  async markNotified(id: number) {
    await this.pool.query('UPDATE jobs SET notified = TRUE WHERE id = $1', [id]);
  }

  async list(minScore: number, limit: number): Promise<JobRow[]> {
    const { rows } = await this.pool.query<JobRow>(
      'SELECT * FROM jobs WHERE score >= $1 ORDER BY posted_at DESC LIMIT $2',
      [minScore, limit],
    );
    return rows;
  }
}
