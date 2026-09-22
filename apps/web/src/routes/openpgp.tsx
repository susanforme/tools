import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { CodePanel } from '@/components/code-panel';
import { useSecurityText } from '@/components/security-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob, downloadBytes } from '@/lib/download';
import { processOpenPgp, type PgpOperation } from '@/lib/security-workbench';
export const Route = createFileRoute('/openpgp')({ component: OpenPgpPage });
function OpenPgpPage() {
  const text = useSecurityText();
  const [operation, setOperation] = useQueryParam<PgpOperation>(
    'operation',
    StringParam,
    'encrypt',
  );
  const [input, setInput] = useState('');
  const [key, setKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [signature, setSignature] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    text: string;
    bytes?: Uint8Array;
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
  }, [operation, input, key, passphrase, signature, file]);
  const run = async () => {
    const request = revision.current;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if ((file?.size ?? new Blob([input]).size) > 20 * 1024 * 1024)
        throw new Error(text('pgpLimit'));
      const data = file
        ? new Uint8Array(await file.arrayBuffer())
        : new TextEncoder().encode(input);
      const processed = await processOpenPgp(
        operation,
        data,
        key,
        passphrase,
        signature,
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
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{text('pgpTitle')}</h1>
      <Tabs
        value={operation}
        onValueChange={(value) => {
          setOperation(value as PgpOperation);
          setResult(null);
          setError(null);
        }}
      >
        <TabsList className="flex h-auto flex-wrap gap-1 group-data-[orientation=horizontal]/tabs:h-auto [&_[data-slot=tabs-trigger]]:h-9">
          {(['encrypt', 'decrypt', 'sign', 'verify', 'inspect'] as const).map(
            (value) => (
              <TabsTrigger value={value} key={value}>
                {text(value)}
              </TabsTrigger>
            ),
          )}
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">{text('pgpLimit')}</p>
      <Label htmlFor="pgp-key">{text('pgpKey')}</Label>
      <Textarea
        id="pgp-key"
        className="min-h-32 font-mono"
        autoComplete="off"
        value={key}
        onChange={(event) => setKey(event.target.value)}
      />
      {(operation === 'decrypt' || operation === 'sign') && (
        <>
          <Label htmlFor="pgp-passphrase">{text('passphrase')}</Label>
          <Input
            id="pgp-passphrase"
            type="password"
            autoComplete="off"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </>
      )}
      {operation === 'verify' && (
        <>
          <Label htmlFor="pgp-signature">{text('signature')}</Label>
          <Textarea
            id="pgp-signature"
            className="min-h-32 font-mono"
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {text('verificationNote')}
          </p>
        </>
      )}
      {operation !== 'inspect' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={text('importFile')}
            type="file"
            disabled={loading}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
          {file && (
            <>
              <span className="text-sm">
                {text('fileSelected', { name: file.name })}
              </span>
              <Button variant="outline" onClick={() => setFile(null)}>
                {text('useText')}
              </Button>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading || !key} onClick={() => void run()}>
          {text(loading ? 'running' : 'run')}
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            setInput('');
            setKey('');
            setPassphrase('');
            setSignature('');
            setFile(null);
            setResult(null);
            setError(null);
          }}
        >
          {text('clear')}
        </Button>
        {result && (
          <Button
            variant="outline"
            onClick={() =>
              result.bytes
                ? downloadBytes(result.bytes, 'decrypted.bin')
                : downloadBlob(
                    new Blob([result.text], { type: 'text/plain' }),
                    operation === 'sign'
                      ? 'signature.asc'
                      : operation === 'encrypt'
                        ? 'encrypted.asc'
                        : 'result.txt',
                  )
            }
          >
            {text('download')}
          </Button>
        )}
      </div>
      <CodePanel
        input={input}
        output={result?.text ?? ''}
        onInputChange={(value) => {
          setInput(value);
          setFile(null);
        }}
        error={error}
        language="plaintext"
      />
    </div>
  );
}
