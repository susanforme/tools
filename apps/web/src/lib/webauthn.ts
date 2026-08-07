export function toBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='),
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomBase64Url(length = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(length)));
}

export function parseAuthenticatorData(value: ArrayBuffer): {
  rpIdHash: string;
  flags: string[];
  signCount: number;
} {
  const bytes = new Uint8Array(value);
  if (bytes.length < 37) throw new Error('认证器数据长度不足');
  const flagValue = bytes[32] ?? 0;
  const names: Array<[number, string]> = [
    [0x01, 'UP'],
    [0x04, 'UV'],
    [0x08, 'BE'],
    [0x10, 'BS'],
    [0x40, 'AT'],
    [0x80, 'ED'],
  ];
  return {
    rpIdHash: [...bytes.slice(0, 32)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
    flags: names.filter(([mask]) => flagValue & mask).map(([, name]) => name),
    signCount: new DataView(value).getUint32(33, false),
  };
}

export function decodeClientData(value: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder().decode(value));
}
