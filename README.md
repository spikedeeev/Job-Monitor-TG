# Telegram Job Bot

> Self-hosted Telegram job & freelance-gig monitor. Watches the channels you pick, scores every post against **your** tech stack, removes duplicates and résumés, and sends only the relevant offers to your own Telegram chat.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

Stop scrolling through dozens of job channels. Telegram Job Bot reads them for you (via MTProto, as your own account), keeps what matches your skills and pings you with a clean card, a match score, the author's contact and one-tap buttons.

```
🔔 Found a new job
92% match

Fullstack Developer — Next.js / NestJS
Channel: itfreelancers · 5 min ago

We are looking for a developer for a small SaaS project: user dashboard,
REST API and PostgreSQL integration.

#Nextjs #NestJS #PostgreSQL #Freelance
💰 Payment: negotiable
👤 Contact: @hiring_manager

[ ✉️ Write ]  [ 🔗 Original post ]
```

## Features

- **Real-time channel monitoring** – GramJS (MTProto) listens to public channels your account can read and backfills recent posts on start.
- **Stack-aware relevance score (0–100)** – weighted keywords, work-type and crypto-payment bonuses, plus penalties for foreign stacks (Python, Java, Vue, Angular, …).
- **Missing payment is never penalised** – many clients agree to USDT/crypto after a chat.
- **Résumé / "looking for work" filter** – posts from developers advertising themselves are dropped; vacancies that merely mention a résumé are kept.
- **Cross-channel de-duplication** – reposts of the same job are collapsed by a hash of the normalised text.
- **Contact extraction** – `@username`, `t.me` links or e-mail, shown as a button in the notification.
- **Fully configurable** – keywords, weights, stop-words and filters live in [`profile.json`](./profile.json) and are **hot-reloaded**, no restart needed. A broken edit keeps the last good profile.
- **Optional AI refinement** – OpenAI re-scores the post, writes a short summary and extracts requirements. Falls back to rules if the API fails. Post text is treated as untrusted input.
- **Reliable pipeline** – BullMQ (Redis) queue with retries, PostgreSQL storage with unique constraints.
- **REST API** – `GET /jobs` to browse everything that was found.
- **Tested** – unit tests for scoring, de-duplication and contact extraction.

## How it works

```
Telegram channels
      │  MTProto (GramJS, your account, read-only)
      ▼
  Collector ──► Redis queue (BullMQ) ──► Scoring (profile.json) ──► optional OpenAI
                                                                         │
                         Telegram Bot API ◄── PostgreSQL (dedupe) ◄──────┘
                         (notification to you)
```

## Tech stack

NestJS · TypeScript · GramJS (`telegram`) · BullMQ + Redis · PostgreSQL · Telegram Bot API · OpenAI API (optional) · Docker Compose

## Quick start

**Requirements:** Node.js 20+, Docker, a Telegram account.

```bash
git clone https://github.com/<your-username>/telegram-job-bot.git
cd telegram-job-bot
npm install
docker compose up -d        # PostgreSQL (localhost:5433) + Redis (localhost:6380)
cp .env.example .env        # Windows: copy .env.example .env
```

1. Get `TG_API_ID` and `TG_API_HASH` at <https://my.telegram.org> → *API development tools*.
2. Create a bot with [@BotFather](https://t.me/BotFather) → `BOT_TOKEN`. Open the bot and press **Start**.
3. Get your numeric chat id from [@userinfobot](https://t.me/userinfobot) → `OWNER_CHAT_ID`.
4. Log in once and store the session:
   ```bash
   npm run login
   ```
   Paste the printed string into `TG_SESSION`.
5. Set `CHANNELS` (usernames without `@`, comma separated). Your account must be able to read them.
6. Run:
   ```bash
   npm run dev                       # development
   npm run build && npm start        # production
   ```

> If ports 5433 / 6380 are taken on your machine, change them in `docker-compose.yml` and in `DATABASE_URL` / `REDIS_URL`.

## Configuration

### Environment variables (`.env`)

| Variable | Description | Default |
|---|---|---|
| `TG_API_ID`, `TG_API_HASH` | MTProto credentials from my.telegram.org | – |
| `TG_SESSION` | Session string from `npm run login` (**secret**) | – |
| `CHANNELS` | Channels to monitor, comma separated | – |
| `BOT_TOKEN` | Bot token from @BotFather | – |
| `OWNER_CHAT_ID` | Chat that receives notifications | – |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://jobbot:jobbot@localhost:5433/jobbot` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6380` |
| `MIN_SCORE` | Minimum score (0–100) to notify | `45` |
| `PROFILE_PATH` | Path to the scoring profile | `./profile.json` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Enable optional AI refinement | – / `gpt-4o-mini` |
| `API_KEY` | Protects `GET /jobs` (`x-api-key` header). Empty = localhost only | – |
| `PORT` | HTTP port | `3000` |

### Scoring profile (`profile.json`)

Everything about *what counts as a good job* is data, not code:

| Section | Purpose |
|---|---|
| `rules` | Technologies, their tags and weights (regular expressions, case-insensitive, Latin and Cyrillic aware) |
| `coreTags` / `stackTags` / `noCoreCap` | Technologies you really want; posts without a core one are capped below the threshold |
| `workType`, `crypto`, `negotiable` | Freelance / crypto bonuses and payment detection |
| `foreign` | Technologies you do **not** use; each one lowers the score (doubly if it appears in the first lines) |
| `penalties` | Extra penalties, e.g. full-time office roles, internships |
| `seeker` | Phrases that identify a candidate looking for work, and `hiringOverride` phrases that cancel it |

Edit the file while the bot is running – changes apply immediately.

### Tune it on real data

```bash
npm run rescore   # re-scores saved posts with the current profile (read-only)
```

## HTTP API

```
GET /jobs?minScore=60&limit=50
```

Returns stored jobs (channel, text, link, score, tags, payment, contact, date). Send `x-api-key` when `API_KEY` is set.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with ts-node |
| `npm run build` / `npm start` | Compile and run |
| `npm run login` | Create the MTProto session string |
| `npm run rescore` | Re-score stored posts with the current profile |
| `npm test` | Run unit tests |

## Security & responsible use

- `TG_SESSION` gives full access to your Telegram account. **Never commit or share it.** `.env` is git-ignored.
- The collector is **read-only** and uses your own account. Monitor only channels you are allowed to read, keep the channel list reasonable, and respect [Telegram's Terms of Service and API limits](https://core.telegram.org/api/terms).
- The regular Bot API cannot read arbitrary channels, which is why MTProto is used.
- Do not expose the HTTP API publicly without `API_KEY` and a reverse proxy with TLS.

## Roadmap

- [ ] Inline buttons: *Applied* / *Hide* / *Not interested* (feedback for the filter)
- [ ] Bot commands: `/stats`, `/last`, `/mute`, `/channels`
- [ ] Quiet hours and daily digest
- [ ] AI-generated reply draft for each job
- [ ] Retry of undelivered notifications
- [ ] Dockerfile for the bot itself

## Contributing

Issues and pull requests are welcome. Please run `npx tsc --noEmit` and `npm test` before opening a PR. Ideas for new filters, sources (LinkedIn, Discord, RSS) and profile presets for other stacks (Python, Go, mobile, DevOps…) are especially appreciated.

## License

[MIT](./LICENSE)

---

<sub>Keywords: telegram bot, job bot, job search automation, freelance jobs, remote jobs, telegram channel monitor, telegram scraper, MTProto, GramJS, NestJS, TypeScript, React, Next.js, job alerts, web3 jobs.</sub>
