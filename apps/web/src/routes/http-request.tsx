import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/http-request')({
  component: HttpRequestPage,
});

type KVPair = { key: string; value: string; enabled: boolean };
type BodyType = 'none' | 'json' | 'form' | 'text';

function newKV(): KVPair {
  return { key: '', value: '', enabled: true };
}

type ResponseResult = {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
  time: number;
  ok: boolean;
};

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-muted transition-colors"
      title={t('httpRequest.responseCopy')}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

function KVEditor({
  pairs,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: {
  pairs: KVPair[];
  onChange: (pairs: KVPair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const { t } = useTranslation();
  const update = (i: number, field: keyof KVPair, val: string | boolean) => {
    const next = pairs.map((p, idx) =>
      idx === i ? { ...p, [field]: val } : p,
    );
    onChange(next);
  };
  const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
  const add = () => onChange([...pairs, newKV()]);

  return (
    <div className="space-y-1.5">
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={pair.enabled}
            onChange={(e) => update(i, 'enabled', e.target.checked)}
            className="w-3.5 h-3.5 shrink-0 accent-primary"
          />
          <input
            value={pair.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1 h-7 px-2 text-xs rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            value={pair.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 h-7 px-2 text-xs rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => remove(i)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        {t('httpRequest.add')}
      </button>
    </div>
  );
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const TABS = ['params', 'headers', 'body'] as const;
type Tab = (typeof TABS)[number];

function statusColor(code: number) {
  if (code < 300) return 'text-green-500';
  if (code < 400) return 'text-yellow-500';
  if (code < 500) return 'text-orange-500';
  return 'text-red-500';
}

function HttpRequestPage() {
  const { t } = useTranslation();
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [tab, setTab] = useState<Tab>('params');
  const [params, setParams] = useState<KVPair[]>([newKV()]);
  const [headers, setHeaders] = useState<KVPair[]>([newKV()]);
  const [bodyType, setBodyType] = useState<BodyType>('none');
  const [bodyText, setBodyText] = useState('{\n  \n}');
  const [formFields, setFormFields] = useState<KVPair[]>([newKV()]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResponseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');
  const [copiedCurl, setCopiedCurl] = useState(false);

  const buildUrl = () => {
    try {
      const enabledParams = params.filter((p) => p.enabled && p.key);
      if (!enabledParams.length) return url;
      const u = new URL(url);
      enabledParams.forEach((p) => u.searchParams.set(p.key, p.value));
      return u.toString();
    } catch {
      return url;
    }
  };

  const send = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    const start = Date.now();
    try {
      const finalUrl = buildUrl();
      const reqHeaders: Record<string, string> = {};
      headers
        .filter((h) => h.enabled && h.key)
        .forEach((h) => (reqHeaders[h.key] = h.value));

      let body: BodyInit | undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        if (bodyType === 'json') {
          body = bodyText;
          if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
            reqHeaders['Content-Type'] = 'application/json';
          }
        } else if (bodyType === 'text') {
          body = bodyText;
        } else if (bodyType === 'form') {
          const fd = new FormData();
          formFields
            .filter((f) => f.enabled && f.key)
            .forEach((f) => fd.append(f.key, f.value));
          body = fd;
        }
      }

      const res = await fetch(finalUrl, {
        method,
        headers: reqHeaders,
        body,
      });

      const time = Date.now() - start;
      const resHeaders: [string, string][] = [];
      res.headers.forEach((v, k) => resHeaders.push([k, v]));
      const resBody = await res.text();

      setResult({
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: resBody,
        time,
        ok: res.ok,
      });
      setResponseTab('body');
    } catch (e) {
      setError(t('httpRequest.sendError', { msg: (e as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  const formattedBody = () => {
    if (!result) return '';
    try {
      return JSON.stringify(JSON.parse(result.body), null, 2);
    } catch {
      return result.body;
    }
  };

  const buildCurl = (): string => {
    const finalUrl = buildUrl();
    const lines: string[] = [`curl -X ${method}`];
    const enabledHeaders = headers.filter((h) => h.enabled && h.key);
    if (
      method !== 'GET' &&
      method !== 'HEAD' &&
      bodyType === 'json' &&
      !enabledHeaders.find((h) => h.key.toLowerCase() === 'content-type')
    ) {
      lines.push(`  -H 'Content-Type: application/json'`);
    }
    enabledHeaders.forEach((h) => lines.push(`  -H '${h.key}: ${h.value}'`));
    if (method !== 'GET' && method !== 'HEAD') {
      if (bodyType === 'json' || bodyType === 'text') {
        const escaped = bodyText.replace(/'/g, `'\\''`);
        lines.push(`  -d '${escaped}'`);
      } else if (bodyType === 'form') {
        formFields
          .filter((f) => f.enabled && f.key)
          .forEach((f) => lines.push(`  -F '${f.key}=${f.value}'`));
      }
    }
    lines.push(`  '${finalUrl}'`);
    return lines.join(' \\\n');
  };

  const copyCurl = async () => {
    await navigator.clipboard.writeText(buildCurl());
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 1500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('httpRequest.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('httpRequest.desc')}
        </p>
      </div>

      {/* URL bar */}
      <div className="flex gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="h-9 px-2 rounded border bg-background text-sm font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-ring min-w-[100px]"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="https://example.com/api"
          className="flex-1 h-9 px-3 text-sm rounded border bg-transparent font-mono focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button
          size="sm"
          onClick={send}
          disabled={loading}
          className="gap-1.5 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {t('httpRequest.send')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={copyCurl}
          className="gap-1.5 shrink-0"
          title={t('httpRequest.copyAsCurl')}
        >
          {copiedCurl ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          cURL
        </Button>
      </div>

      {/* Tabs */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex border-b bg-muted/30">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'params' ? 'Params' : t === 'headers' ? 'Headers' : 'Body'}
            </button>
          ))}
        </div>
        <div className="p-3">
          {tab === 'params' && (
            <KVEditor
              pairs={params}
              onChange={setParams}
              keyPlaceholder={t('httpRequest.paramName')}
              valuePlaceholder={t('httpRequest.value')}
            />
          )}
          {tab === 'headers' && (
            <KVEditor
              pairs={headers}
              onChange={setHeaders}
              keyPlaceholder={t('httpRequest.headerName')}
              valuePlaceholder={t('httpRequest.value')}
            />
          )}
          {tab === 'body' && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {(['none', 'json', 'form', 'text'] as BodyType[]).map((bt) => (
                  <button
                    key={bt}
                    onClick={() => setBodyType(bt)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${bodyType === bt ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {bt === 'none'
                      ? 'None'
                      : bt === 'json'
                        ? 'JSON'
                        : bt === 'form'
                          ? 'Form Data'
                          : 'Text'}
                  </button>
                ))}
              </div>
              {bodyType === 'json' || bodyType === 'text' ? (
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="w-full h-32 px-3 py-2 text-xs font-mono rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                  placeholder={
                    bodyType === 'json'
                      ? t('httpRequest.bodyJsonPlaceholder')
                      : t('httpRequest.bodyTextPlaceholder')
                  }
                />
              ) : bodyType === 'form' ? (
                <KVEditor
                  pairs={formFields}
                  onChange={setFormFields}
                  keyPlaceholder={t('httpRequest.fieldName')}
                  valuePlaceholder={t('httpRequest.value')}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-2">
                  {t('httpRequest.noBody')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-2">
          {error}
        </div>
      )}

      {/* Response */}
      {result && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-3 text-sm">
              <span className={`font-bold ${statusColor(result.status)}`}>
                {result.status}
              </span>
              <span className="text-muted-foreground">{result.statusText}</span>
              <Badge variant="outline" className="text-xs">
                {result.time}ms
              </Badge>
            </div>
            <div className="flex">
              <button
                onClick={() => setResponseTab('body')}
                className={`px-3 py-1 text-xs rounded transition-colors ${responseTab === 'body' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Body
              </button>
              <button
                onClick={() => setResponseTab('headers')}
                className={`px-3 py-1 text-xs rounded transition-colors ${responseTab === 'headers' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Headers ({result.headers.length})
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <CopyButton
                text={
                  responseTab === 'body'
                    ? result.body
                    : result.headers.map(([k, v]) => `${k}: ${v}`).join('\n')
                }
              />
            </div>
            {responseTab === 'body' ? (
              <pre className="p-4 text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap break-all">
                {formattedBody()}
              </pre>
            ) : (
              <div className="p-3 space-y-1 max-h-80 overflow-auto">
                {result.headers.map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs font-mono">
                    <span className="text-blue-500 shrink-0">{k}:</span>
                    <span className="text-muted-foreground break-all">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
