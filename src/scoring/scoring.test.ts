import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreMessage } from './scoring';

test('fullstack Next.js/NestJS freelance scores high', () => {
  const r = scoreMessage('Ищем Fullstack разработчика: Next.js, NestJS, PostgreSQL. Фриланс, оплата USDT');
  assert.ok(r.score >= 80, String(r.score));
  assert.ok(r.tags.includes('NestJS') && r.tags.includes('Crypto'));
});

test('missing payment is not penalised', () => {
  const r = scoreMessage('Need React developer for a project');
  assert.ok(r.score >= 30, String(r.score));
  assert.equal(r.payment, 'не указана');
});

test('unrelated stack scores low', () => {
  const r = scoreMessage('Требуется PHP Laravel разработчик');
  assert.ok(r.score < 40);
});

test('"ts" and "js" do not match inside words', () => {
  assert.equal(scoreMessage('adjusts results').tags.length, 0);
});

test('developer looking for work is excluded', () => {
  assert.equal(scoreMessage('React dev ищет заказы. Next.js, NestJS').excluded, true);
  assert.equal(scoreMessage('Fullstack developer, looking for work. Моё резюме: ...').reason, 'seeker');
});

test('staff-job posts score below freelance ones', () => {
  const staff = scoreMessage('Frontend-разработчик (React/Typescript). Полная занятость, график 5/2, гибрид (Казань)');
  const free = scoreMessage('Frontend-разработчик (React/Typescript) на проект, фриланс');
  assert.ok(staff.score < 45, String(staff.score));
  assert.ok(free.score >= 45, String(free.score));
});

test('hiring post mentioning resume is not excluded', () => {
  const r = scoreMessage('Ищем React разработчика на проект, присылайте резюме');
  assert.equal(r.excluded, false);
  assert.ok(r.score >= 30);
});

test('third-person "looking for new opportunities" is a seeker post', () => {
  const r = scoreMessage('My friend is looking for new opportunities as a Frontend Developer. React, Next.js, NestJS');
  assert.equal(r.reason, 'seeker');
});

test('python-first fullstack scores below the notification threshold', () => {
  const r = scoreMessage('Full Stack Engineer (Python / React), Python + FastAPI, PostgreSQL, Redis, AWS');
  assert.ok(r.score < 45, String(r.score));
});

test('Vue/Angular-only posts are excluded, no core tech', () => {
  assert.equal(scoreMessage('Frontend developer: Vue.js, TypeScript, Pinia, проект').excluded, true);
  assert.ok(scoreMessage('Ищем Angular разработчика, TypeScript, RxJS').score < 45);
});

test('posts without core tech are capped below threshold', () => {
  assert.ok(scoreMessage('Нужен фронтенд разработчик: HTML, CSS, JavaScript, TypeScript на проект').score < 45);
});

test('Web3 + React + Node post scores high', () => {
  const r = scoreMessage('Нужен разработчик dApp: React, wagmi, ethers.js, Node.js, Prisma, PostgreSQL. Проект, оплата USDT');
  assert.ok(r.score >= 80, String(r.score));
  assert.ok(r.tags.includes('Web3'));
});

