import { HistoryPanel } from '@/components/history-panel';
import { useToolHistory } from '@/hooks/useToolHistory';
import { createFileRoute } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../components/ui/resizable';

export const Route = createFileRoute('/jwt')({ component: JwtPage });

// ─── shared types ─────────────────────────────────────────────────────────────

type JwtDecoded = {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  raw: { header: string; payload: string; signature: string };
};

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
] as const;

const HMAC_ALGS = new Set(['HS256', 'HS384', 'HS512']);

// ─── helpers ──────────────────────────────────────────────────────────────────

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

/**
 * 使用 Web Crypto API 生成 HMAC-SHA 签名，返回 base64url 编码的签名字符串
 */
async function hmacSign(
  alg: string,
  secret: string,
  data: string,
): Promise<string> {
  const hashAlg = alg.replace('HS', 'SHA-');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: hashAlg },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─── small shared components ──────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

function JwtPage() {
  const { t } = useTranslation();
  const { add } = useToolHistory();

  // ── 左侧：token 文本 ──
  const [token, setToken] = useState('');

  // ── 右侧：结构化表单 ──
  const [alg, setAlg] = useState('HS256');
  const [typ, setTyp] = useState('JWT');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [fields, setFields] = useState<PayloadField[]>([
    { key: 'sub', value: '1234567890', id: 1 },
    { key: 'name', value: 'John Doe', id: 2 },
    { key: 'iat', value: String(Math.floor(Date.now() / 1000)), id: 3 },
  ]);
  const [nextId, setNextId] = useState(4);
  const [signature, setSignature] = useState('');

  // ── 时间 badges（decode 后填充） ──
  const [expInfo, setExpInfo] = useState<{
    text: string;
    expired: boolean;
  } | null>(null);
  const [iatInfo, setIatInfo] = useState<string | null>(null);
  const [nbfInfo, setNbfInfo] = useState<string | null>(null);

  // ── 错误 / loading ──
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isHmac = HMAC_ALGS.has(alg);

  // ── payload 字段操作 ──
  const addField = () => {
    setFields((prev) => [...prev, { key: '', value: '', id: nextId }]);
    setNextId((n) => n + 1);
  };
  const removeField = (id: number) =>
    setFields((prev) => prev.filter((f) => f.id !== id));
  const updateField = (id: number, prop: 'key' | 'value', val: string) =>
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [prop]: val } : f)),
    );

  // ── 左→右：解码 ──
  const decode = () => {
    setError(null);
    try {
      const result = decodeJwt(token);

      // 填充 Header
      setAlg(String(result.header.alg ?? 'HS256'));
      setTyp(String(result.header.typ ?? 'JWT'));

      // 填充 Payload 字段
      let id = nextId;
      const newFields: PayloadField[] = Object.entries(result.payload).map(
        ([k, v]) => ({
          key: k,
          value: typeof v === 'string' ? v : JSON.stringify(v),
          id: id++,
        }),
      );
      setFields(newFields);
      setNextId(id);

      // 填充签名
      setSignature(result.signature);

      // 时间 badges
      setExpInfo(
        result.payload.exp != null
          ? formatExpiry(result.payload.exp as number)
          : null,
      );
      setIatInfo(
        result.payload.iat != null
          ? new Date((result.payload.iat as number) * 1000).toLocaleString()
          : null,
      );
      setNbfInfo(
        result.payload.nbf != null
          ? new Date((result.payload.nbf as number) * 1000).toLocaleString()
          : null,
      );

      // 历史
      const output = JSON.stringify(
        {
          header: result.header,
          payload: result.payload,
          signature: result.signature,
        },
        null,
        2,
      );
      add({
        input: token.trim(),
        output,
        label: token.trim().slice(0, 60),
        preference: { direction: 'decode' },
      });
    } catch (e) {
      setError(t('jwt.decodeError', { msg: (e as Error).message }));
    }
  };

  // ── 右→左：编码 ──
  const encode = async () => {
    setError(null);
    setLoading(true);
    try {
      const header = { alg, typ };
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        if (!f.key.trim()) continue;
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
      const signingInput = `${headerB64}.${payloadB64}`;

      let sig: string;
      if (HMAC_ALGS.has(alg) && secret) {
        sig = await hmacSign(alg, secret, signingInput);
      } else {
        sig = base64UrlEncode('[unsigned]');
      }

      const newToken = `${signingInput}.${sig}`;
      setToken(newToken);
      setSignature(sig);

      // 历史
      const inputSummary = JSON.stringify({ alg, typ, payload });
      add({
        input: inputSummary,
        output: newToken,
        label: inputSummary.slice(0, 60),
        preference: { direction: 'encode' },
      });
    } catch (e) {
      setError(t('jwt.encodeError', { msg: (e as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  // ── 清空 ──
  const clear = () => {
    setToken('');
    setAlg('HS256');
    setTyp('JWT');
    setSecret('');
    setFields([
      { key: 'sub', value: '1234567890', id: 1 },
      { key: 'name', value: 'John Doe', id: 2 },
      { key: 'iat', value: String(Math.floor(Date.now() / 1000)), id: 3 },
    ]);
    setNextId(4);
    setSignature('');
    setExpInfo(null);
    setIatInfo(null);
    setNbfInfo(null);
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">{t('jwt.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('jwt.desc')}</p>
      </div>

      {/* 主布局：左侧 Token + 中间操作栏 + 右侧结构化表单 */}
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-[560px] rounded-lg border"
      >
        {/* ── 左侧：Token 文本 ── */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex flex-col h-full p-4 gap-3">
            <div className="flex items-center justify-between flex-shrink-0">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                JWT Token
              </label>
              {token && <CopyButton text={token} />}
            </div>
            <textarea
              className="flex-1 p-3 font-mono text-sm bg-background border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[120px] break-all"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('jwt.placeholder')}
              spellCheck={false}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── 中间：操作按钮栏（固定宽度） ── */}
        <div className="flex flex-col items-center justify-center gap-3 px-3 py-6 border-l border-r bg-muted/20 w-32 shrink-0">
          <Button
            size="sm"
            className="w-full flex items-center gap-1"
            onClick={decode}
            disabled={!token.trim()}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            {t('jwt.decode')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full flex items-center gap-1"
            onClick={encode}
            disabled={loading}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {loading ? t('jwt.encoding') : t('jwt.encode')}
          </Button>
          <div className="w-full border-t" />
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={clear}
          >
            {t('jwt.clear')}
          </Button>

          {/* 错误提示 */}
          {error && (
            <div className="w-full flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 px-2 py-2 rounded-md">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}
        </div>

        {/* ── 右侧：结构化表单 ── */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="flex flex-col h-full p-4 gap-3 overflow-y-auto">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-shrink-0">
              {t('panel.output')}
            </label>

            {/* 时间 badges */}
            {expInfo && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm flex-shrink-0 ${
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
              <div className="flex gap-4 flex-wrap text-sm text-muted-foreground flex-shrink-0">
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

            {/* Header */}
            <div className="border rounded-lg overflow-hidden flex-shrink-0">
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

            {/* Secret（仅 HMAC 算法） */}
            {isHmac && (
              <div className="border rounded-lg overflow-hidden flex-shrink-0">
                <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-2 border-b">
                  <span className="text-xs font-semibold">
                    {t('jwt.secret')}
                  </span>
                </div>
                <div className="p-3">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {t('jwt.secretLabel')}
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder={t('jwt.secretPlaceholder')}
                      className="w-full px-2 py-1.5 pr-8 text-sm border rounded bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSecret ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {!secret && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {t('jwt.secretEmpty')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Payload */}
            <div className="border rounded-lg overflow-hidden flex-shrink-0">
              <div className="bg-violet-500/10 text-violet-600 dark:text-violet-400 px-3 py-2 border-b flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {t('jwt.payload')}
                </span>
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
                      className="w-24 shrink-0 px-2 py-1 text-sm border rounded bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-muted-foreground">:</span>
                    <input
                      type="text"
                      value={f.value}
                      onChange={(e) =>
                        updateField(f.id, 'value', e.target.value)
                      }
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

            {/* Signature */}
            {signature && (
              <div className="border rounded-lg overflow-hidden flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <span className="text-xs font-semibold">
                    {t('jwt.signature')}
                  </span>
                  <div className="ml-auto">
                    <CopyButton text={signature} />
                  </div>
                </div>
                <div className="p-3 font-mono text-sm bg-background break-all select-all">
                  {signature}
                </div>
              </div>
            )}

            {/* 注释说明 */}
            <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg flex-shrink-0">
              ⚠️{' '}
              {isHmac && secret ? t('jwt.encodeNoteHmac') : t('jwt.noVerify')}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* 历史记录 */}
      <HistoryPanel
        onRestore={(item) => {
          // 尝试按 direction 恢复
          const pref = item.preference as { direction?: string } | null;
          if (pref?.direction === 'decode') {
            setToken(item.inputText ?? '');
          } else if (pref?.direction === 'encode') {
            setToken(item.outputText ?? '');
          } else {
            // 兜底：把 input 当 token 粘贴
            setToken(item.inputText ?? '');
          }
        }}
      />
    </div>
  );
}
