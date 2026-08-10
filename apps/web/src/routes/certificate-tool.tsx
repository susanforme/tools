import { FileDropzone } from '@/components/file-dropzone';
import {
  CertificateChainPanel,
  SshKeyPanel,
} from '@/components/extra-tool-panels';
import { KeyPairMatchPanel } from '@/components/protocol-tool-panels';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  parseAsn1,
  parseCertificate,
  type Asn1TreeNode,
  type CertificateInfo,
} from '@/lib/certificate';
import {
  generateKeyPair,
  jwkToPem,
  pemToJwk,
  type GeneratedKeyPair,
  type KeyPairType,
  type PublicJwk,
} from '@/lib/jwk';
import { createFileRoute } from '@tanstack/react-router';
import { FileKey, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/certificate-tool')({
  component: CertificateToolPage,
});

function CertificateToolPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<
    'inspect' | 'convert' | 'generate' | 'asn1' | 'ssh' | 'chain' | 'match'
  >('tab', StringParam, 'inspect');
  const [input, setInput] = useState<string | ArrayBuffer>('');
  const [text, setText] = useState('');
  const [info, setInfo] = useState<CertificateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inspect = async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await parseCertificate(typeof input === 'string' ? text : input));
    } catch (cause) {
      setError(t('certificateTool.error', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };
  const loadFile = async (file: File) => {
    const content = await file.text();
    if (content.includes('-----BEGIN')) {
      setInput(content);
      setText(content);
    } else {
      setInput(await file.arrayBuffer());
      setText(file.name);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('certificateTool.title')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(
            value as
              | 'inspect'
              | 'convert'
              | 'generate'
              | 'asn1'
              | 'ssh'
              | 'chain'
              | 'match',
          )
        }
      >
        <TabsList>
          <TabsTrigger value="inspect">
            {t('certificateTool.tabInspect')}
          </TabsTrigger>
          <TabsTrigger value="convert">PEM ↔ JWK</TabsTrigger>
          <TabsTrigger value="generate">
            {t('certificateTool.tabGenerate')}
          </TabsTrigger>
          <TabsTrigger value="asn1">ASN.1 / DER</TabsTrigger>
          <TabsTrigger value="ssh">SSH Key</TabsTrigger>
          <TabsTrigger value="chain">
            {t('certificateTool.tabChain')}
          </TabsTrigger>
          <TabsTrigger value="match">{t('protocol.tabs.keyMatch')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'inspect' ? (
        <>
          <FileDropzone
            accept=".pem,.crt,.cer,.csr,application/pkix-cert"
            onFiles={(files) => files[0] && void loadFile(files[0].file)}
            className="flex min-h-28 items-center justify-center rounded-xl p-5 text-center"
          >
            <div>
              <FileKey className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              {t('certificateTool.drop')}
            </div>
          </FileDropzone>
          <Textarea
            aria-label={t('certificateTool.title')}
            className="min-h-64 font-mono"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setInput(event.target.value);
            }}
          />
          <Button
            disabled={loading || (!text && !(input instanceof ArrayBuffer))}
            onClick={() => void inspect()}
          >
            {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t('certificateTool.inspect')}
          </Button>
          {error && <div className="text-sm text-destructive">{error}</div>}
          {info && (
            <div className="divide-y rounded-xl border">
              {Object.entries(info).map(([key, value]) => (
                <div
                  key={key}
                  className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[12rem_1fr]"
                >
                  <span className="text-muted-foreground">
                    {t(`certificateTool.fields.${key}`)}
                  </span>
                  <span className="break-all font-mono">
                    {Array.isArray(value)
                      ? value.join(', ') || '—'
                      : value || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === 'convert' ? (
        <PemJwkPanel />
      ) : tab === 'generate' ? (
        <KeyPairPanel />
      ) : tab === 'asn1' ? (
        <Asn1Panel />
      ) : tab === 'ssh' ? (
        <SshKeyPanel />
      ) : tab === 'chain' ? (
        <CertificateChainPanel />
      ) : (
        <KeyPairMatchPanel />
      )}
    </div>
  );
}

function Asn1Panel() {
  const { t } = useTranslation();
  const [input, setInput] = useState<string | ArrayBuffer>('');
  const [text, setText] = useState('');
  const [tree, setTree] = useState<Asn1TreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inspect = async () => {
    setError(null);
    try {
      setTree(await parseAsn1(input instanceof ArrayBuffer ? input : text));
    } catch (cause) {
      setTree(null);
      setError(
        t('certificateTool.asn1Error', { msg: (cause as Error).message }),
      );
    }
  };
  return (
    <div className="space-y-4">
      <FileDropzone
        accept=".pem,.der,.cer,.crt,.csr"
        onFiles={(files) => {
          const file = files[0]?.file;
          if (!file) return;
          void file.arrayBuffer().then((buffer) => {
            setInput(buffer);
            setText(file.name);
          });
        }}
        className="flex min-h-24 items-center justify-center rounded-xl p-4"
      >
        {t('certificateTool.asn1Drop')}
      </FileDropzone>
      <Textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setInput(event.target.value);
        }}
        className="min-h-40 font-mono text-xs"
      />
      <Button
        disabled={!text && !(input instanceof ArrayBuffer)}
        onClick={() => void inspect()}
      >
        {t('certificateTool.inspect')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {tree && (
        <div className="rounded-xl border p-3">
          <Asn1Node node={tree} depth={0} />
        </div>
      )}
    </div>
  );
}

function Asn1Node({ node, depth }: { node: Asn1TreeNode; depth: number }) {
  return (
    <details open={depth < 2} className={depth ? 'ml-4 border-l pl-3' : ''}>
      <summary className="cursor-pointer py-1 font-mono text-sm">
        <span className="text-blue-600 dark:text-blue-400">{node.name}</span>{' '}
        <span className="text-muted-foreground">[{node.tag}]</span>
        {node.value && (
          <span className="break-all text-muted-foreground">
            {' '}
            · {node.value}
          </span>
        )}
      </summary>
      {node.children.map((child, index) => (
        <Asn1Node
          key={`${child.tag}-${index}`}
          node={child}
          depth={depth + 1}
        />
      ))}
    </details>
  );
}

function KeyPairPanel() {
  const { t } = useTranslation();
  const [type, setType] = useState<KeyPairType>('RSA');
  const [result, setResult] = useState<GeneratedKeyPair | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await generateKeyPair(type));
    } catch (cause) {
      setResult(null);
      setError(
        t('certificateTool.generateError', { msg: (cause as Error).message }),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={type}
          onValueChange={(value) => setType(value as KeyPairType)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['RSA', 'P-256', 'P-384', 'P-521', 'Ed25519'] as const).map(
              (item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Button disabled={loading} onClick={() => void generate()}>
          {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t('certificateTool.generate')}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(
            [
              ['publicPem', result.publicPem],
              ['privatePem', result.privatePem],
              ['publicJwk', JSON.stringify(result.publicJwk, null, 2)],
              ['privateJwk', JSON.stringify(result.privateJwk, null, 2)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="space-y-2">
              <div className="text-sm font-medium">
                {t(`certificateTool.${label}`)}
              </div>
              <Textarea
                readOnly
                className="min-h-64 font-mono text-xs"
                value={value}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PemJwkPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const convert = async (direction: 'pem' | 'jwk') => {
    setError(null);
    try {
      setOutput(
        direction === 'pem'
          ? JSON.stringify(await pemToJwk(input), null, 2)
          : await jwkToPem(JSON.parse(input) as PublicJwk),
      );
    } catch (cause) {
      setOutput('');
      setError(
        t('certificateTool.convertError', {
          msg: (cause as Error).message,
        }),
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-80 font-mono text-xs"
          placeholder={t('certificateTool.convertPlaceholder')}
        />
        <Textarea
          readOnly
          value={output}
          className="min-h-80 font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!input.trim()} onClick={() => void convert('pem')}>
          {t('certificateTool.pemToJwk')}
        </Button>
        <Button
          variant="outline"
          disabled={!input.trim()}
          onClick={() => void convert('jwk')}
        >
          {t('certificateTool.jwkToPem')}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
