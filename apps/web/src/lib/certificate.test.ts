import { describe, expect, it } from 'vitest';
import { generateCsr, inspectCertificateChain, parseAsn1 } from './certificate';

describe('ASN.1 inspector', () => {
  it('parses a DER sequence', async () => {
    const der = Uint8Array.from([0x30, 0x03, 0x02, 0x01, 0x05]);
    await expect(parseAsn1(new Uint8Array(der).buffer)).resolves.toMatchObject({
      name: 'Sequence',
      children: [{ name: 'Integer' }],
    });
  });

  it('generates a browser PKCS#10 request', async () => {
    const result = await generateCsr(
      'example.com',
      ['www.example.com'],
      'P-256',
    );
    expect(result.csr).toContain('BEGIN CERTIFICATE REQUEST');
    expect(result.privateKey).toContain('BEGIN PRIVATE KEY');
  });

  it('verifies a self-signed certificate chain', async () => {
    const x509 = await import('@peculiar/x509');
    const algorithm: EcKeyGenParams & EcdsaParams = {
      name: 'ECDSA',
      namedCurve: 'P-256',
      hash: 'SHA-256',
    };
    const keys = await crypto.subtle.generateKey(algorithm, false, [
      'sign',
      'verify',
    ]);
    const certificate = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: '01',
      name: 'CN=Test',
      notBefore: new Date(Date.now() - 60_000),
      notAfter: new Date(Date.now() + 60_000),
      signingAlgorithm: algorithm,
      keys,
    });

    await expect(
      inspectCertificateChain(certificate.toString('pem')),
    ).resolves.toMatchObject([
      { linkedToNext: true, signatureValid: true, validNow: true },
    ]);
  });
});
