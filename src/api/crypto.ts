const SECRET = import.meta.env.VITE_HMAC_SECRET ?? '';

export async function generateToken(): Promise<string> {
  if (!crypto?.subtle) {
    throw new Error('Web Crypto unavailable — the app must be served over a secure context (localhost or HTTPS).');
  }
  const window = Math.floor(Date.now() / 30000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(window)));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
