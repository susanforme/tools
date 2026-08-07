function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded =
    value.replaceAll('-', '+').replaceAll('_', '/') +
    '==='.slice(0, (4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hashForAlg(alg: string): string {
  if (alg.endsWith('384')) return 'SHA-384';
  if (alg.endsWith('512')) return 'SHA-512';
  return 'SHA-256';
}

function importAlgorithm(
  jwk: PublicJwk,
  alg: string,
): RsaHashedImportParams | EcKeyImportParams | AlgorithmIdentifier {
  if (jwk.kty === 'RSA') {
    return {
      name: alg.startsWith('PS') ? 'RSA-PSS' : 'RSASSA-PKCS1-v1_5',
      hash: hashForAlg(alg),
    };
  }
  if (jwk.kty === 'EC')
    return { name: 'ECDSA', namedCurve: jwk.crv ?? 'P-256' };
  if (jwk.kty === 'OKP' && jwk.crv === 'Ed25519') return 'Ed25519';
  throw new Error('UNSUPPORTED_JWK');
}

export function jwkInfo(jwk: PublicJwk): Record<string, string> {
  return Object.fromEntries(
    [
      ['kty', jwk.kty],
      ['kid', jwk.kid],
      ['alg', jwk.alg],
      ['use', jwk.use],
      ['curve', jwk.crv],
      ['key operations', jwk.key_ops?.join(', ')],
      [
        'RSA modulus bits',
        jwk.n ? String(base64UrlBytes(jwk.n).byteLength * 8) : undefined,
      ],
    ].filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export async function jwkToPem(jwk: PublicJwk): Promise<string> {
  const algorithm = importAlgorithm(
    jwk,
    jwk.alg ?? (jwk.kty === 'EC' ? 'ES256' : 'RS256'),
  );
  const key = await crypto.subtle.importKey('jwk', jwk, algorithm, true, [
    'verify',
  ]);
  const spki = await crypto.subtle.exportKey('spki', key);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(spki)));
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

export async function verifyJwtWithJwk(
  token: string,
  jwk: PublicJwk,
): Promise<boolean> {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('INVALID_JWT');
  const header = JSON.parse(
    new TextDecoder().decode(base64UrlBytes(parts[0])),
  ) as { alg?: string };
  const alg = header.alg ?? jwk.alg;
  if (!alg || alg === 'none') throw new Error('UNSUPPORTED_ALGORITHM');
  const algorithm = importAlgorithm(jwk, alg);
  const key = await crypto.subtle.importKey('jwk', jwk, algorithm, false, [
    'verify',
  ]);
  const verifyAlgorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams =
    alg.startsWith('PS')
      ? { name: 'RSA-PSS', saltLength: Number(hashForAlg(alg).slice(4)) / 8 }
      : alg.startsWith('ES')
        ? { name: 'ECDSA', hash: hashForAlg(alg) }
        : algorithm;
  return crypto.subtle.verify(
    verifyAlgorithm,
    key,
    base64UrlBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
}
export type PublicJwk = JsonWebKey & { kid?: string };
