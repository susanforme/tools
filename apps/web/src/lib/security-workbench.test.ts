import { describe, expect, it } from 'vitest';
import { readDmarcFile } from './dmarc-report';
import {
  inspectJwe,
  inspectPfx,
  processJwe,
  processOpenPgp,
  processPaseto,
} from './security-workbench';

describe('token cryptography', () => {
  it('round-trips JWE and rejects wrong keys, tampering and invalid key input', async () => {
    const encrypted = await processJwe(
      '中文 secret',
      '12'.repeat(32),
      'encrypt',
    );
    expect('token' in encrypted).toBe(true);
    if (typeof encrypted.token !== 'string') throw new Error('missing token');
    expect(Object.keys(inspectJwe(encrypted.token))).toHaveLength(5);
    expect(
      await processJwe(encrypted.token, '12'.repeat(32), 'decrypt'),
    ).toMatchObject({ plaintext: '中文 secret' });
    await expect(
      processJwe(encrypted.token, '13'.repeat(32), 'decrypt'),
    ).rejects.toThrow();
    const parts = encrypted.token.split('.');
    parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
    await expect(
      processJwe(parts.join('.'), '12'.repeat(32), 'decrypt'),
    ).rejects.toThrow();
    await expect(processJwe('text', 'bad', 'encrypt')).rejects.toThrow();
  });
  it('round-trips both PASETO purposes with footer and enforces assertions and expiry', async () => {
    const paseto = await import('paseto-ts/v4');
    const local = paseto.generateKeys('local');
    const pair = paseto.generateKeys('public');
    const token = await processPaseto(
      '{"sub":"123"}',
      local,
      'encrypt',
      '{"context":"demo"}',
      'test',
    );
    expect(typeof token).toBe('string');
    if (typeof token !== 'string') throw new Error('token');
    expect(
      await processPaseto(token, local, 'decrypt', '', 'test'),
    ).toMatchObject({ payload: { sub: '123' }, footer: { context: 'demo' } });
    await expect(
      processPaseto(token, local, 'decrypt', '', 'wrong'),
    ).rejects.toThrow();
    await expect(
      processPaseto(token, paseto.generateKeys('local'), 'decrypt', '', 'test'),
    ).rejects.toThrow();
    const signed = await processPaseto(
      '{"sub":"123"}',
      pair.secretKey,
      'sign',
      '',
      '',
    );
    if (typeof signed !== 'string') throw new Error('token');
    expect(
      await processPaseto(signed, pair.publicKey, 'verify', '', ''),
    ).toMatchObject({ payload: { sub: '123' } });
    await expect(
      processPaseto(
        signed,
        paseto.generateKeys('public').publicKey,
        'verify',
        '',
        '',
      ),
    ).rejects.toThrow();
    const expired = await paseto.sign(
      pair.secretKey,
      { sub: '123', exp: '2000-01-01T00:00:00Z' },
      { addIat: false, addExp: false, validatePayload: false },
    );
    await expect(
      processPaseto(expired, pair.publicKey, 'verify', '', ''),
    ).rejects.toThrow();
  });
});

it('extracts password-protected PFX certificates without exporting private keys', async () => {
  const forge = (await import('node-forge')).default;
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const attrs = [{ name: 'commonName', value: 'test.example' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  const bundle = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [cert],
    'test-password',
  );
  const bytes = Uint8Array.from(forge.asn1.toDer(bundle).getBytes(), (char) =>
    char.charCodeAt(0),
  );
  const result = await inspectPfx(bytes, 'test-password');
  expect(result.privateKeyCount).toBe(1);
  expect(result.certificates[0].subject).toContain('test.example');
  expect(result.certificates[0].pem).toContain('BEGIN CERTIFICATE');
  expect(JSON.stringify(result)).not.toContain('PRIVATE KEY');
  await expect(inspectPfx(bytes, 'wrong')).rejects.toThrow();
});

it('encrypts binary OpenPGP files and verifies detached signatures strictly', async () => {
  const pgp = await import('openpgp');
  const keys = await pgp.generateKey({
    type: 'ecc',
    curve: 'curve25519Legacy',
    userIDs: [{ name: 'Test' }],
    passphrase: 'passphrase',
    format: 'armored',
  });
  const data = Uint8Array.from([0, 128, 255, 10, 42]);
  const encrypted = await processOpenPgp(
    'encrypt',
    data,
    keys.publicKey,
    '',
    '',
  );
  const decrypted = await processOpenPgp(
    'decrypt',
    new TextEncoder().encode(encrypted.text),
    keys.privateKey,
    'passphrase',
    '',
  );
  expect(decrypted.bytes).toEqual(data);
  await expect(
    processOpenPgp(
      'decrypt',
      new TextEncoder().encode(encrypted.text),
      keys.privateKey,
      'wrong',
      '',
    ),
  ).rejects.toThrow();
  const signed = await processOpenPgp(
    'sign',
    data,
    keys.privateKey,
    'passphrase',
    '',
  );
  expect(
    JSON.parse(
      (await processOpenPgp('verify', data, keys.publicKey, '', signed.text))
        .text,
    ).verified,
  ).toBe(true);
  await expect(
    processOpenPgp(
      'verify',
      new Uint8Array([1, 2]),
      keys.publicKey,
      '',
      signed.text,
    ),
  ).rejects.toThrow();
  const inspected = JSON.parse(
    (await processOpenPgp('inspect', data, keys.publicKey, '', '')).text,
  );
  expect(inspected.fingerprint).toBe(
    (await pgp.readKey({ armoredKey: keys.publicKey })).getFingerprint(),
  );
}, 20000);

it('loads gzip DMARC XML and rejects corrupt gzip', async () => {
  const xml = '<feedback>中文</feedback>';
  const compressed = await new Response(
    new Blob([xml]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  expect(await readDmarcFile(new File([compressed], 'report.xml.gz'))).toBe(
    xml,
  );
  await expect(
    readDmarcFile(new File([new Uint8Array([0x1f, 0x8b, 0])], 'broken.gz')),
  ).rejects.toThrow();
});
