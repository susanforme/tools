const SHARE_KEY_MATERIAL = 'dev-tools-totp-share-v1';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function deriveKey(salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SHARE_KEY_MATERIAL),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptTotpSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await deriveKey(salt),
      encoder.encode(secret),
    ),
  );
  const payload = new Uint8Array(salt.length + iv.length + encrypted.length);
  payload.set(salt);
  payload.set(iv, salt.length);
  payload.set(encrypted, salt.length + iv.length);
  return `v1.${toBase64Url(payload)}`;
}

export async function decryptTotpSecret(value: string): Promise<string> {
  if (!value.startsWith('v1.')) throw new Error('Unsupported share format');
  const payload = fromBase64Url(value.slice(3));
  if (payload.length <= SALT_LENGTH + IV_LENGTH) {
    throw new Error('Invalid share payload');
  }
  const salt = payload.slice(0, SALT_LENGTH);
  const iv = payload.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = payload.slice(SALT_LENGTH + IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    await deriveKey(salt),
    encrypted,
  );
  return decoder.decode(decrypted);
}
