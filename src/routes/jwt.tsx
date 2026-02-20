import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/jwt')({ component: JwtPage });

// ─── shared types ───────────────────────────────────────────────────────────

type JwtDecoded = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  raw: { header: string; payload: string; signature: string };
};

// ─── helpers ────────────────────────────────────────────────────────────────

function base64UrlEncode(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  const padded = str + '==='.slice(0, (4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
  } catch {
    return atob(base64);
  }
}

function decodeJwt(token: string): JwtDecoded {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error(
      '无效的 JWT 格式，应包含 3 个部分（header.payload.signature）',
    );
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64));
  const payload = JSON.parse(base64UrlDecode(payloadB64));
  return {
    header,
    payload,
    signature: sigB64,
    raw: { header: headerB64, payload: payloadB64, signature: sigB64 },
  };
}

function formatExpiry(ts: number): { text: string; expired: boolean } {
  const now = Math.floor(Date.now() / 1000);
  const expired = ts < now;
  const diff = Math.abs(ts - now);
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const timeStr = new Date(ts * 1000).toLocaleString();
  let relative = '';
  if (d > 0) relative = `${d}天${h}小时`;
  else if (h > 0) relative = `${h}小时${m}分钟`;
  else relative = `${m}分钟`;
  return {
    text: `${timeStr} (${expired ? '已过期 ' : '将在 '}${relative}${expired ? '' : '后过期'})`,
    expired,
  };
}

// ─── components ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function JsonBlock({
  title,
  data,
  color,
}: {
  title: string;
  data: Record<string, unknown>;
  color: string;
}) {
  const json = JSON.stringify(data, null, 2);
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${color}`}>
        <span className="text-xs font-semibold">{title}</span>
        <div className="ml-auto">
          <CopyButton text={json} />
        </div>
      </div>
      <pre className="p-3 font-mono text-sm bg-background overflow-x-auto leading-relaxed">
        {json}
      </pre>
    </div>
  );
}

// ─── Decode tab ──────────────────────────────────────────────────────────────

function DecodeTab() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [decoded, setDecoded] = useState<JwtDecoded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decode = () => {
    setError(null);
    setDecoded(null);
    try {
      setDecoded(decodeJwt(input));
    } catch (e) {
      setError(t('jwt.decodeError', { msg: (e as Error).message }));
    }
  };

  const clear = () => {
    setInput('');
    setDecoded(null);
    setError(null);
  };

  const expInfo =
    decoded?.payload?.exp != null
      ? formatExpiry(decoded.payload.exp as number)
      : null;
  const nbfInfo =
    decoded?.payload?.nbf != null
      ? new Date((decoded.payload.nbf as number) * 1000).toLocaleString()
      : null;
  const iatInfo =
    decoded?.payload?.iat != null
      ? new Date((decoded.payload.iat as number) * 1000).toLocaleString()
      : null;

  return (
    <div className="space-y-4">
      <textarea
        className="w-full h-32 p-3 font-mono text-sm bg-background border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('jwt.placeholder')}
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={decode} disabled={!input.trim()}>
          {t('jwt.decode')}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          {t('jwt.clear')}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {decoded && (
        <div className="space-y-3">
          {expInfo && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                expInfo.expired
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
              }`}
            >
              {expInfo.expired ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>
                {t('jwt.exp')}: {expInfo.text}
              </span>
            </div>
          )}
          {(iatInfo || nbfInfo) && (
            <div className="flex gap-4 flex-wrap text-sm text-muted-foreground">
              {iatInfo && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {t('jwt.iat')}: {iatInfo}
                  </span>
                </div>
              )}
              {nbfInfo && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {t('jwt.nbf')}: {nbfInfo}
                  </span>
                </div>
              )}
            </div>
          )}
          <JsonBlock
            title={t('jwt.header')}
            data={decoded.header}
            color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <JsonBlock
            title={t('jwt.payload')}
            data={decoded.payload}
            color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          />
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <span className="text-xs font-semibold">
                {t('jwt.signature')}
              </span>
              <div className="ml-auto">
                <CopyButton text={decoded.signature} />
              </div>
            </div>
            <div className="p-3 font-mono text-sm bg-background break-all select-all">
              {decoded.signature}
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
            ⚠️ {t('jwt.noVerify')}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Encode tab ──────────────────────────────────────────────────────────────

