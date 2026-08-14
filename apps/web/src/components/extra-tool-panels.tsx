import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  createWebhookSignature,
  type WebhookProvider,
} from '@/lib/advanced-tools';
import {
  generateCsr,
  inspectCertificateChain,
  type CertificateChainEntry,
} from '@/lib/certificate';
import { parseHexPattern } from '@/lib/binary-inspector';
import { base64ToBytes } from '@/lib/developer-tools';
import {
  importNetworkRuntimeModule,
  importRuntimeModule,
  loadRuntimeAssetUrl,
  loadRuntimeWasm,
} from '@/lib/runtime-assets';
import {
  analyzeHttpCache,
  analyzeHttpLogs,
  checksums,
  decodeProtobufWire,
  inspectDataUri,
  inspectSecurityTxt,
  inspectSshPublicKey,
  inspectUnicodeSecurity,
  type DataUriInfo,
  type HttpLogSummary,
  type SshKeyInfo,
} from '@/lib/next-tools';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Email } from 'postal-mime';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';

function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="text-sm text-destructive">{error}</p> : null;
}

export function CacheControlPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    'Date: Wed, 21 Oct 2026 07:28:00 GMT\nCache-Control: public, max-age=3600, immutable\nETag: "abc123"\nAge: 120',
  );
  const result = useMemo(() => analyzeHttpCache(input), [input]);
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-48 font-mono text-xs"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label={t('extra.cache.cacheable')}
          value={t(`extra.common.${result.cacheable ? 'yes' : 'no'}`)}
        />
        <Metric
          label={t('extra.cache.freshness')}
          value={
            result.freshnessSeconds === null
              ? '—'
              : `${result.freshnessSeconds}s`
          }
        />
        <Metric
          label={t('extra.cache.remaining')}
          value={
            result.remainingSeconds === null
              ? '—'
              : `${result.remainingSeconds}s`
          }
        />
      </div>
      <pre className="overflow-auto rounded-xl border p-3 text-xs">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-mono text-sm">{value}</p>
    </div>
  );
}

