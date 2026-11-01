import 'dotenv/config';
import * as path from 'path';

const list = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))
    .filter(Boolean);

export const config = {
  apiId: Number(process.env.TG_API_ID ?? 0),
  apiHash: process.env.TG_API_HASH ?? '',
  session: process.env.TG_SESSION ?? '',
  channels: list(process.env.CHANNELS),
  botToken: process.env.BOT_TOKEN ?? '',
  ownerChatId: process.env.OWNER_CHAT_ID ?? '',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://jobbot:jobbot@localhost:5433/jobbot',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  profilePath: process.env.PROFILE_PATH || path.resolve(__dirname, '..', 'profile.json'),
  minScore: Number(process.env.MIN_SCORE ?? 40),
  openaiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  apiKey: process.env.API_KEY ?? '',
  port: Number(process.env.PORT ?? 3000),
};
