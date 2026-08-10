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
  const isPrivate = typeof jwk.d === 'string';
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    algorithm,
    true,
    isPrivate ? ['sign'] : ['verify'],
  );
  const data = await crypto.subtle.exportKey(isPrivate ? 'pkcs8' : 'spki', key);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  const lines = base64.match(/.{1,64}/g) ?? [];
  const type = isPrivate ? 'PRIVATE KEY' : 'PUBLIC KEY';
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
}

export async function pemToJwk(pem: string): Promise<PublicJwk> {
  const match = pem.match(
    /-----BEGIN (PUBLIC|PRIVATE) KEY-----([\s\S]+?)-----END \1 KEY-----/,
  );
  if (!match) throw new Error('UNSUPPORTED_PEM');
  const binary = atob(match[2].replace(/\s/g, ''));
  const data = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const isPrivate = match[1] === 'PRIVATE';
  const algorithms: Array<
    RsaHashedImportParams | EcKeyImportParams | AlgorithmIdentifier
  > = [
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    { name: 'ECDSA', namedCurve: 'P-256' },
    { name: 'ECDSA', namedCurve: 'P-384' },
    { name: 'ECDSA', namedCurve: 'P-521' },
    'Ed25519',
  ];
  for (const algorithm of algorithms) {
    try {
      const key = await crypto.subtle.importKey(
        isPrivate ? 'pkcs8' : 'spki',
        data,
        algorithm,
        true,
        isPrivate ? ['sign'] : ['verify'],
      );
      return (await crypto.subtle.exportKey('jwk', key)) as PublicJwk;
    } catch {
      // 尝试下一种浏览器支持的公钥算法。
    }
  }
  throw new Error('UNSUPPORTED_KEY');
}

export type KeyPairType = 'RSA' | 'P-256' | 'P-384' | 'P-521' | 'Ed25519';

export type GeneratedKeyPair = {
  publicJwk: PublicJwk;
  privateJwk: PublicJwk;
  publicPem: string;
  privatePem: string;
};

export async function generateKeyPair(
  type: KeyPairType,
): Promise<GeneratedKeyPair> {
  const algorithm:
    | RsaHashedKeyGenParams
    | EcKeyGenParams
    | AlgorithmIdentifier =
    type === 'RSA'
      ? {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        }
      : type === 'Ed25519'
        ? 'Ed25519'
        : { name: 'ECDSA', namedCurve: type };
  const pair = (await crypto.subtle.generateKey(algorithm, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const publicJwk = (await crypto.subtle.exportKey(
    'jwk',
    pair.publicKey,
  )) as PublicJwk;
  const privateJwk = (await crypto.subtle.exportKey(
    'jwk',
    pair.privateKey,
  )) as PublicJwk;
  return {
    publicJwk,
    privateJwk,
    publicPem: await jwkToPem(publicJwk),
    privatePem: await jwkToPem(privateJwk),
  };
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
