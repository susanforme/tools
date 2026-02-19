import { createFileRoute } from '@tanstack/react-router';
import { CheckCircle2, Info, Loader2, Send, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/cors')({ component: CorsPage });

type CorsResult = {
  ok: boolean;
  mode: 'simple' | 'preflight';
  status?: number;
  corsHeaders: [string, string][];
  allHeaders: [string, string][];
  error?: string;
  time: number;
};

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const CORS_HEADER_NAMES = [
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-allow-credentials',
  'access-control-max-age',
  'access-control-expose-headers',
];

function isPreflightRequired(method: string, customHeaders: string): boolean {
  const safeMethods = ['GET', 'POST', 'HEAD'];
  if (!safeMethods.includes(method.toUpperCase())) return true;
  if (customHeaders.trim()) return true;
  return false;
}

function CorsPage() {
  const { t } = useTranslation();
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [method, setMethod] = useState('GET');
  const [customHeaders, setCustomHeaders] = useState('');
  const [origin, setOrigin] = useState(
    typeof window !== 'undefined' ? window.location.origin : '',
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorsResult | null>(null);

  const test = async () => {
    setLoading(true);
    setResult(null);
    const start = Date.now();
    const needsPreflight = isPreflightRequired(method, customHeaders);

    try {
      const reqHeaders: Record<string, string> = {};
      if (customHeaders.trim()) {
        customHeaders.split('\n').forEach((line) => {
          const idx = line.indexOf(':');
          if (idx > -1) {
            reqHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
        });
      }
      if (origin) reqHeaders['X-Requested-With'] = 'XMLHttpRequest';

      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        mode: 'cors',
      });

      const time = Date.now() - start;
      const allHeaders: [string, string][] = [];
      res.headers.forEach((v, k) => allHeaders.push([k, v]));
      const corsHeaders = allHeaders.filter(([k]) =>
        CORS_HEADER_NAMES.includes(k.toLowerCase()),
      );

      setResult({
        ok: true,
        mode: needsPreflight ? 'preflight' : 'simple',
        status: res.status,
        corsHeaders,
        allHeaders,
        time,
      });
    } catch (e) {
      const time = Date.now() - start;
      setResult({
        ok: false,
        mode: needsPreflight ? 'preflight' : 'simple',
        corsHeaders: [],
        allHeaders: [],
        error: (e as Error).message,
        time,
      });
    } finally {
      setLoading(false);
    }
  };

  const needsPreflight = isPreflightRequired(method, customHeaders);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('cors.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('cors.desc')}</p>
      </div>

      {/* Info */}
      <div className="flex gap-2 items-start rounded-md border bg-blue-500/5 border-blue-500/20 px-4 py-3 text-sm">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-muted-foreground text-xs">{t('cors.note')}</p>
      </div>

      {/* Config */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-9 px-2 rounded border bg-background text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring min-w-[100px]"
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
            onKeyDown={(e) => e.key === 'Enter' && test()}
            placeholder="https://api.example.com/endpoint"
            className="flex-1 h-9 px-3 text-sm rounded border bg-transparent font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            {t('cors.customHeaders')}{' '}
            <span className="text-xs opacity-60">
              （可选，每行一个 Key: Value）
            </span>
          </label>
          <textarea
            value={customHeaders}
            onChange={(e) => setCustomHeaders(e.target.value)}
            placeholder={'X-Custom-Header: value\nAuthorization: Bearer token'}
            className="w-full h-20 px-3 py-2 text-xs font-mono rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={needsPreflight ? 'destructive' : 'secondary'}
            className="text-xs"
          >
            {needsPreflight ? '⚡ 预检请求 (Preflight)' : '✓ 简单请求 (Simple)'}
          </Badge>
          <Button
            size="sm"
            onClick={test}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t('cors.test')}
          </Button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`border rounded-lg overflow-hidden ${result.ok ? 'border-green-500/30' : 'border-destructive/30'}`}
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 ${result.ok ? 'bg-green-500/5' : 'bg-destructive/5'}`}
          >
            {result.ok ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            <div>
              <p
                className={`font-semibold text-sm ${result.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
              >
                {result.ok
                  ? `请求成功（${result.status}）`
                  : 'CORS 被阻止或请求失败'}
              </p>
              <p className="text-xs text-muted-foreground">
                {result.time}ms ·{' '}
                {result.mode === 'preflight' ? '预检请求' : '简单请求'}
              </p>
            </div>
          </div>
          {result.error && (
            <div className="px-4 py-3 text-sm text-destructive font-mono border-t border-destructive/20 bg-destructive/5">
              {result.error}
            </div>
          )}
          {result.corsHeaders.length > 0 && (
            <div className="p-4 border-t space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                CORS 响应头
              </p>
              {result.corsHeaders.map(([k, v]) => (
                <div key={k} className="flex gap-2 font-mono text-xs">
                  <span className="text-green-600 dark:text-green-400 shrink-0">
                    {k}:
                  </span>
                  <span className="text-foreground">{v}</span>
                </div>
              ))}
            </div>
          )}
          {result.ok && result.corsHeaders.length === 0 && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              ⚠️ 请求成功，但响应中未检测到 CORS
              相关头（同源请求或服务端未返回）
            </div>
          )}
          {result.allHeaders.length > 0 && (
            <details className="border-t">
              <summary className="px-4 py-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                查看全部响应头（{result.allHeaders.length} 项）
              </summary>
              <div className="px-4 pb-3 space-y-1">
                {result.allHeaders.map(([k, v]) => (
                  <div key={k} className="flex gap-2 font-mono text-xs">
                    <span className="text-blue-500 shrink-0">{k}:</span>
                    <span className="text-muted-foreground break-all">{v}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Reference */}
      <div className="border rounded-lg p-4 space-y-2">
        <p className="text-sm font-semibold">CORS 请求类型判断</p>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            ✅ <strong>简单请求</strong>：方法为 GET / POST /
            HEAD，且无自定义请求头
          </p>
          <p>
            ⚡ <strong>预检请求</strong>：使用 PUT / DELETE / PATCH
            等方法，或添加了自定义 Header（如 Authorization、Content-Type:
            application/json）
          </p>
          <p>🚫 如果遭到 CORS 阻止，浏览器不会暴露响应内容，工具将显示错误</p>
        </div>
      </div>
    </div>
  );
}
