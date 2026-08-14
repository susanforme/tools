import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { importRuntimeModule } from '@/lib/runtime-assets';
import {
  buildGraphqlRequest,
  compareCssSelectors,
  evaluateXPath,
  inspectSaml,
  inspectStreamingManifest,
  parseKubernetesQuantity,
  type ManifestInspection,
  type SamlInspection,
} from '@/lib/tool-expansions';
import { Download, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';

function ErrorText({ value }: { value: string | null }) {
  return value ? (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {value}
    </div>
  ) : null;
}

function Result({ value }: { value: unknown }) {
  return value ? (
    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl border p-3 font-mono text-xs">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  ) : null;
}

export function SamlPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(
    '<samlp:Response Destination="https://sp.example.com/acs"><saml:Issuer>https://idp.example.com</saml:Issuer><saml:Assertion><saml:Subject><saml:NameID>user@example.com</saml:NameID></saml:Subject></saml:Assertion></samlp:Response>',
  );
  const [result, setResult] = useState<SamlInspection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inspect = () => {
    setError(null);
    try {
      setResult(inspectSaml(input));
    } catch (cause) {
      setResult(null);
      setError(t('toolExpansion.failed', { msg: (cause as Error).message }));
    }
  };

  const summary = result
    ? Object.fromEntries(
        Object.entries(result).filter(([key]) => key !== 'xml'),
      )
    : null;

  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-48 font-mono text-xs"
        placeholder={t('toolExpansion.samlPlaceholder')}
      />
      <Button onClick={inspect}>{t('toolExpansion.inspect')}</Button>
      <p className="text-xs text-muted-foreground">
        {t('toolExpansion.samlWarning')}
      </p>
      <ErrorText value={error} />
      <Result value={summary} />
      {result && (
        <Textarea
          readOnly
          value={result.xml}
          className="min-h-64 font-mono text-xs"
        />
      )}
    </div>
  );
}

