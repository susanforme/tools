import {
  NumberParam,
  StringParam,
  useQueryParam,
} from '@/hooks/useQueryParams';
import {
  analyzeForwardedHeaders,
  canonicalizeJson,
  diffOpenApi,
  digestCanonicalJson,
  generateAppAssociation,
  generateDsRecord,
  inspectAppAssociation,
  inspectPermissionsPolicy,
  inspectWebManifest,
  matchNginxLocation,
  negotiateContent,
  parseLinkHeader,
  serializeLinkHeader,
  signHttpMessage,
  verifyContentDigest,
  verifyHttpMessageSignature,
  type AppAssociationPlatform,
  type HttpSignatureAlgorithm,
  type NegotiationKind,
} from '@/lib/modern-web-tools';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

function Result({ value }: { value: unknown }) {
  if (value === null || value === '') return null;
  return (
    <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap rounded-xl border p-3 font-mono text-xs">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ErrorText({ value }: { value: string | null }) {
  return value ? (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {value}
    </div>
  ) : null;
}

function ActionError(cause: unknown): string {
  return (cause as Error).message;
}

export function HttpMessageSignaturePanel() {
  const { t } = useTranslation();
  const [algorithm, setAlgorithm] = useQueryParam<HttpSignatureAlgorithm>(
    'signatureAlgorithm',
    StringParam,
    'hmac-sha256',
  );
  const [method, setMethod] = useState('POST');
  const [url, setUrl] = useState('https://api.example.com/items');
  const [body, setBody] = useState('{"name":"tool"}');
  const [key, setKey] = useState('change-me-signing-secret');
  const [output, setOutput] = useState<Awaited<
    ReturnType<typeof signHttpMessage>
  > | null>(null);
  const [verification, setVerification] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sign = async () => {
    setError(null);
    try {
      const result = await signHttpMessage({
        method,
        url,
        body,
        keyMaterial: key,
        algorithm,
      });
      setOutput(result);
      setVerification(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  const verify = async () => {
    if (!output) return;
    setError(null);
    try {
      setVerification(
        (await verifyContentDigest(body, output.contentDigest)) &&
          (await verifyHttpMessageSignature({
            signatureBase: output.signatureBase,
            signature: output.signature,
            keyMaterial: key,
            algorithm,
          })),
      );
    } catch (cause) {
      setVerification(false);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['hmac-sha256', 'rsa-pss-sha512'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={algorithm === value ? 'default' : 'outline'}
            onClick={() => setAlgorithm(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Input
          value={method}
          onChange={(event) => setMethod(event.target.value)}
        />
        <Input value={url} onChange={(event) => setUrl(event.target.value)} />
      </div>
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="min-h-28 font-mono text-xs"
      />
      <Textarea
        value={key}
        onChange={(event) => setKey(event.target.value)}
        className="min-h-24 font-mono text-xs"
        placeholder={
          algorithm === 'hmac-sha256'
            ? t('modern.secret')
            : '-----BEGIN PRIVATE KEY-----'
        }
      />
      <div className="flex gap-2">
        <Button onClick={() => void sign()}>{t('modern.sign')}</Button>
        <Button
          variant="outline"
          disabled={!output}
          onClick={() => void verify()}
        >
          {t('modern.verify')}
        </Button>
      </div>
      {verification !== null && (
        <p
          className={
            verification
              ? 'text-sm text-emerald-600'
              : 'text-sm text-destructive'
          }
        >
          {verification ? t('modern.valid') : t('modern.invalid')}
        </p>
      )}
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function PermissionsPolicyPanel() {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState(
    'Permissions-Policy: camera=(), geolocation=(self)',
  );
  const [reportOnly, setReportOnly] = useState(
    'Permissions-Policy-Report-Only: microphone=();report-to=default',
  );
  const [endpoints, setEndpoints] = useState(
    'Reporting-Endpoints: default="https://example.com/reports"',
  );
  const result = useMemo(
    () => inspectPermissionsPolicy(policy, reportOnly, endpoints),
    [endpoints, policy, reportOnly],
  );
  return (
    <div className="space-y-4">
      <Label>Permissions-Policy</Label>
      <Textarea
        value={policy}
        onChange={(event) => setPolicy(event.target.value)}
        className="font-mono text-xs"
      />
      <Label>Permissions-Policy-Report-Only</Label>
      <Textarea
        value={reportOnly}
        onChange={(event) => setReportOnly(event.target.value)}
        className="font-mono text-xs"
      />
      <Label>Reporting-Endpoints</Label>
      <Textarea
        value={endpoints}
        onChange={(event) => setEndpoints(event.target.value)}
        className="font-mono text-xs"
      />
      <p className="text-sm text-muted-foreground">
        {t('modern.liveAnalysis')}
      </p>
      <Result value={result} />
    </div>
  );
}

export function AppLinksPanel() {
  const { t } = useTranslation();
  const [platform, setPlatform] = useQueryParam<AppAssociationPlatform>(
    'platform',
    StringParam,
    'android',
  );
  const [appId, setAppId] = useState('com.example.app');
  const [fingerprint, setFingerprint] = useState('AA:BB:CC:DD');
  const [path, setPath] = useState('/products/*');
  const [input, setInput] = useState(() =>
    generateAppAssociation('android', appId, fingerprint, path),
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const generate = () => {
    const value = generateAppAssociation(platform, appId, fingerprint, path);
    setInput(value);
    setOutput(null);
    setError(null);
  };
  const inspect = () => {
    try {
      setOutput(inspectAppAssociation(input, platform, path));
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['android', 'apple'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={platform === value ? 'default' : 'outline'}
            onClick={() => setPlatform(value)}
          >
            {value === 'android' ? 'assetlinks.json' : 'AASA'}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={appId}
          onChange={(event) => setAppId(event.target.value)}
          placeholder={
            platform === 'android' ? 'package_name' : 'TEAMID.bundle.id'
          }
        />
        <Input
          value={fingerprint}
          onChange={(event) => setFingerprint(event.target.value)}
          placeholder="SHA-256 fingerprint"
        />
        <Input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/products/*"
        />
      </div>
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-80 font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button onClick={generate}>{t('protocol.generate')}</Button>
        <Button variant="outline" onClick={inspect}>
          {t('protocol.inspect')}
        </Button>
      </div>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function OpenApiDiffPanel() {
  const { t } = useTranslation();
  const [previous, setPrevious] = useState(
    'openapi: 3.1.0\npaths:\n  /users:\n    get:\n      responses:\n        "200": { description: OK }',
  );
  const [next, setNext] = useState('openapi: 3.2.0\npaths: {}');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const parseDocument = async (input: string): Promise<unknown> =>
    input.trim().startsWith('{')
      ? JSON.parse(input)
      : (await import('js-yaml')).load(input);
  const compare = async () => {
    try {
      setOutput(
        diffOpenApi(await parseDocument(previous), await parseDocument(next)),
      );
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={previous}
          onChange={(event) => setPrevious(event.target.value)}
          className="min-h-96 font-mono text-xs"
          placeholder={t('modern.previous')}
        />
        <Textarea
          value={next}
          onChange={(event) => setNext(event.target.value)}
          className="min-h-96 font-mono text-xs"
          placeholder={t('modern.next')}
        />
      </div>
      <Button onClick={() => void compare()}>{t('modern.compare')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function ManifestAuditPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    '{\n  "name": "Example",\n  "start_url": "/",\n  "display": "standalone",\n  "icons": []\n}',
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const inspect = () => {
    try {
      setOutput(inspectWebManifest(JSON.parse(input) as unknown));
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-96 font-mono text-xs"
      />
      <Button onClick={inspect}>{t('protocol.inspect')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function LinkHeaderPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    'Link: </app.js>; rel="preload"; as="script", </page/2>; rel="next"',
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const parse = () => {
    try {
      const entries = parseLinkHeader(input);
      setOutput({
        entries,
        normalized: `Link: ${serializeLinkHeader(entries)}`,
      });
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-32 font-mono text-xs"
      />
      <Button onClick={parse}>{t('protocol.parse')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function ForwardedPanel() {
  const { t } = useTranslation();
  const [trusted, setTrusted] = useQueryParam<number>(
    'trustedProxies',
    NumberParam,
    1,
  );
  const [input, setInput] = useState(
    'Forwarded: for=192.0.2.60;proto=https;host=example.com\nX-Forwarded-For: 203.0.113.5, 192.0.2.60\nVia: 1.1 proxy',
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const analyze = () => {
    try {
      setOutput(analyzeForwardedHeaders(input, trusted));
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <div className="max-w-48 space-y-2">
        <Label>{t('modern.trustedProxies')}</Label>
        <Input
          type="number"
          min={0}
          value={trusted}
          onChange={(event) => setTrusted(Number(event.target.value))}
        />
      </div>
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-48 font-mono text-xs"
      />
      <Button onClick={analyze}>{t('protocol.inspect')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function JcsPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState('{"b":2,"a":1}');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const canonicalize = async () => {
    try {
      setOutput({
        canonical: canonicalizeJson(input),
        sha256: await digestCanonicalJson(input),
      });
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-72 font-mono text-xs"
      />
      <Button onClick={() => void canonicalize()}>
        {t('modern.canonicalize')}
      </Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function ContentNegotiationPanel() {
  const { t } = useTranslation();
  const [kind, setKind] = useQueryParam<NegotiationKind>(
    'negotiationKind',
    StringParam,
    'media',
  );
  const [accept, setAccept] = useState(
    'text/html, application/json;q=0.9, */*;q=0.1',
  );
  const [available, setAvailable] = useState('application/json\ntext/plain');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    try {
      setOutput(negotiateContent(accept, available, kind));
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['media', 'language', 'encoding'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={kind === value ? 'default' : 'outline'}
            onClick={() => setKind(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      <Label>Accept</Label>
      <Textarea
        value={accept}
        onChange={(event) => setAccept(event.target.value)}
        className="font-mono text-xs"
      />
      <Label>{t('modern.available')}</Label>
      <Textarea
        value={available}
        onChange={(event) => setAvailable(event.target.value)}
        className="min-h-32 font-mono text-xs"
      />
      <Button onClick={run}>{t('modern.negotiate')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function NginxMatcherPanel() {
  const { t } = useTranslation();
  const [uri, setUri] = useState('/images/logo.png');
  const [config, setConfig] = useState(
    'location = / { }\nlocation ^~ /images/ { }\nlocation ~* \\.(png|jpg)$ { }\nlocation / { }',
  );
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const match = () => {
    try {
      setOutput(matchNginxLocation(config, uri));
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <Input
        value={uri}
        onChange={(event) => setUri(event.target.value)}
        placeholder="/path"
      />
      <Textarea
        value={config}
        onChange={(event) => setConfig(event.target.value)}
        className="min-h-72 font-mono text-xs"
      />
      <Button onClick={match}>{t('modern.match')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function DnssecPanel() {
  const { t } = useTranslation();
  const [digestType, setDigestType] = useQueryParam<2 | 4>(
    'digestType',
    NumberParam,
    2,
  );
  const [owner, setOwner] = useState('example.com');
  const [dnskey, setDnskey] = useState('257 3 8 AwEAAc8=');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const generate = async () => {
    try {
      setOutput(await generateDsRecord(owner, dnskey, digestType));
      setError(null);
    } catch (cause) {
      setOutput(null);
      setError(ActionError(cause));
    }
  };
  return (
    <div className="space-y-4">
      <Input
        value={owner}
        onChange={(event) => setOwner(event.target.value)}
        placeholder="example.com"
      />
      <Textarea
        value={dnskey}
        onChange={(event) => setDnskey(event.target.value)}
        className="min-h-32 font-mono text-xs"
        placeholder="257 3 8 ..."
      />
      <div className="flex gap-2">
        {([2, 4] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={digestType === value ? 'default' : 'outline'}
            onClick={() => setDigestType(value)}
          >
            {value === 2 ? 'SHA-256' : 'SHA-384'}
          </Button>
        ))}
      </div>
      <Button onClick={() => void generate()}>{t('protocol.generate')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}