export function UnicodeSecurityPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState('paypal.com');
  const issues = useMemo(() => inspectUnicodeSecurity(input), [input]);
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-40 font-mono"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="NFC" value={input.normalize('NFC')} />
        <Metric label="NFKC" value={input.normalize('NFKC')} />
      </div>
      {issues.length ? (
        <div className="space-y-2">
          {issues.map((issue, index) => (
            <div
              key={`${issue.code}-${index}`}
              className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
            >
              <strong>{t(`extra.unicode.${issue.code}`)}</strong>
              <div className="break-all font-mono text-xs text-muted-foreground">
                {issue.detail}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-emerald-600">{t('extra.unicode.clean')}</p>
      )}
    </div>
  );
}

export function SshKeyPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<SshKeyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inspect = async () => {
    setError(null);
    try {
      setResult(await inspectSshPublicKey(input));
    } catch (cause) {
      setResult(null);
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-40 font-mono text-xs"
        placeholder="ssh-ed25519 AAAA… user@example.com"
      />
      <Button disabled={!input.trim()} onClick={() => void inspect()}>
        {t('extra.inspect')}
      </Button>
      <ErrorText error={error} />
      {result && (
        <pre className="overflow-auto rounded-xl border p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function CertificateChainPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<'chain' | 'csr'>(
    'certMode',
    StringParam,
    'chain',
  );
  const [input, setInput] = useState('');
  const [chain, setChain] = useState<CertificateChainEntry[] | null>(null);
  const [commonName, setCommonName] = useState('example.com');
  const [dnsNames, setDnsNames] = useState('example.com\nwww.example.com');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inspect = async () => {
    setError(null);
    try {
      setChain(await inspectCertificateChain(input));
    } catch (cause) {
      setChain(null);
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  const create = async () => {
    setError(null);
    try {
      const result = await generateCsr(
        commonName,
        dnsNames
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
        'P-256',
      );
      setOutput(`${result.csr}\n${result.privateKey}`);
    } catch (cause) {
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === 'chain' ? 'default' : 'outline'}
          onClick={() => setMode('chain')}
        >
          {t('extra.certificate.chain')}
        </Button>
        <Button
          size="sm"
          variant={mode === 'csr' ? 'default' : 'outline'}
          onClick={() => setMode('csr')}
        >
          {t('extra.certificate.csr')}
        </Button>
      </div>
      {mode === 'chain' ? (
        <>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-64 font-mono text-xs"
            placeholder={t('extra.certificate.chainPlaceholder')}
          />
          <Button disabled={!input.trim()} onClick={() => void inspect()}>
            {t('extra.inspect')}
          </Button>
          {chain && (
            <div className="space-y-2">
              {chain.map((entry, index) => (
                <div
                  key={`${entry.subject}-${index}`}
                  className="rounded-xl border p-3 text-sm"
                >
                  <div className="font-mono">
                    {index + 1}. {entry.subject}
                  </div>
                  <div className="text-muted-foreground">→ {entry.issuer}</div>
                  <div>
                    {entry.validNow &&
                    entry.linkedToNext &&
                    entry.signatureValid
                      ? '✓'
                      : '⚠'}{' '}
                    {entry.notBefore} — {entry.notAfter}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <Input
            value={commonName}
            onChange={(event) => setCommonName(event.target.value)}
            placeholder="Common Name"
          />
          <Textarea
            value={dnsNames}
            onChange={(event) => setDnsNames(event.target.value)}
            className="min-h-28 font-mono text-xs"
            placeholder={t('extra.certificate.dnsNames')}
          />
          <Button disabled={!commonName.trim()} onClick={() => void create()}>
            {t('extra.certificate.generate')}
          </Button>
          {output && (
            <Textarea
              readOnly
              value={output}
              className="min-h-96 font-mono text-xs"
            />
          )}
        </>
      )}
      <ErrorText error={error} />
    </div>
  );
}

export function ProtobufPanel() {
  const { t } = useTranslation();
  const [encoding, setEncoding] = useQueryParam<'hex' | 'base64'>(
    'protoEncoding',
    StringParam,
    'hex',
  );
  const [input, setInput] = useState('08 96 01 12 05 68 65 6c 6c 6f');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decode = () => {
    setError(null);
    try {
      const bytes =
        encoding === 'hex' ? parseHexPattern(input) : base64ToBytes(input);
      setOutput(JSON.stringify(decodeProtobufWire(bytes), null, 2));
    } catch (cause) {
      setOutput('');
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={encoding === 'hex' ? 'default' : 'outline'}
          onClick={() => setEncoding('hex')}
        >
          Hex
        </Button>
        <Button
          size="sm"
          variant={encoding === 'base64' ? 'default' : 'outline'}
          onClick={() => setEncoding('base64')}
        >
          Base64
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-80 font-mono text-xs"
        />
        <Textarea
          readOnly
          value={output}
          className="min-h-80 font-mono text-xs"
        />
      </div>
      <Button onClick={decode}>{t('extra.decode')}</Button>
      <ErrorText error={error} />
    </div>
  );
}

type DnsJsonResponse = {
  Status: number;
  AD?: boolean;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
};

export function DnsComparePanel() {
  const { t } = useTranslation();
  const [name, setName] = useState('example.com');
  const [type, setType] = useState('A');
  const [results, setResults] = useState<Record<string, DnsJsonResponse>>({});
  const [error, setError] = useState<string | null>(null);
  const lookup = async () => {
    setError(null);
    try {
      const query = new URLSearchParams({ name, type });
      const endpoints = {
        Cloudflare: `https://cloudflare-dns.com/dns-query?${query}`,
        Google: `https://dns.google/resolve?${query}`,
      };
      const entries = await Promise.all(
        Object.entries(endpoints).map(async ([provider, url]) => {
          const response = await fetch(url, {
            headers: { Accept: 'application/dns-json' },
          });
          if (!response.ok) throw new Error(`${provider}: ${response.status}`);
          return [
            provider,
            (await response.json()) as DnsJsonResponse,
          ] as const;
        }),
      );
      setResults(Object.fromEntries(entries));
    } catch (cause) {
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
        <Input
          value={type}
          onChange={(event) => setType(event.target.value.toUpperCase())}
          className="w-28"
        />
        <Button onClick={() => void lookup()}>{t('extra.lookup')}</Button>
      </div>
      <ErrorText error={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(results).map(([provider, response]) => (
          <div key={provider} className="rounded-xl border p-4">
            <h3 className="font-semibold">
              {provider} · DNSSEC AD: {response.AD ? '✓' : '—'}
            </h3>
            <pre className="mt-3 overflow-auto text-xs">
              {JSON.stringify(response.Answer ?? [], null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WebhookReplayPanel() {
  const { t } = useTranslation();
  const [provider, setProvider] = useQueryParam<WebhookProvider>(
    'replayProvider',
    StringParam,
    'github',
  );
  const [url, setUrl] = useState('https://example.com/webhook');
  const [payload, setPayload] = useState('{"event":"ping"}');
  const [secret, setSecret] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const generate = async () => {
    setError(null);
    try {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = await createWebhookSignature(
        provider,
        payload,
        secret,
        timestamp,
      );
      const header =
        provider === 'github'
          ? 'X-Hub-Signature-256'
          : provider === 'stripe'
            ? 'Stripe-Signature'
            : 'X-Webhook-Signature';
      setOutput(
        `curl --request POST ${JSON.stringify(url)} \\\n  --header 'Content-Type: application/json' \\\n  --header ${JSON.stringify(`${header}: ${signature}`)} \\\n  --data-raw ${JSON.stringify(payload)}`,
      );
    } catch (cause) {
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <Select
        value={provider}
        onValueChange={(value) => setProvider(value as WebhookProvider)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(['github', 'stripe', 'generic'] as const).map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={url} onChange={(event) => setUrl(event.target.value)} />
      <Input
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        placeholder={t('hmac.secret')}
      />
      <Textarea
        value={payload}
        onChange={(event) => setPayload(event.target.value)}
        className="min-h-36 font-mono text-xs"
      />
      <Button disabled={!url || !secret} onClick={() => void generate()}>
        {t('extra.webhook.generateCurl')}
      </Button>
      <Textarea
        readOnly
        value={output}
        className="min-h-44 font-mono text-xs"
      />
      <ErrorText error={error} />
    </div>
  );
}

export function DataUriPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    'data:text/plain;base64,SGVsbG8sIHRvb2xzIQ==',
  );
  const [info, setInfo] = useState<DataUriInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inspect = () => {
    setError(null);
    try {
      setInfo(inspectDataUri(input));
    } catch (cause) {
      setInfo(null);
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  const download = () => {
    if (!info) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([new Uint8Array(info.bytes).buffer], { type: info.mimeType }),
    );
    link.download = `data.${info.mimeType.split('/')[1] ?? 'bin'}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-48 font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button onClick={inspect}>{t('extra.inspect')}</Button>
        {info && (
          <Button variant="outline" onClick={download}>
            {t('extra.download')}
          </Button>
        )}
      </div>
      <ErrorText error={error} />
      {info && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="MIME" value={info.mimeType} />
            <Metric label="Charset" value={info.charset} />
            <Metric label={t('extra.size')} value={`${info.size} B`} />
          </div>
          {info.text && (
            <Textarea
              readOnly
              value={info.text}
              className="min-h-32 font-mono text-xs"
            />
          )}
        </>
      )}
    </div>
  );
}

export function HttpLogPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    '127.0.0.1 - - [10/Oct/2026:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 1234\n127.0.0.1 - - [10/Oct/2026:13:55:37 +0000] "POST /api/login HTTP/1.1" 401 98',
  );
  const [result, setResult] = useState<HttpLogSummary | null>(null);
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-72 font-mono text-xs"
      />
      <Button onClick={() => setResult(analyzeHttpLogs(input))}>
        {t('extra.analyze')}
      </Button>
      {result && (
        <pre className="overflow-auto rounded-xl border p-3 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function MimeEmailPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    'Subject: Hello\nFrom: alice@example.com\nTo: bob@example.com\nContent-Type: text/plain; charset=utf-8\n\nHello world',
  );
  const [email, setEmail] = useState<Email | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parse = async () => {
    setError(null);
    try {
      const PostalMime = (await import('postal-mime')).default;
      setEmail(await PostalMime.parse(input));
    } catch (cause) {
      setEmail(null);
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  const download = (index: number) => {
    const attachment = email?.attachments[index];
    if (!attachment) return;
    const content =
      typeof attachment.content === 'string'
        ? new TextEncoder().encode(attachment.content)
        : new Uint8Array(attachment.content);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([new Uint8Array(content).buffer], { type: attachment.mimeType }),
    );
    link.download = attachment.filename ?? `attachment-${index + 1}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-80 font-mono text-xs"
      />
      <Button onClick={() => void parse()}>{t('extra.parse')}</Button>
      <ErrorText error={error} />
      {email && (
        <>
          <pre className="overflow-auto rounded-xl border p-3 text-xs">
            {JSON.stringify(
              {
                subject: email.subject,
                from: email.from,
                to: email.to,
                date: email.date,
                messageId: email.messageId,
                text: email.text,
                attachments: email.attachments.map(
                  ({ filename, mimeType, disposition, content }) => ({
                    filename,
                    mimeType,
                    disposition,
                    size:
                      typeof content === 'string'
                        ? content.length
                        : content.byteLength,
                  }),
                ),
              },
              null,
              2,
            )}
          </pre>
          <div className="flex flex-wrap gap-2">
            {email.attachments.map((attachment, index) => (
              <Button
                key={`${attachment.filename}-${index}`}
                variant="outline"
                onClick={() => download(index)}
              >
                {t('extra.download')} {attachment.filename ?? index + 1}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SemverRangePanel() {
  const { t } = useTranslation();
  const [range, setRange] = useState('^2.0.0');
  const [versions, setVersions] = useState(
    '1.9.0\n2.0.0\n2.3.1\n3.0.0-beta.1\n3.0.0',
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    try {
      const semver = await import('semver');
      const list = versions.split(/[,\s]+/).filter(Boolean);
      setOutput(
        JSON.stringify(
          {
            validRange: semver.validRange(range),
            minVersion: semver.minVersion(range)?.version ?? null,
            matching: list.filter((version) =>
              semver.satisfies(version, range),
            ),
            maxSatisfying: semver.maxSatisfying(list, range),
            sorted: list
              .filter((version) => semver.valid(version))
              .sort(semver.compare),
          },
          null,
          2,
        ),
      );
    } catch (cause) {
      setOutput('');
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <Input
        value={range}
        onChange={(event) => setRange(event.target.value)}
        placeholder="^1.2.3 || >=2 <3"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={versions}
          onChange={(event) => setVersions(event.target.value)}
          className="min-h-64 font-mono text-xs"
        />
        <Textarea
          readOnly
          value={output}
          className="min-h-64 font-mono text-xs"
        />
      </div>
      <Button onClick={() => void run()}>{t('extra.calculate')}</Button>
      <ErrorText error={error} />
    </div>
  );
}

export function ChecksumPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState('123456789');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const result = checksums(bytes ?? new TextEncoder().encode(input));
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        disabled={bytes !== null}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-36 font-mono"
      />
      <input
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file)
            void file
              .arrayBuffer()
              .then((buffer) => setBytes(new Uint8Array(buffer)));
          else setBytes(null);
        }}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(result).map(([name, value]) => (
          <Metric key={name} label={name.toUpperCase()} value={value} />
        ))}
      </div>
      {bytes && (
        <Button variant="outline" onClick={() => setBytes(null)}>
          {t('hash.clear')}
        </Button>
      )}
    </div>
  );
}

export function IdnPanel() {
  const { t } = useTranslation();
  const [direction, setDirection] = useQueryParam<'ascii' | 'unicode'>(
    'idnDirection',
    StringParam,
    'ascii',
  );
  const [input, setInput] = useState('例子.测试');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const convert = async () => {
    setError(null);
    try {
      const punycode = await import('punycode/');
      setOutput(
        direction === 'ascii'
          ? punycode.toASCII(input.trim())
          : punycode.toUnicode(input.trim()),
      );
    } catch (cause) {
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={direction === 'ascii' ? 'default' : 'outline'}
          onClick={() => setDirection('ascii')}
        >
          Unicode → ASCII
        </Button>
        <Button
          size="sm"
          variant={direction === 'unicode' ? 'default' : 'outline'}
          onClick={() => setDirection('unicode')}
        >
          ASCII → Unicode
        </Button>
      </div>
      <Input value={input} onChange={(event) => setInput(event.target.value)} />
      <Button onClick={() => void convert()}>{t('extra.convert')}</Button>
      <Input readOnly value={output} />
      <ErrorText error={error} />
    </div>
  );
}

type CompressionResult = { algorithm: string; size: number; ratio: string };

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes).buffer])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let zstdReady: Promise<typeof import('@bokuweb/zstd-wasm')> | null = null;

function loadZstd() {
  zstdReady ??= importNetworkRuntimeModule<typeof import('@bokuweb/zstd-wasm')>(
    'zstdModule',
  ).then(async (module) => {
    const url = await loadRuntimeAssetUrl('zstdWasm', 'application/wasm');
    const initialize = module.init as unknown as (
      path: string,
    ) => Promise<void>;
    await initialize(url);
    return module;
  });
  return zstdReady;
}

type BrotliRuntime = {
  default(input: ArrayBuffer): Promise<unknown>;
  compress(input: Uint8Array): Uint8Array;
};

let brotliReady: Promise<BrotliRuntime> | null = null;

function loadBrotli() {
  brotliReady ??= Promise.all([
    importRuntimeModule<BrotliRuntime>('brotliGlue'),
    loadRuntimeWasm('brotliWasm'),
  ]).then(async ([module, bytes]) => {
    await module.default(bytes);
    return module;
  });
  return brotliReady;
}

export function CompressionBenchmarkPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState('hello '.repeat(1000));
  const [source, setSource] = useState<Uint8Array | null>(null);
  const [results, setResults] = useState<CompressionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    try {
      const bytes = source ?? new TextEncoder().encode(input);
      const [brotli, zstd] = await Promise.all([loadBrotli(), loadZstd()]);
      const entries = [
        ['Gzip', await gzip(bytes)],
        ['Brotli', brotli.compress(bytes)],
        ['Zstd', zstd.compress(bytes)],
      ] as const;
      setResults(
        entries.map(([algorithm, value]) => ({
          algorithm,
          size: value.length,
          ratio: bytes.length
            ? `${((value.length / bytes.length) * 100).toFixed(2)}%`
            : '0%',
        })),
      );
    } catch (cause) {
      setError(t('extra.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        disabled={source !== null}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-48 font-mono text-xs"
      />
      <input
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file)
            void file
              .arrayBuffer()
              .then((buffer) => setSource(new Uint8Array(buffer)));
          else setSource(null);
        }}
      />
      <Button onClick={() => void run()}>
        {t('extra.compression.compare')}
      </Button>
      <ErrorText error={error} />
      <div className="grid gap-3 sm:grid-cols-3">
        {results.map((result) => (
          <Metric
            key={result.algorithm}
            label={result.algorithm}
            value={`${result.size} B · ${result.ratio}`}
          />
        ))}
      </div>
    </div>
  );
}

export function SecurityTxtPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    'Contact: mailto:security@example.com\nExpires: 2027-12-31T23:59:59Z\nCanonical: https://example.com/.well-known/security.txt',
  );
  const issues = useMemo(() => inspectSecurityTxt(input), [input]);
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-64 font-mono text-xs"
      />
      {issues.length ? (
        <div className="space-y-2">
          {issues.map((issue) => (
            <div
              key={issue.code}
              className={
                issue.level === 'error'
                  ? 'text-sm text-destructive'
                  : 'text-sm text-amber-600'
              }
            >
              {t(`extra.securityTxt.${issue.code}`)}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-emerald-600">
          {t('extra.securityTxt.valid')}
        </p>
      )}
    </div>
  );
}
