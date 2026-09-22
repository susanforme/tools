import { useEffect, useRef, useState } from 'react';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { CodePanel } from './code-panel';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import {
  processJwe,
  processPaseto,
  type TokenOperation,
} from '@/lib/security-workbench';
import { useSecurityText } from './security-text';

export default function TokenSecurityPanel({
  kind,
}: {
  kind: 'jwe' | 'paseto';
}) {
  const text = useSecurityText();
  const [operationValue, setOperation] = useQueryParam<TokenOperation>(
    'operation',
    StringParam,
    'encrypt',
  );
  const operation =
    kind === 'jwe' && (operationValue === 'sign' || operationValue === 'verify')
      ? 'encrypt'
      : operationValue;
  const [key, setKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [footer, setFooter] = useState('');
  const [assertion, setAssertion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  useEffect(() => {
    revision.current++;
    setOutput('');
    setError(null);
    return () => {
      revision.current++;
    };
  }, [kind, operation, input, key, publicKey, footer, assertion]);
  const execute = async (generate = false) => {
    const request = revision.current;
    setLoading(true);
    setError(null);
    setOutput('');
    try {
      if (generate) {
        if (kind === 'jwe')
          setKey(
            Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join(''),
          );
        else {
          const paseto = await import('paseto-ts/v4');
          if (request !== revision.current) return;
          if (operation === 'sign' || operation === 'verify') {
            const pair = paseto.generateKeys('public');
            setKey(pair.secretKey);
            setPublicKey(pair.publicKey);
          } else setKey(paseto.generateKeys('local'));
        }
      } else {
        const result =
          kind === 'jwe'
            ? await processJwe(
                input,
                key,
                operation === 'decrypt' ? 'decrypt' : 'encrypt',
              )
            : await processPaseto(
                input,
                operation === 'verify' ? publicKey : key,
                operation,
                footer,
                assertion,
              );
        if (request !== revision.current) return;
        setOutput(
          typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        );
      }
    } catch (cause) {
      if (request === revision.current)
        setError(text('failed', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-4">
      <Tabs
        value={operation}
        onValueChange={(value) => {
          setOperation(value as TokenOperation);
          setOutput('');
          setError(null);
        }}
      >
        <TabsList>
          {(kind === 'jwe'
            ? (['encrypt', 'decrypt'] as const)
            : (['encrypt', 'decrypt', 'sign', 'verify'] as const)
          ).map((value) => (
            <TabsTrigger key={value} value={value}>
              {text(value)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        {text(kind === 'jwe' ? 'jweLimit' : 'pasetoLimit')}
      </p>
      <Label htmlFor={`${kind}-key`}>
        {text(kind === 'jwe' ? 'jweKey' : 'secretKey')}
      </Label>
      <Input
        id={`${kind}-key`}
        type="password"
        autoComplete="off"
        value={key}
        onChange={(event) => setKey(event.target.value)}
      />
      {kind === 'paseto' && (
        <>
          <Label htmlFor="paseto-public">{text('publicKey')}</Label>
          <Input
            id="paseto-public"
            value={publicKey}
            onChange={(event) => setPublicKey(event.target.value)}
          />
          <Label htmlFor="paseto-footer">{text('footer')}</Label>
          <Input
            id="paseto-footer"
            value={footer}
            onChange={(event) => setFooter(event.target.value)}
          />
          <Label htmlFor="paseto-assertion">{text('assertion')}</Label>
          <Input
            id="paseto-assertion"
            type="password"
            autoComplete="off"
            value={assertion}
            onChange={(event) => setAssertion(event.target.value)}
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading} onClick={() => void execute()}>
          {text(loading ? 'running' : 'run')}
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void execute(true)}
        >
          {text('generate')}
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            setInput('');
            setOutput('');
            setKey('');
            setPublicKey('');
            setFooter('');
            setAssertion('');
            setError(null);
          }}
        >
          {text('clear')}
        </Button>
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        error={error}
        language="plaintext"
      />
    </div>
  );
}