type PayloadField = { key: string; value: string; id: number };

const ALG_OPTIONS = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'none',
];

function EncodeTab() {
  const { t } = useTranslation();
  const [alg, setAlg] = useState('HS256');
  const [typ, setTyp] = useState('JWT');
  const [fields, setFields] = useState<PayloadField[]>([
    { key: 'sub', value: '1234567890', id: 1 },
    { key: 'name', value: 'John Doe', id: 2 },
    { key: 'iat', value: String(Math.floor(Date.now() / 1000)), id: 3 },
  ]);
  const [nextId, setNextId] = useState(4);
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const addField = () => {
    setFields((prev) => [...prev, { key: '', value: '', id: nextId }]);
    setNextId((n) => n + 1);
  };

  const removeField = (id: number) =>
    setFields((prev) => prev.filter((f) => f.id !== id));

  const updateField = (id: number, prop: 'key' | 'value', val: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [prop]: val } : f)),
    );
  };

  const encode = () => {
    setError(null);
    try {
      const header = { alg, typ };
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        if (!f.key.trim()) continue;
        // Try to parse numbers, booleans, JSON objects/arrays
        let val: unknown = f.value;
        if (f.value === 'true') val = true;
        else if (f.value === 'false') val = false;
        else if (f.value !== '' && !isNaN(Number(f.value)))
          val = Number(f.value);
        else {
          try {
            val = JSON.parse(f.value);
          } catch {
            val = f.value;
          }
        }
        payload[f.key.trim()] = val;
      }
      const headerB64 = base64UrlEncode(JSON.stringify(header));
      const payloadB64 = base64UrlEncode(JSON.stringify(payload));
      // Note: signature is unsigned (HMAC requires server-side secret)
      const sigPlaceholder = base64UrlEncode('[signature]');
      setResult(`${headerB64}.${payloadB64}.${sigPlaceholder}`);
    } catch (e) {
      setError(t('jwt.encodeError', { msg: (e as Error).message }));
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const clear = () => {
    setResult('');
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-2 border-b">
          <span className="text-xs font-semibold">{t('jwt.header')}</span>
        </div>
        <div className="p-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              alg
            </label>
            <select
              value={alg}
              onChange={(e) => setAlg(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ALG_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              typ
            </label>
            <input
              type="text"
              value={typ}
              onChange={(e) => setTyp(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Payload fields */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-violet-500/10 text-violet-600 dark:text-violet-400 px-3 py-2 border-b flex items-center justify-between">
          <span className="text-xs font-semibold">{t('jwt.payload')}</span>
          <button
            onClick={addField}
            className="flex items-center gap-1 text-xs hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {t('jwt.addField')}
          </button>
        </div>
        <div className="divide-y">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2">
              <input
                type="text"
                value={f.key}
                onChange={(e) => updateField(f.id, 'key', e.target.value)}
                placeholder={t('jwt.fieldKey')}
                className="w-28 shrink-0 px-2 py-1 text-sm border rounded bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-muted-foreground">:</span>
              <input
                type="text"
                value={f.value}
                onChange={(e) => updateField(f.id, 'value', e.target.value)}
                placeholder={t('jwt.fieldValue')}
                className="flex-1 min-w-0 px-2 py-1 text-sm border rounded bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => removeField(f.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={encode}>
          {t('jwt.encode')}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          {t('jwt.clear')}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b">
            <span className="text-xs font-semibold">{t('jwt.encoded')}</span>
            <div className="ml-auto">
              <button
                onClick={copy}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="p-3 font-mono text-sm bg-background break-all select-all leading-relaxed">
            {result}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
        ⚠️ {t('jwt.encodeNote')}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type JwtTabType = 'decode' | 'encode';

function JwtPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<JwtTabType>('tab', StringParam, 'decode');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('jwt.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('jwt.desc')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as JwtTabType)}>
        <TabsList>
          <TabsTrigger value="decode">{t('jwt.tabDecode')}</TabsTrigger>
          <TabsTrigger value="encode">{t('jwt.tabEncode')}</TabsTrigger>
        </TabsList>
        <TabsContent value="decode" className="mt-4">
          <DecodeTab />
        </TabsContent>
        <TabsContent value="encode" className="mt-4">
          <EncodeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
