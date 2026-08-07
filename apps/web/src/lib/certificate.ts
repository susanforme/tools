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
