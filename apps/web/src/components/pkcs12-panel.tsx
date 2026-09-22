import { useEffect, useRef, useState } from 'react';
import { inspectPfx, type PfxCertificate } from '@/lib/security-workbench';
import { downloadBlob } from '@/lib/download';
import { useSecurityText } from './security-text';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function Pkcs12Panel() {
  const text = useSecurityText();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<{
    certificates: PfxCertificate[];
    privateKeyCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  useEffect(() => {
    revision.current++;
    setResult(null);
    setError(null);
    return () => {
      revision.current++;
    };
  }, [file, password]);
  const run = async () => {
    const request = revision.current;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (!file) throw new Error(text('noFile'));
      if (file.size > 10 * 1024 * 1024) throw new Error(text('pfxLimit'));
      const processed = await inspectPfx(
        new Uint8Array(await file.arrayBuffer()),
        password,
      );
      if (request === revision.current) setResult(processed);
    } catch (cause) {
      if (request === revision.current)
        setError(text('failed', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{text('pfxLimit')}</p>
      <Input
        aria-label={text('importFile')}
        type="file"
        accept=".pfx,.p12"
        disabled={loading}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setResult(null);
          setError(null);
        }}
      />
      <Label htmlFor="pfx-password">{text('password')}</Label>
      <Input
        id="pfx-password"
        type="password"
        autoComplete="off"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button disabled={loading || !file} onClick={() => void run()}>
        {text(loading ? 'running' : 'run')}
      </Button>
      {error && (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <p>
            {text('certificateCount', {
              count: result.certificates.length,
              keys: result.privateKeyCount,
            })}
          </p>
          <p className="text-sm text-muted-foreground">{text('pfxNote')}</p>
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                new Blob(
                  [result.certificates.map((cert) => cert.pem).join('\n')],
                  { type: 'application/x-pem-file' },
                ),
                'certificates.pem',
              )
            }
          >
            {text('exportPem')}
          </Button>
          {result.certificates.map((cert, index) => (
            <dl
              key={index}
              className="space-y-2 rounded-lg border p-4 text-sm break-all"
            >
              <dt>{text('subject')}</dt>
              <dd>{cert.subject}</dd>
              <dt>{text('issuer')}</dt>
              <dd>{cert.issuer}</dd>
              <dt>{text('serial')}</dt>
              <dd>{cert.serialNumber}</dd>
              <dt>{text('validity')}</dt>
              <dd>
                {cert.notBefore} → {cert.notAfter}
              </dd>
            </dl>
          ))}
        </>
      )}
    </div>
  );
}
