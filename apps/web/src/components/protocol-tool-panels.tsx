import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  analyzeRateLimitHeaders,
  ascii85Decode,
  ascii85Encode,
  base58Decode,
  base58Encode,
  bech32Decode,
  bech32Encode,
  buildContentDisposition,
  buildEmailPolicies,
  decodeSnowflake,
  generateHreflang,
  generateJsonSchemaExample,
  generateSnowflake,
  generateTraceparent,
  inspectDnsZone,
  inspectEmailPolicies,
  inspectMultipart,
  intlPreview,
  matchCertificateKey,
  parseBaggage,
  parseContentDisposition,
  parseHreflangEntries,
  parseStructuredField,
  parseStructuredLogs,
  parseTraceparent,
  parseTracestate,
  queryMarkup,
  restoreStackTrace,
  serializeBaggage,
} from '@/lib/protocol-tools';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </div>
  ) : null;
}

function Result({ value }: { value: unknown }) {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text ? (
    <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-xl border p-3 font-mono text-xs">
      {text}
    </pre>
  ) : null;
}

function ModeButtons<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <Button
          key={key}
          size="sm"
          variant={value === key ? 'default' : 'outline'}
          onClick={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

export function TraceContextPanel() {
  const { t } = useTranslation();
  const [traceparent, setTraceparent] = useState(
    '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  );
  const [tracestate, setTracestate] = useState('rojo=00f067aa0ba902b7');
  const [baggage, setBaggage] = useState('userId=alice,serverNode=DF%2028');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const parse = () => {
    setError(null);
    try {
      const baggageMembers = parseBaggage(baggage);
      setOutput({
        traceparent: parseTraceparent(traceparent),
        tracestate: parseTracestate(tracestate),
        baggage: baggageMembers,
        normalizedBaggage: serializeBaggage(baggageMembers),
      });
    } catch (cause) {
      setOutput(null);
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  const generate = (sampled: boolean) => {
    const value = generateTraceparent(sampled);
    setTraceparent(value);
    setOutput(parseTraceparent(value));
    setError(null);
  };
  return (
    <div className="space-y-4">
      <Input
        value={traceparent}
        onChange={(event) => setTraceparent(event.target.value)}
      />
      <Textarea
        value={tracestate}
        onChange={(event) => setTracestate(event.target.value)}
        className="min-h-24 font-mono text-xs"
        placeholder="tracestate"
      />
      <Textarea
        value={baggage}
        onChange={(event) => setBaggage(event.target.value)}
        className="min-h-24 font-mono text-xs"
        placeholder="baggage"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={parse}>{t('protocol.parse')}</Button>
        <Button variant="outline" onClick={() => generate(true)}>
          {t('protocol.trace.generateSampled')}
        </Button>
        <Button variant="outline" onClick={() => generate(false)}>
          {t('protocol.trace.generateUnsampled')}
        </Button>
      </div>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function SourceMapStackPanel() {
  const { t } = useTranslation();
  const [sourceMap, setSourceMap] = useState('');
  const [stack, setStack] = useState(
    'Error: example\n    at run (app.min.js:1:1)',
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    try {
      setOutput((await restoreStackTrace(sourceMap, stack)).stack);
    } catch (cause) {
      setOutput('');
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".map,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void file.text().then(setSourceMap);
        }}
      />
      <Textarea
        value={sourceMap}
        onChange={(event) => setSourceMap(event.target.value)}
        className="min-h-44 font-mono text-xs"
        placeholder={t('protocol.sourceMap.map')}
      />
      <Textarea
        value={stack}
        onChange={(event) => setStack(event.target.value)}
        className="min-h-44 font-mono text-xs"
        placeholder={t('protocol.sourceMap.stack')}
      />
      <Button
        disabled={!sourceMap.trim() || !stack.trim()}
        onClick={() => void run()}
      >
        {t('protocol.sourceMap.restore')}
      </Button>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function StructuredFieldPanel() {
  const { t } = useTranslation();
  const [type, setType] = useQueryParam<'item' | 'list' | 'dictionary'>(
    'sfType',
    StringParam,
    'dictionary',
  );
  const [input, setInput] = useState('priority=u=3, enabled=?1');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    try {
      setOutput(await parseStructuredField(input, type));
    } catch (cause) {
      setOutput(null);
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <ModeButtons
        value={type}
        onChange={setType}
        options={[
          ['item', 'Item'],
          ['list', 'List'],
          ['dictionary', 'Dictionary'],
        ]}
      />
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-36 font-mono"
      />
      <Button onClick={() => void run()}>{t('protocol.parse')}</Button>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function RateLimitPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    'RateLimit-Policy: "api";q=100;w=60\nRateLimit: "api";r=12;t=48\nRetry-After: 48',
  );
  const result = useMemo(() => analyzeRateLimitHeaders(input), [input]);
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-56 font-mono text-xs"
      />
      <p className="text-sm text-muted-foreground">
        {t('protocol.rateLimit.note')}
      </p>
      <Result value={result} />
    </div>
  );
}

export function ContentDispositionPanel() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<'parse' | 'build'>(
    'dispositionMode',
    StringParam,
    'parse',
  );
  const [input, setInput] = useState(
    "attachment; filename=report.txt; filename*=UTF-8''%E6%B5%8B%E8%AF%95.txt",
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setError(null);
    try {
      setOutput(
        mode === 'parse'
          ? parseContentDisposition(input)
          : buildContentDisposition(input, 'attachment'),
      );
    } catch (cause) {
      setOutput(null);
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <ModeButtons
        value={mode}
        onChange={setMode}
        options={[
          ['parse', t('protocol.parse')],
          ['build', t('protocol.generate')],
        ]}
      />
      <Input value={input} onChange={(event) => setInput(event.target.value)} />
      <Button onClick={run}>
        {mode === 'parse' ? t('protocol.parse') : t('protocol.generate')}
      </Button>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function MultipartPanel() {
  const { t } = useTranslation();
  const [boundary, setBoundary] = useState('example');
  const [input, setInput] = useState(
    '--example\r\nContent-Disposition: form-data; name="title"\r\n\r\nhello\r\n--example--',
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setError(null);
    try {
      setOutput(inspectMultipart(input, boundary));
    } catch (cause) {
      setOutput(null);
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <Input
        value={boundary}
        onChange={(event) => setBoundary(event.target.value)}
        placeholder="boundary"
      />
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-80 font-mono text-xs"
      />
      <Button onClick={run}>{t('protocol.inspect')}</Button>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function KeyPairMatchPanel() {
  const { t } = useTranslation();
  const [certificate, setCertificate] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    try {
      setOutput(await matchCertificateKey(certificate, privateKey));
    } catch (cause) {
      setOutput(null);
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <Textarea
        value={certificate}
        onChange={(event) => setCertificate(event.target.value)}
        className="min-h-52 font-mono text-xs"
        placeholder={t('protocol.keyMatch.certificate')}
      />
      <Textarea
        value={privateKey}
        onChange={(event) => setPrivateKey(event.target.value)}
        className="min-h-52 font-mono text-xs"
        placeholder={t('protocol.keyMatch.privateKey')}
      />
      <Button
        disabled={!certificate.trim() || !privateKey.trim()}
        onClick={() => void run()}
      >
        {t('protocol.keyMatch.match')}
      </Button>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function DnsZonePanel() {
  const [input, setInput] = useState(
    '$ORIGIN example.com.\n$TTL 3600\n@ IN SOA ns.example.com. hostmaster.example.com. (1 3600 600 604800 300)\n@ IN NS ns.example.com.\nwww IN A 192.0.2.1',
  );
  const result = useMemo(() => inspectDnsZone(input), [input]);
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-96 font-mono text-xs"
      />
      <Result value={result} />
    </div>
  );
}

export function EmailPolicyPanel() {
  const { t } = useTranslation();
  const [spf, setSpf] = useState('v=spf1 mx include:_spf.example.com -all');
  const [dmarc, setDmarc] = useState(
    'v=DMARC1; p=reject; rua=mailto:dmarc@example.com',
  );
  const [includes, setIncludes] = useState('_spf.example.com');
  const report = useMemo(() => inspectEmailPolicies(spf, dmarc), [spf, dmarc]);
  const generate = () => {
    const value = buildEmailPolicies({
      domains: includes.split(/[\s,]+/).filter(Boolean),
      includeMx: true,
      policy: 'reject',
      rua: 'dmarc@example.com',
    });
    setSpf(value.spf);
    setDmarc(value.dmarc);
  };
  return (
    <div className="space-y-4">
      <Input
        value={includes}
        onChange={(event) => setIncludes(event.target.value)}
        placeholder={t('protocol.emailPolicy.includes')}
      />
      <Button variant="outline" onClick={generate}>
        {t('protocol.generate')}
      </Button>
      <Textarea
        value={spf}
        onChange={(event) => setSpf(event.target.value)}
        className="min-h-24 font-mono text-xs"
      />
      <Textarea
        value={dmarc}
        onChange={(event) => setDmarc(event.target.value)}
        className="min-h-24 font-mono text-xs"
      />
      <Result value={report} />
    </div>
  );
}

type BaseVariant = 'base58' | 'ascii85' | 'bech32';

export function BaseEncodingPanel() {
  const { t } = useTranslation();
  const [variant, setVariant] = useQueryParam<BaseVariant>(
    'baseVariant',
    StringParam,
    'base58',
  );
  const [direction, setDirection] = useQueryParam<'encode' | 'decode'>(
    'baseDirection',
    StringParam,
    'encode',
  );
  const [hrp, setHrp] = useState('tool');
  const [input, setInput] = useState('hello');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setError(null);
    try {
      if (direction === 'encode') {
        const bytes = new TextEncoder().encode(input);
        setOutput(
          variant === 'base58'
            ? base58Encode(bytes)
            : variant === 'ascii85'
              ? ascii85Encode(bytes)
              : bech32Encode(hrp, bytes),
        );
      } else {
        const bytes =
          variant === 'base58'
            ? base58Decode(input)
            : variant === 'ascii85'
              ? ascii85Decode(input)
              : bech32Decode(input).bytes;
        setOutput(new TextDecoder().decode(bytes));
      }
    } catch (cause) {
      setOutput('');
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <ModeButtons
        value={variant}
        onChange={setVariant}
        options={[
          ['base58', 'Base58'],
          ['ascii85', 'Ascii85'],
          ['bech32', 'Bech32'],
        ]}
      />
      <ModeButtons
        value={direction}
        onChange={setDirection}
        options={[
          ['encode', t('protocol.encode')],
          ['decode', t('protocol.decode')],
        ]}
      />
      {variant === 'bech32' && direction === 'encode' && (
        <Input
          value={hrp}
          onChange={(event) => setHrp(event.target.value)}
          placeholder="HRP"
        />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-64 font-mono text-xs"
        />
        <Textarea
          readOnly
          value={output}
          className="min-h-64 font-mono text-xs"
        />
      </div>
      <Button onClick={run}>
        {direction === 'encode' ? t('protocol.encode') : t('protocol.decode')}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

const SNOWFLAKE_EPOCHS = {
  discord: 1420070400000,
  twitter: 1288834974657,
} as const;

export function SnowflakePanel() {
  const { t } = useTranslation();
  const [platform, setPlatform] = useQueryParam<keyof typeof SNOWFLAKE_EPOCHS>(
    'snowflakePlatform',
    StringParam,
    'discord',
  );
  const [input, setInput] = useState('175928847299117063');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const decode = () => {
    setError(null);
    try {
      setOutput(decodeSnowflake(input, SNOWFLAKE_EPOCHS[platform]));
    } catch (cause) {
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  const generate = () => {
    const value = generateSnowflake(SNOWFLAKE_EPOCHS[platform], 0, 0);
    setInput(value);
    setOutput(decodeSnowflake(value, SNOWFLAKE_EPOCHS[platform]));
  };
  return (
    <div className="space-y-4">
      <ModeButtons
        value={platform}
        onChange={setPlatform}
        options={[
          ['discord', 'Discord'],
          ['twitter', 'Twitter'],
        ]}
      />
      <Input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="font-mono"
      />
      <div className="flex gap-2">
        <Button onClick={decode}>{t('protocol.decode')}</Button>
        <Button variant="outline" onClick={generate}>
          {t('protocol.generate')}
        </Button>
      </div>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function StructuredLogPanel() {
  const { t } = useTranslation();
  const [type, setType] = useQueryParam<'logfmt' | 'syslog'>(
    'logType',
    StringParam,
    'logfmt',
  );
  const [input, setInput] = useState(
    'level=info status=200 message="request complete"',
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setError(null);
    try {
      setOutput(parseStructuredLogs(input, type));
    } catch (cause) {
      setOutput(null);
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <ModeButtons
        value={type}
        onChange={setType}
        options={[
          ['logfmt', 'logfmt'],
          ['syslog', 'Syslog'],
        ]}
      />
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-72 font-mono text-xs"
      />
      <Button onClick={run}>{t('protocol.parse')}</Button>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function IntlPlaygroundPanel() {
  const { t } = useTranslation();
  const [locale, setLocale] = useQueryParam<string>(
    'intlLocale',
    StringParam,
    'zh-CN',
  );
  const [currency, setCurrency] = useQueryParam<string>(
    'intlCurrency',
    StringParam,
    'CNY',
  );
  const [number, setNumber] = useState('2');
  let error: string | null = null;
  let output: unknown = null;
  try {
    output = intlPreview({
      locale,
      currency,
      number: Number(number),
      date: new Date(),
    });
  } catch (cause) {
    error ??= (cause as Error).message;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
          placeholder={t('protocol.intl.locale')}
        />
        <Input
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          placeholder={t('protocol.intl.currency')}
        />
        <Input
          type="number"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
        />
      </div>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function MarkupQueryPanel() {
  const { t } = useTranslation();
  const [type, setType] = useQueryParam<'selector' | 'xpath'>(
    'queryType',
    StringParam,
    'selector',
  );
  const [input, setInput] = useState(
    '<main><article><h2>Hello</h2></article></main>',
  );
  const [query, setQuery] = useState('main article > h2');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setError(null);
    try {
      setOutput(queryMarkup(input, query, type));
    } catch (cause) {
      setOutput(null);
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <ModeButtons
        value={type}
        onChange={(value) => {
          setType(value);
          setQuery(value === 'selector' ? 'main article > h2' : '//h2');
        }}
        options={[
          ['selector', 'CSS Selector'],
          ['xpath', 'XPath'],
        ]}
      />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} />
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-72 font-mono text-xs"
      />
      <Button onClick={run}>{t('protocol.query')}</Button>
      <ErrorText error={error} />
      <Result value={output} />
    </div>
  );
}

export function HreflangPanel() {
  const { t } = useTranslation();
  const [format, setFormat] = useQueryParam<'html' | 'header' | 'sitemap'>(
    'hreflangFormat',
    StringParam,
    'html',
  );
  const [input, setInput] = useState(
    'en https://example.com/en\nzh-CN https://example.com/zh\nx-default https://example.com/',
  );
  const parsed = useMemo(() => parseHreflangEntries(input), [input]);
  const output = parsed.issues.length
    ? ''
    : generateHreflang(parsed.entries, format);
  return (
    <div className="space-y-4">
      <ModeButtons
        value={format}
        onChange={setFormat}
        options={[
          ['html', 'HTML'],
          ['header', 'HTTP Header'],
          ['sitemap', 'Sitemap'],
        ]}
      />
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-44 font-mono text-xs"
      />
      {parsed.issues.length > 0 && <Result value={parsed.issues} />}
      <Result value={output} />
      <p className="text-xs text-muted-foreground">
        {t('protocol.hreflang.format')}
      </p>
    </div>
  );
}

export function JsonSchemaExamplePanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    JSON.stringify(
      {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          active: { type: 'boolean', default: true },
        },
      },
      null,
      2,
    ),
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setError(null);
    try {
      setOutput(generateJsonSchemaExample(input));
    } catch (cause) {
      setOutput(null);
      setError(t('protocol.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-96 font-mono text-xs"
        />
        <Textarea
          readOnly
          value={output === null ? '' : JSON.stringify(output, null, 2)}
          className="min-h-96 font-mono text-xs"
        />
      </div>
      <Button onClick={run}>{t('protocol.schema.generate')}</Button>
      <ErrorText error={error} />
    </div>
  );
}
