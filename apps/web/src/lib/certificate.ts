import 'reflect-metadata';

export type CertificateInfo = {
  algorithm: string;
  dnsNames: string[];
  issuer: string;
  notAfter: string;
  notBefore: string;
  serialNumber: string;
  subject: string;
  type: 'certificate' | 'request';
};

export type Asn1TreeNode = {
  name: string;
  tag: string;
  value: string;
  children: Asn1TreeNode[];
};

export type CertificateChainEntry = {
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  linkedToNext: boolean;
  signatureValid: boolean;
  validNow: boolean;
};

export async function inspectCertificateChain(
  input: string,
): Promise<CertificateChainEntry[]> {
  const x509 = await import('@peculiar/x509');
  const blocks = input.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
  );
  if (!blocks?.length) throw new Error('NO_CERTIFICATES');
  const certificates = blocks.map((block) => new x509.X509Certificate(block));
  const now = Date.now();
  return Promise.all(
    certificates.map(async (certificate, index) => {
      const issuer = certificates[index + 1] ?? certificate;
      return {
        subject: certificate.subject,
        issuer: certificate.issuer,
        notBefore: certificate.notBefore.toISOString(),
        notAfter: certificate.notAfter.toISOString(),
        linkedToNext:
          index + 1 >= certificates.length ||
          certificate.issuer === issuer.subject,
        signatureValid: await certificate.verify({
          publicKey: issuer.publicKey,
          signatureOnly: true,
        }),
        validNow:
          certificate.notBefore.getTime() <= now &&
          certificate.notAfter.getTime() >= now,
      };
    }),
  );
}

export async function generateCsr(
  commonName: string,
  dnsNames: string[],
  curve: 'P-256' | 'P-384',
): Promise<{ csr: string; privateKey: string }> {
  const x509 = await import('@peculiar/x509');
  const hash = curve === 'P-256' ? 'SHA-256' : 'SHA-384';
  const algorithm: EcKeyGenParams & EcdsaParams = {
    name: 'ECDSA',
    namedCurve: curve,
    hash,
  };
  const keys = await crypto.subtle.generateKey(algorithm, true, [
    'sign',
    'verify',
  ]);
  const request = await x509.Pkcs10CertificateRequestGenerator.create({
    name: `CN=${commonName.replaceAll(',', '\\,')}`,
    keys,
    signingAlgorithm: algorithm,
    extensions: dnsNames.length
      ? [
          new x509.SubjectAlternativeNameExtension(
            dnsNames.map((value) => ({ type: 'dns' as const, value })),
          ),
        ]
      : [],
  });
  const privateKey = await crypto.subtle.exportKey('pkcs8', keys.privateKey);
  return {
    csr: x509.PemConverter.encode(
      request.rawData,
      x509.PemConverter.CertificateRequestTag,
    ),
    privateKey: x509.PemConverter.encode(
      privateKey,
      x509.PemConverter.PrivateKeyTag,
    ),
  };
}

type Asn1Block = {
  constructor: { name: string };
  idBlock: { tagClass: number; tagNumber: number; isConstructed: boolean };
  valueBlock: { value?: unknown; valueHexView?: Uint8Array };
};

function pemBytes(input: string): Uint8Array {
  const base64 = input.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function parseAsn1(
  input: string | ArrayBuffer,
): Promise<Asn1TreeNode> {
  const asn1js = await import('asn1js');
  const bytes =
    typeof input === 'string' ? pemBytes(input) : new Uint8Array(input);
  const parsed = asn1js.fromBER(new Uint8Array(bytes).buffer);
  if (parsed.offset === -1) throw new Error('INVALID_ASN1');
  let nodes = 0;
  const visit = (raw: unknown, depth: number): Asn1TreeNode => {
    if (depth > 32 || nodes++ > 2000) throw new Error('ASN1_LIMIT');
    const block = raw as Asn1Block;
    const childValues = Array.isArray(block.valueBlock.value)
      ? block.valueBlock.value
      : [];
    const primitive = block.valueBlock.value;
    const value =
      typeof primitive === 'string' ||
      typeof primitive === 'number' ||
      typeof primitive === 'bigint'
        ? String(primitive)
        : block.valueBlock.valueHexView?.length
          ? [...block.valueBlock.valueHexView.slice(0, 64)]
              .map((byte) => byte.toString(16).padStart(2, '0'))
              .join('')
          : '';
    return {
      name: block.constructor.name,
      tag: `${block.idBlock.tagClass}:${block.idBlock.tagNumber}`,
      value,
      children: childValues.map((child) => visit(child, depth + 1)),
    };
  };
  return visit(parsed.result, 0);
}

function algorithmName(value: object): string {
  const name = Reflect.get(value, 'name');
  const length = Reflect.get(value, 'modulusLength');
  const curve = Reflect.get(value, 'namedCurve');
  return [name, length ? `${length} bit` : '', curve]
    .filter(Boolean)
    .join(' · ');
}

export async function parseCertificate(
  input: string | ArrayBuffer,
): Promise<CertificateInfo> {
  const x509 = await import('@peculiar/x509');
  const request =
    typeof input === 'string' && input.includes('CERTIFICATE REQUEST');
  if (request) {
    const csr = new x509.Pkcs10CertificateRequest(input);
    const san = csr.extensions.find(
      (extension) => extension instanceof x509.SubjectAlternativeNameExtension,
    ) as InstanceType<typeof x509.SubjectAlternativeNameExtension> | undefined;
    return {
      type: 'request',
      subject: csr.subject,
      issuer: '',
      serialNumber: '',
      notBefore: '',
      notAfter: '',
      dnsNames:
        san?.names.items
          .filter(({ type }) => type === 'dns')
          .map(({ value }) => value) ?? [],
      algorithm: algorithmName(csr.publicKey.algorithm),
    };
  }
  const certificate = new x509.X509Certificate(input);
  const san = certificate.getExtension(x509.SubjectAlternativeNameExtension);
  return {
    type: 'certificate',
    subject: certificate.subject,
    issuer: certificate.issuer,
    serialNumber: certificate.serialNumber,
    notBefore: certificate.notBefore.toISOString(),
    notAfter: certificate.notAfter.toISOString(),
    dnsNames:
      san?.names.items
        .filter(({ type }) => type === 'dns')
        .map(({ value }) => value) ?? [],
    algorithm: algorithmName(certificate.publicKey.algorithm),
  };
}