export function GraphqlPanel() {
  const { t } = useTranslation();
  const [endpoint, setEndpoint] = useState('https://api.example.com/graphql');
  const [query, setQuery] = useState(
    'query User($id: ID!) {\n  user(id: $id) {\n    id\n    name\n  }\n}',
  );
  const [variables, setVariables] = useState('{"id":"42"}');
  const [operationName, setOperationName] = useState('User');
  const [bearerToken, setBearerToken] = useState('');
  const [output, setOutput] = useState<ReturnType<
    typeof buildGraphqlRequest
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  const build = () => {
    setError(null);
    try {
      setOutput(
        buildGraphqlRequest({
          endpoint,
          query,
          variables,
          operationName,
          bearerToken,
        }),
      );
    } catch (cause) {
      setOutput(null);
      setError(t('toolExpansion.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-3">
      <Input
        value={endpoint}
        onChange={(event) => setEndpoint(event.target.value)}
        placeholder={t('toolExpansion.endpoint')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          value={operationName}
          onChange={(event) => setOperationName(event.target.value)}
          placeholder={t('toolExpansion.operationName')}
        />
        <Input
          type="password"
          value={bearerToken}
          onChange={(event) => setBearerToken(event.target.value)}
          placeholder={t('toolExpansion.bearerToken')}
        />
      </div>
      <Textarea
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="min-h-48 font-mono text-xs"
        placeholder="query { viewer { id } }"
      />
      <Textarea
        value={variables}
        onChange={(event) => setVariables(event.target.value)}
        className="min-h-24 font-mono text-xs"
        placeholder="{}"
      />
      <Button onClick={build}>{t('toolExpansion.buildRequest')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function StreamingManifestPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(`#EXTM3U
#EXT-X-VERSION:6
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080,FRAME-RATE=30,CODECS="avc1.640028,mp4a.40.2"
1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=16000000,RESOLUTION=2560x1440,FRAME-RATE=30,CODECS="avc1.640032,mp4a.40.2"
1440p.m3u8`);
  const [result, setResult] = useState<ManifestInspection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inspect = () => {
    setError(null);
    try {
      setResult(inspectStreamingManifest(input));
    } catch (cause) {
      setResult(null);
      setError(t('toolExpansion.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <Textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-h-72 font-mono text-xs"
        placeholder={t('toolExpansion.manifestPlaceholder')}
      />
      <Button onClick={inspect}>{t('toolExpansion.inspect')}</Button>
      <ErrorText value={error} />
      <Result value={result} />
    </div>
  );
}

export function CssSpecificityPanel() {
  const { t } = useTranslation();
  const [left, setLeft] = useState('#app .card > span');
  const [right, setRight] = useState('.layout .card:is(.active, #hero)');
  const [output, setOutput] = useState<ReturnType<
    typeof compareCssSelectors
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compare = () => {
    setError(null);
    try {
      setOutput(compareCssSelectors(left, right));
    } catch (cause) {
      setOutput(null);
      setError(t('toolExpansion.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('toolExpansion.selectorA')}</Label>
          <Input
            value={left}
            onChange={(event) => setLeft(event.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('toolExpansion.selectorB')}</Label>
          <Input
            value={right}
            onChange={(event) => setRight(event.target.value)}
            className="font-mono"
          />
        </div>
      </div>
      <Button onClick={compare}>{t('toolExpansion.compare')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

export function XPathPanel() {
  const { t } = useTranslation();
  const [xml, setXml] = useState(
    '<catalog><book id="1"><title>One</title></book><book id="2"><title>Two</title></book></catalog>',
  );
  const [expression, setExpression] = useState('//book/title/text()');
  const [output, setOutput] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const evaluate = () => {
    setError(null);
    try {
      setOutput(evaluateXPath(xml, expression));
    } catch (cause) {
      setOutput(null);
      setError(t('toolExpansion.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-3">
      <Input
        value={expression}
        onChange={(event) => setExpression(event.target.value)}
        className="font-mono"
        placeholder="//book/title/text()"
      />
      <Textarea
        value={xml}
        onChange={(event) => setXml(event.target.value)}
        className="min-h-64 font-mono text-xs"
      />
      <Button onClick={evaluate}>{t('toolExpansion.evaluate')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}

type BarcodeType = 'code128' | 'ean13' | 'upca';

export function BarcodePanel() {
  const { t } = useTranslation();
  const [type, setType] = useQueryParam<BarcodeType>(
    'barcode',
    StringParam,
    'code128',
  );
  const [text, setText] = useState('123456789012');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const generate = async () => {
    if (!canvasRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const bwip =
        await importRuntimeModule<typeof import('@bwip-js/browser')>(
          'bwipModule',
        );
      bwip.toCanvas(canvasRef.current, {
        bcid: type,
        text,
        scale: 3,
        height: 15,
        includetext: true,
        textxalign: 'center',
      });
    } catch (cause) {
      setError(t('toolExpansion.failed', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const url = canvasRef.current?.toDataURL('image/png');
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${type}.png`;
    anchor.click();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Select
          value={type}
          onValueChange={(value) => setType(value as BarcodeType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="code128">Code 128</SelectItem>
            <SelectItem value="ean13">EAN-13</SelectItem>
            <SelectItem value="upca">UPC-A</SelectItem>
          </SelectContent>
        </Select>
        <Input value={text} onChange={(event) => setText(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading || !text} onClick={() => void generate()}>
          {loading && <LoaderCircle className="animate-spin" />}
          {t('toolExpansion.generate')}
        </Button>
        <Button variant="outline" onClick={download}>
          <Download />
          {t('toolExpansion.download')}
        </Button>
      </div>
      <ErrorText value={error} />
      <div className="overflow-auto rounded-xl border bg-white p-4">
        <canvas ref={canvasRef} className="mx-auto max-w-full" />
      </div>
    </div>
  );
}

export function KubernetesQuantityPanel() {
  const { t } = useTranslation();
  const [cpu, setCpu] = useState('500m');
  const [memory, setMemory] = useState('512Mi');
  const [output, setOutput] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const parse = () => {
    setError(null);
    try {
      setOutput({
        cpu: parseKubernetesQuantity(cpu, 'cpu'),
        memory: parseKubernetesQuantity(memory, 'memory'),
      });
    } catch (cause) {
      setOutput(null);
      setError(t('toolExpansion.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('toolExpansion.cpuQuantity')}</Label>
          <Input
            value={cpu}
            onChange={(event) => setCpu(event.target.value)}
            placeholder="500m"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('toolExpansion.memoryQuantity')}</Label>
          <Input
            value={memory}
            onChange={(event) => setMemory(event.target.value)}
            placeholder="512Mi"
          />
        </div>
      </div>
      <Button onClick={parse}>{t('toolExpansion.convert')}</Button>
      <ErrorText value={error} />
      <Result value={output} />
    </div>
  );
}
