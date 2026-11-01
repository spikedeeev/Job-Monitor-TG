import { readFileSync, statSync } from 'fs';
import * as path from 'path';
import { config } from '../config';

export interface ScoreResult {
  score: number;
  tags: string[];
  payment: string;
  excluded: boolean;
  reason?: 'seeker' | 'foreign';
}

interface Compiled {
  rules: { tag: string; weight: number; re: RegExp }[];
  coreTags: string[];
  stackTags: string[];
  workType: { tag: string; bonus: number; re: RegExp };
  crypto: { tag: string; bonus: number; payment: string; re: RegExp };
  negotiable: { payment: string; re: RegExp };
  noCoreCap: number;
  foreign: { penaltyEach: number; maxPenalty: number; res: RegExp[] };
  penalties: { penalty: number; re: RegExp }[];
  seeker: { re: RegExp; hiring: RegExp };
}

// Lookarounds act as word boundaries for both Latin and Cyrillic text; \w is ASCII-only, so it is expanded
const w = (parts: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|').replace(/\\w/g, '[\\p{L}\\p{N}_]')})(?![\\p{L}\\p{N}])`, 'iu');

const fail = (msg: string): never => {
  throw new Error(`profile: ${msg}`);
};
const strings = (v: any, name: string): string[] =>
  Array.isArray(v) && v.length && v.every((x) => typeof x === 'string') ? v : fail(`"${name}" must be a non-empty array of strings`);
const num = (v: any, name: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(`"${name}" must be a number`));
const str = (v: any, name: string): string => (typeof v === 'string' && v ? v : fail(`"${name}" must be a non-empty string`));
const obj = (v: any, name: string): any => (v && typeof v === 'object' ? v : fail(`"${name}" is required`));

function compile(raw: any): Compiled {
  obj(raw, 'root');
  if (!Array.isArray(raw.rules) || !raw.rules.length) fail('"rules" must be a non-empty array');
  const workType = obj(raw.workType, 'workType');
  const crypto = obj(raw.crypto, 'crypto');
  const negotiable = obj(raw.negotiable, 'negotiable');
  const foreign = obj(raw.foreign, 'foreign');
  const seeker = obj(raw.seeker, 'seeker');
  return {
    rules: raw.rules.map((r: any, i: number) => ({
      tag: str(r.tag, `rules[${i}].tag`),
      weight: num(r.weight, `rules[${i}].weight`),
      re: w(strings(r.pattern, `rules[${i}].pattern`)),
    })),
    coreTags: strings(raw.coreTags, 'coreTags'),
    stackTags: strings(raw.stackTags, 'stackTags'),
    workType: { tag: str(workType.tag, 'workType.tag'), bonus: num(workType.bonus, 'workType.bonus'), re: w(strings(workType.pattern, 'workType.pattern')) },
    crypto: {
      tag: str(crypto.tag, 'crypto.tag'),
      bonus: num(crypto.bonus, 'crypto.bonus'),
      payment: str(crypto.payment, 'crypto.payment'),
      re: w(strings(crypto.pattern, 'crypto.pattern')),
    },
    negotiable: { payment: str(negotiable.payment, 'negotiable.payment'), re: w(strings(negotiable.pattern, 'negotiable.pattern')) },
    noCoreCap: num(raw.noCoreCap, 'noCoreCap'),
    foreign: {
      penaltyEach: num(foreign.penaltyEach, 'foreign.penaltyEach'),
      maxPenalty: num(foreign.maxPenalty, 'foreign.maxPenalty'),
      res: (foreign.pattern as any[]).map((x, i) => w(strings(Array.isArray(x) ? x : [x], `foreign.pattern[${i}]`))),
    },
    penalties: (raw.penalties ?? []).map((p: any, i: number) => ({
      penalty: num(p.penalty, `penalties[${i}].penalty`),
      re: w(strings(p.pattern, `penalties[${i}].pattern`)),
    })),
    seeker: { re: w(strings(seeker.pattern, 'seeker.pattern')), hiring: w(strings(seeker.hiringOverride, 'seeker.hiringOverride')) },
  };
}

let cache: { file: string; mtime: number; profile: Compiled } | undefined;

/** Loads profile.json and hot-reloads it when the file changes; a broken edit keeps the last good profile. */
export function getProfile(file = config.profilePath): Compiled {
  const abs = path.resolve(file);
  const mtime = statSync(abs).mtimeMs;
  if (cache && cache.file === abs && cache.mtime === mtime) return cache.profile;
  try {
    const profile = compile(JSON.parse(readFileSync(abs, 'utf8')));
    cache = { file: abs, mtime, profile };
    return profile;
  } catch (e) {
    if (cache && cache.file === abs) {
      console.warn(`[profile] ${(e as Error).message} - keeping previous version`);
      cache.mtime = mtime;
      return cache.profile;
    }
    throw e;
  }
}

export function scoreMessage(text: string, p: Compiled = getProfile()): ScoreResult {
  // Developers advertising themselves are not orders (unless the post also says they are hiring)
  if (p.seeker.re.test(text) && !p.seeker.hiring.test(text)) {
    return { score: 0, tags: [], payment: 'не указана', excluded: true, reason: 'seeker' };
  }

  const tags: string[] = [];
  let score = 0;
  for (const r of p.rules) {
    if (r.re.test(text)) {
      tags.push(r.tag);
      score += r.weight;
    }
  }

  if (!tags.some((t) => p.stackTags.includes(t))) {
    return { score: Math.min(score, 20), tags, payment: 'не указана', excluded: false };
  }

  if (p.workType.re.test(text)) {
    score += p.workType.bonus;
    tags.push(p.workType.tag);
  }
  let payment = 'не указана';
  if (p.crypto.re.test(text)) {
    score += p.crypto.bonus;
    tags.push(p.crypto.tag);
    payment = p.crypto.payment;
  } else if (p.negotiable.re.test(text)) {
    payment = p.negotiable.payment;
  }

  // Each foreign technology lowers the score; the post is hidden when no core technology is present
  // A foreign technology in the opening lines (the role itself) counts double
  const head = text.slice(0, 300);
  const foreignCount = p.foreign.res.reduce((n, re) => n + (re.test(text) ? 1 : 0) + (re.test(head) ? 1 : 0), 0);
  score -= Math.min(p.foreign.maxPenalty, foreignCount * p.foreign.penaltyEach);
  for (const pen of p.penalties) if (pen.re.test(text)) score -= pen.penalty;
  const hasCore = tags.some((t) => p.coreTags.includes(t));
  if (!hasCore) score = Math.min(score, p.noCoreCap);
  const foreign = foreignCount > 0;
  const excluded = foreign && !hasCore;

  return { score: Math.max(0, Math.min(100, score)), tags, payment, excluded, reason: excluded ? 'foreign' : undefined };
}
