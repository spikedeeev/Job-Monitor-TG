import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContact } from './contact';
import { contentHash } from './dedupe';

test('reposts with different links/mentions/formatting share a hash', () => {
  const a = contentHash('Ищем React-разработчика!\nОплата USDT. Писать @hr_boss\nhttps://t.me/chan_a/10');
  const b = contentHash('ищем react разработчика оплата usdt писать @other_hr  https://t.me/chan_b/77');
  assert.equal(a, b);
  assert.notEqual(a, contentHash('Ищем NestJS разработчика'));
});

test('extracts @username, t.me link and email, skipping channel and bots', () => {
  assert.equal(extractContact('Писать: @hr_boss', 'needdev'), '@hr_boss');
  assert.equal(extractContact('Контакт https://t.me/hr_boss', 'needdev'), '@hr_boss');
  assert.equal(extractContact('Пост https://t.me/needdev/123 пишите @needdev', 'needdev'), null);
  assert.equal(extractContact('Бот @apply_bot', 'x'), null);
  assert.equal(extractContact('mail: hr@company.com', 'x'), 'hr@company.com');
});
