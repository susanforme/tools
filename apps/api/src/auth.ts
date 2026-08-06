const PASSWORD_ITERATIONS = 100_000;
const LEGACY_PASSWORD_ITERATIONS = 600_000;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_SCHEME = 'pbkdf2-sha256';

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error('Invalid hex value');
  }

  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

export function randomToken(bytes = 32): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function derivePassword(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    key,
    PASSWORD_KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return {
    hash: bytesToHex(hash),
    salt: `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${bytesToHex(salt)}`,
  };
}

function passwordParameters(storedSalt: string): {
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
} {
  const [scheme, iterations, encodedSalt] = storedSalt.split('$');
  if (scheme === PASSWORD_SCHEME && iterations && encodedSalt) {
    const parsedIterations = Number(iterations);
    if (parsedIterations !== PASSWORD_ITERATIONS) {
      throw new Error('Unsupported password parameters');
    }
    return { iterations: parsedIterations, salt: hexToBytes(encodedSalt) };
  }
  return {
    iterations: LEGACY_PASSWORD_ITERATIONS,
    salt: hexToBytes(storedSalt),
  };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
): Promise<boolean> {
  const parameters = passwordParameters(salt);
  const actual = await derivePassword(
    password,
    parameters.salt,
    parameters.iterations,
  );
  const expected = hexToBytes(expectedHash);

  if (actual.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return bytesToHex(new Uint8Array(digest));
}
