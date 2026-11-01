const HANDLE = /(?<![\w@.\/])@([A-Za-z][A-Za-z0-9_]{4,31})(?![\w@])/g;
const TME_LINK = /(?:https?:\/\/)?(?:t|telegram)\.me\/([A-Za-z][A-Za-z0-9_]{4,31})(?![\w\/])/gi;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

/** Returns "@username" or an email; the source channel itself is not a contact. */
export function extractContact(text: string, channel = ''): string | null {
  const own = channel.toLowerCase();
  const usernames = [
    ...Array.from(text.matchAll(HANDLE), (m) => m[1]),
    ...Array.from(text.matchAll(TME_LINK), (m) => m[1]),
  ];
  for (const u of usernames) {
    const l = u.toLowerCase();
    if (l !== own && l !== 'joinchat' && !l.endsWith('bot')) return `@${u}`;
  }
  return text.match(EMAIL)?.[0] ?? null;
}
