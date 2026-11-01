import { Pool } from 'pg';
import { config } from '../config';
import { scoreMessage } from '../scoring/scoring';

// Re-scores saved posts with the current profile.json (read-only)
async function main() {
  const pool = new Pool({ connectionString: config.databaseUrl });
  const { rows } = await pool.query('SELECT title, text, score FROM jobs ORDER BY created_at DESC');
  let keep = 0;
  for (const r of rows) {
    const s = scoreMessage(r.text);
    const pass = !s.excluded && s.score >= config.minScore;
    if (pass) keep++;
    console.log(`${pass ? 'KEEP' : 'DROP'} ${String(r.score).padStart(3)} -> ${String(s.score).padStart(3)} ${s.reason ?? ''} | ${r.title.replace(/\s+/g, ' ').slice(0, 50)} | ${s.tags.join(',')}`);
  }
  console.log(`\nkept ${keep} of ${rows.length}`);
  await pool.end();
}
main();
