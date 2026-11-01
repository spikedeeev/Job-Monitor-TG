import { createHash } from 'crypto';

/** Hash of the normalized text: identical reposts across channels collapse into one job. */
export function contentHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/https?:\/\/\S+|(?:t|telegram)\.me\/\S+/g, ' ')
    .replace(/@\w+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return createHash('sha256').update(normalized).digest('hex');
}
