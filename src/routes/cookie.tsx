import { createFileRoute } from '@tanstack/react-router';
import { Cookie } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/cookie')({ component: CookiePage });

type ParsedCookie = {
  name: string;
  value: string;
  flags: string[];
};

function parseCookieString(raw: string): ParsedCookie[] {
  // Cookie header format: name=value; name2=value2
  // Set-Cookie format: name=value; Path=/; HttpOnly; Secure; SameSite=None; Expires=...
  const result: ParsedCookie[] = [];
  if (!raw.trim()) return result;

  // Try parsing as Cookie header (multiple pairs)
  const looksLikeSetCookie =
    /;\s*(path|domain|expires|max-age|httponly|secure|samesite)/i.test(raw);

  if (looksLikeSetCookie) {
    // Parse single Set-Cookie header
    const parts = raw.split(/;\s*/);
    const [nameVal, ...rest] = parts;
    const eqIdx = nameVal.indexOf('=');
    const name = eqIdx > -1 ? nameVal.slice(0, eqIdx).trim() : nameVal.trim();
    const value = eqIdx > -1 ? nameVal.slice(eqIdx + 1).trim() : '';
    const flags = rest.map((r) => r.trim()).filter(Boolean);
    result.push({ name, value, flags });
  } else {
    // Parse as Cookie header (multiple pairs separated by ;)
    raw.split(';').forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const eqIdx = trimmed.indexOf('=');
      const name = eqIdx > -1 ? trimmed.slice(0, eqIdx).trim() : trimmed;
      const value = eqIdx > -1 ? trimmed.slice(eqIdx + 1).trim() : '';
      result.push({ name, value, flags: [] });
    });
  }
  return result;
}

function flagBadge(flag: string) {
  const lower = flag.toLowerCase();
  if (lower === 'httponly')
    return (
      <Badge
        key={flag}
        variant="secondary"
        className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      >
        HttpOnly
      </Badge>
    );
  if (lower === 'secure')
    return (
      <Badge
        key={flag}
        variant="secondary"
        className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      >
        Secure
      </Badge>
    );
  if (lower.startsWith('samesite')) {
    const val = flag.split('=')[1] ?? '';
    return (
      <Badge
        key={flag}
        variant="secondary"
        className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      >
        SameSite={val}
      </Badge>
    );
  }
  if (lower.startsWith('expires'))
    return (
      <Badge key={flag} variant="outline" className="text-xs">
        {flag}
      </Badge>
    );
  if (lower.startsWith('max-age'))
    return (
      <Badge key={flag} variant="outline" className="text-xs">
        {flag}
      </Badge>
    );
  if (lower.startsWith('path'))
    return (
      <Badge key={flag} variant="outline" className="text-xs">
        {flag}
      </Badge>
    );
  if (lower.startsWith('domain'))
    return (
      <Badge key={flag} variant="outline" className="text-xs">
        {flag}
      </Badge>
    );
  return (
    <Badge key={flag} variant="outline" className="text-xs">
      {flag}
    </Badge>
  );
}

function CookieTable({ cookies }: { cookies: ParsedCookie[] }) {
  if (!cookies.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        暂无 Cookie
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {cookies.map((c, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Cookie className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-mono text-sm font-semibold">{c.name}</span>
            {c.flags.map((f) => flagBadge(f))}
          </div>
          <div className="font-mono text-xs text-muted-foreground break-all bg-muted/40 rounded px-2 py-1">
            {c.value || <span className="opacity-50 italic">（空值）</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function CookiePage() {
  const { t } = useTranslation();
  const [rawInput, setRawInput] = useState('');
  const [parsedFromInput, setParsedFromInput] = useState<ParsedCookie[]>([]);
  const [parsed, setParsed] = useState(false);

  const parse = () => {
    setParsedFromInput(parseCookieString(rawInput));
    setParsed(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('cookie.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('cookie.desc')}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            {t('cookie.pasteLabel')}
          </label>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={`示例 1（Cookie 请求头）：\nsessionId=abc123; userId=42; theme=dark\n\n示例 2（Set-Cookie 响应头）：\nsessionId=abc123; Path=/; HttpOnly; Secure; SameSite=None; Expires=Thu, 01 Jan 2026 00:00:00 GMT`}
            className="w-full h-32 px-3 py-2 text-xs font-mono rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </div>
        <Button size="sm" onClick={parse}>
          {t('cookie.parse')}
        </Button>
      </div>

      {parsed && parsedFromInput.length > 0 && (
        <CookieTable cookies={parsedFromInput} />
      )}
      {parsed && parsedFromInput.length === 0 && rawInput.trim() && (
        <p className="text-sm text-muted-foreground py-2">
          {t('cookie.noResult')}
        </p>
      )}

      {/* Reference */}
      <div className="border rounded-lg p-4 space-y-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">
          {t('cookie.attrTitle')}
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {[
            ['HttpOnly', '禁止 JavaScript 访问，防止 XSS 窃取'],
            ['Secure', '仅通过 HTTPS 传输'],
            ['SameSite=Strict', '不随跨站请求发送'],
            ['SameSite=Lax', '跨站导航时发送（GET）'],
            ['SameSite=None', '始终发送，需配合 Secure'],
            ['Expires / Max-Age', 'Cookie 过期时间'],
            ['Domain', '指定 Cookie 作用域名'],
            ['Path', '指定 Cookie 作用路径'],
          ].map(([attr, desc]) => (
            <div key={attr} className="flex gap-2">
              <code className="shrink-0 bg-muted px-1 rounded text-foreground">
                {attr}
              </code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
