export type TokenOperation = 'encrypt' | 'decrypt' | 'sign' | 'verify';

export async function processJwe(
  input: string,
  hexKey: string,
  operation: 'encrypt' | 'decrypt',
) {
  if (!/^[a-f\d]{64}$/i.test(hexKey.trim()))
    throw new Error('密钥须为 64 位十六进制（32 字节）');
  const key = Uint8Array.from(hexKey.trim().match(/../g)!, (part) =>
    parseInt(part, 16),
  );
  const jose = await import('jose');
  if (operation === 'encrypt') {
    const token = await new jose.CompactEncrypt(new TextEncoder().encode(input))
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .encrypt(key);
    return { token, parts: inspectJwe(token) };
  }
  const parts = inspectJwe(input.trim());
  const result = await jose.compactDecrypt(input.trim(), key, {
    keyManagementAlgorithms: ['dir'],
    contentEncryptionAlgorithms: ['A256GCM'],
  });
  return {
    plaintext: new TextDecoder('utf-8', { fatal: true }).decode(
      result.plaintext,
    ),
    header: result.protectedHeader,
    parts,
  };
}

export function inspectJwe(token: string) {
  const parts = token.split('.');
  if (
    parts.length !== 5 ||
    parts.some((part) => !/^[A-Za-z0-9_-]*$/.test(part))
  )
    throw new Error('JWE 应包含五段 Base64URL 数据');
  return {
    protectedHeader: parts[0],
    encryptedKey: parts[1],
    iv: parts[2],
    ciphertext: parts[3],
    authenticationTag: parts[4],
  };
}

export async function processPaseto(
  input: string,
  key: string,
  operation: TokenOperation,
  footer: string,
  assertion: string,
) {
  if (!['encrypt', 'decrypt', 'sign', 'verify'].includes(operation))
    throw new Error('无效的操作');
  const paseto = await import('paseto-ts/v4');
  if (operation === 'encrypt' || operation === 'sign') {
    const payload: unknown = JSON.parse(input);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('Payload 须为 JSON 对象');
    return paseto[operation](key.trim(), input, {
      footer: footer || undefined,
      assertion: assertion || undefined,
    });
  }
  return paseto[operation](key.trim(), input.trim(), {
    assertion: assertion || undefined,
  });
}

export type PfxCertificate = {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: string;
  notAfter: string;
  pem: string;
};
export async function inspectPfx(
  bytes: Uint8Array,
  password: string,
): Promise<{ certificates: PfxCertificate[]; privateKeyCount: number }> {
  if (bytes.length > 10 * 1024 * 1024) throw new Error('文件不能超过 10 MB');
  const forge = (await import('node-forge')).default;
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    '',
  );
  const container = forge.pkcs12.pkcs12FromAsn1(
    forge.asn1.fromDer(binary),
    true,
    password,
  );
  let privateKeyCount = 0;
  const certificates: PfxCertificate[] = [];
  for (const content of container.safeContents)
    for (const bag of content.safeBags) {
      if (
        bag.type === forge.pki.oids.keyBag ||
        bag.type === forge.pki.oids.pkcs8ShroudedKeyBag
      )
        privateKeyCount++;
      if (bag.type === forge.pki.oids.certBag) {
        if (!bag.cert) {
          if (!bag.asn1) throw new Error('证书类型不受支持，无法读取该条目');
          const pem = forge.pem.encode({
            type: 'CERTIFICATE',
            body: forge.asn1.toDer(bag.asn1).getBytes(),
          });
          const { parseCertificate } = await import('./certificate');
          const info = await parseCertificate(pem);
          certificates.push({
            subject: info.subject,
            issuer: info.issuer,
            serialNumber: info.serialNumber,
            notBefore: info.notBefore,
            notAfter: info.notAfter,
            pem,
          });
          continue;
        }
        const cert = bag.cert;
        const name = (attributes: typeof cert.subject.attributes) =>
          attributes
            .map(
              (entry) =>
                `${entry.shortName || entry.name || entry.type}=${String(entry.value)}`,
            )
            .join(', ');
        certificates.push({
          subject: name(cert.subject.attributes),
          issuer: name(cert.issuer.attributes),
          serialNumber: cert.serialNumber,
          notBefore: cert.validity.notBefore.toISOString(),
          notAfter: cert.validity.notAfter.toISOString(),
          pem: forge.pki.certificateToPem(cert),
        });
      }
    }
  if (!certificates.length) throw new Error('证书包中没有可读取的证书');
  return { certificates, privateKeyCount };
}

export type PgpOperation = TokenOperation | 'inspect';
export async function processOpenPgp(
  operation: PgpOperation,
  data: Uint8Array,
  keyText: string,
  passphrase: string,
  signature: string,
): Promise<{ text: string; bytes?: Uint8Array }> {
  if (!['encrypt', 'decrypt', 'sign', 'verify', 'inspect'].includes(operation))
    throw new Error('无效的操作');
  if (data.length > 20 * 1024 * 1024) throw new Error('文件不能超过 20 MB');
  const pgp = await import('openpgp');
  if (operation === 'inspect') {
    const key = await pgp.readKey({ armoredKey: keyText });
    return {
      text: JSON.stringify(
        {
          fingerprint: key.getFingerprint(),
          userIds: key.getUserIDs(),
          created: key.getCreationTime(),
          algorithm: key.getAlgorithmInfo(),
        },
        null,
        2,
      ),
    };
  }
  if (operation === 'encrypt') {
    const key = await pgp.readKey({ armoredKey: keyText });
    const message = await pgp.createMessage({ binary: data });
    return {
      text: await pgp.encrypt({
        message,
        encryptionKeys: key,
        format: 'armored',
      }),
    };
  }
  if (operation === 'verify') {
    const key = await pgp.readKey({ armoredKey: keyText });
    const result = await pgp.verify({
      message: await pgp.createMessage({ binary: data }),
      signature: await pgp.readSignature({ armoredSignature: signature }),
      verificationKeys: key,
    });
    if (!result.signatures.length) throw new Error('未找到签名');
    await Promise.all(result.signatures.map((entry) => entry.verified));
    return {
      text: JSON.stringify(
        {
          verified: true,
          fingerprint: key.getFingerprint(),
          signers: result.signatures.map((entry) => entry.keyID.toHex()),
        },
        null,
        2,
      ),
    };
  }
  let privateKey = await pgp.readPrivateKey({ armoredKey: keyText });
  if (!privateKey.isDecrypted())
    privateKey = await pgp.decryptKey({ privateKey, passphrase });
  if (operation === 'sign')
    return {
      text: await pgp.sign({
        message: await pgp.createMessage({ binary: data }),
        signingKeys: privateKey,
        detached: true,
        format: 'armored',
      }),
    };
  const decoded = new TextDecoder().decode(data);
  const message = decoded.trimStart().startsWith('-----BEGIN PGP MESSAGE-----')
    ? await pgp.readMessage({ armoredMessage: decoded })
    : await pgp.readMessage({ binaryMessage: data });
  const result = await pgp.decrypt({
    message,
    decryptionKeys: privateKey,
    format: 'binary',
    config: { maxDecompressedMessageSize: 20 * 1024 * 1024 },
  });
  return { text: new TextDecoder().decode(result.data), bytes: result.data };
}
