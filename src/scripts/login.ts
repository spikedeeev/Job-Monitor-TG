import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline/promises';

async function main() {
  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH ?? '';
  if (!apiId || !apiHash) throw new Error('Set TG_API_ID and TG_API_HASH in .env first');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: () => rl.question('Phone (+...): '),
    phoneCode: () => rl.question('Code: '),
    password: () => rl.question('2FA password (if any): '),
    onError: (e) => console.error(e),
  });
  console.log('\nPut this into .env as TG_SESSION (keep it private):\n');
  console.log(client.session.save());
  rl.close();
  await client.disconnect();
  process.exit(0);
}
main();
