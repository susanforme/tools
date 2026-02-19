import { createFileRoute } from '@tanstack/react-router';
import {
  Check,
  Copy,
  Cpu,
  Globe,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/user-agent')({
  component: UserAgentPage,
});

type UAParsed = {
  browser: { name: string; version: string };
  engine: { name: string; version: string };
  os: { name: string; version: string };
  device: {
    type: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
    vendor: string;
    model: string;
  };
  raw: string;
};

// --- Lightweight UA parser (no external dep) ---

function extractVersion(ua: string, pattern: RegExp): string {
  const m = pattern.exec(ua);
  if (!m) return '';
  return (m[1] ?? '').replace(/_/g, '.');
}

function parseUA(ua: string): UAParsed {
  if (!ua.trim()) {
    return {
      browser: { name: '', version: '' },
      engine: { name: '', version: '' },
      os: { name: '', version: '' },
      device: { type: 'unknown', vendor: '', model: '' },
      raw: ua,
    };
  }

  // Bot detection
  const isBot =
    /bot|crawler|spider|slurp|curl|wget|python-requests|go-http|java\/|okhttp|axios|libcurl/i.test(
      ua,
    );

  // OS
  let osName = '';
  let osVersion = '';
  if (/Windows/i.test(ua)) {
    osName = 'Windows';
    const ntMatch = /Windows NT ([\d.]+)/i.exec(ua);
    const ntVer = ntMatch?.[1] ?? '';
    const ntMap: Record<string, string> = {
      '10.0': '10 / 11',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
      '6.0': 'Vista',
      '5.2': 'XP x64',
      '5.1': 'XP',
    };
    osVersion = ntMap[ntVer] ?? ntVer;
  } else if (/Mac OS X|macOS/i.test(ua)) {
    osName = 'macOS';
    osVersion = extractVersion(ua, /Mac OS X ([\d_.]+)/i);
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    osName = 'iOS';
    osVersion = extractVersion(ua, /OS ([\d_]+)/i);
  } else if (/Android/i.test(ua)) {
    osName = 'Android';
    osVersion = extractVersion(ua, /Android ([\d.]+)/i);
  } else if (/Linux/i.test(ua)) {
    osName = 'Linux';
    if (/Ubuntu/i.test(ua)) osName = 'Ubuntu';
    else if (/Fedora/i.test(ua)) osName = 'Fedora';
    else if (/Debian/i.test(ua)) osName = 'Debian';
  } else if (/CrOS/i.test(ua)) {
    osName = 'Chrome OS';
  }

  // Browser
  let browserName = '';
  let browserVersion = '';
  if (/Edg\//i.test(ua)) {
    browserName = 'Microsoft Edge';
    browserVersion = extractVersion(ua, /Edg\/([\d.]+)/i);
  } else if (/OPR\//i.test(ua) || /Opera\//i.test(ua)) {
    browserName = 'Opera';
    browserVersion = extractVersion(ua, /(?:OPR|Opera)\/([\d.]+)/i);
  } else if (/YaBrowser/i.test(ua)) {
    browserName = 'Yandex Browser';
    browserVersion = extractVersion(ua, /YaBrowser\/([\d.]+)/i);
  } else if (/SamsungBrowser/i.test(ua)) {
    browserName = 'Samsung Browser';
    browserVersion = extractVersion(ua, /SamsungBrowser\/([\d.]+)/i);
  } else if (/UCBrowser/i.test(ua)) {
    browserName = 'UC Browser';
    browserVersion = extractVersion(ua, /UCBrowser\/([\d.]+)/i);
  } else if (/Firefox\//i.test(ua)) {
    browserName = 'Firefox';
    browserVersion = extractVersion(ua, /Firefox\/([\d.]+)/i);
  } else if (/Chrome\//i.test(ua)) {
    browserName = 'Chrome';
    browserVersion = extractVersion(ua, /Chrome\/([\d.]+)/i);
  } else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) {
    browserName = 'Safari';
    browserVersion = extractVersion(ua, /Version\/([\d.]+)/i);
  } else if (/MSIE |Trident\/.*rv:/i.test(ua)) {
    browserName = 'Internet Explorer';
    browserVersion = extractVersion(ua, /(?:MSIE |rv:)([\d.]+)/i);
  } else if (isBot) {
    const botMatch = /^([^\s/]+)/i.exec(ua.trim());
    browserName = botMatch?.[1] ?? 'Bot';
    browserVersion = '';
  }

  // Engine
  let engineName = '';
  let engineVersion = '';
  if (/Gecko\//i.test(ua) && /Firefox/i.test(ua)) {
    engineName = 'Gecko';
    engineVersion = extractVersion(ua, /Gecko\/([\d.]+)/i);
  } else if (/AppleWebKit\//i.test(ua)) {
    engineName = 'WebKit';
    engineVersion = extractVersion(ua, /AppleWebKit\/([\d.]+)/i);
    if (/Blink/i.test(ua) || /Chrome\//i.test(ua)) {
      engineName = 'Blink';
    }
  } else if (/Trident\//i.test(ua)) {
    engineName = 'Trident';
    engineVersion = extractVersion(ua, /Trident\/([\d.]+)/i);
  }

  // Device
  let deviceType: UAParsed['device']['type'] = 'desktop';
  let vendor = '';
  let model = '';

  if (isBot) {
    deviceType = 'bot';
  } else if (/iPad/i.test(ua)) {
    deviceType = 'tablet';
    vendor = 'Apple';
    model = 'iPad';
  } else if (/iPhone/i.test(ua)) {
    deviceType = 'mobile';
    vendor = 'Apple';
    model = 'iPhone';
  } else if (/iPod/i.test(ua)) {
    deviceType = 'mobile';
    vendor = 'Apple';
    model = 'iPod';
  } else if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) {
      deviceType = 'mobile';
      const modelMatch = /;\s*([^;)]+)\sBuild\//i.exec(ua);
      model = modelMatch?.[1]?.trim() ?? '';
      if (/Samsung|SM-/i.test(ua)) vendor = 'Samsung';
      else if (/Huawei|HW-|EVA-/i.test(ua)) vendor = 'Huawei';
      else if (/Xiaomi|MI\s|Redmi/i.test(ua)) vendor = 'Xiaomi';
      else if (/OPPO/i.test(ua)) vendor = 'OPPO';
      else if (/vivo/i.test(ua)) vendor = 'vivo';
      else if (/OnePlus/i.test(ua)) vendor = 'OnePlus';
    } else {
      deviceType = 'tablet';
    }
  } else if (/Mobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  return {
    browser: { name: browserName, version: browserVersion },
    engine: { name: engineName, version: engineVersion },
    os: { name: osName, version: osVersion },
    device: { type: deviceType, vendor, model },
    raw: ua,
  };
}

function DeviceIcon({ type }: { type: UAParsed['device']['type'] }) {
  if (type === 'mobile')
    return <Smartphone className="w-5 h-5 text-blue-500" />;
  if (type === 'tablet') return <Tablet className="w-5 h-5 text-purple-500" />;
  if (type === 'bot') return <Cpu className="w-5 h-5 text-orange-500" />;
  return <Monitor className="w-5 h-5 text-gray-500" />;
}

// ─── 浏览器 SVG 图标（内联，无外部依赖）────────────────────────────────────

function IconChrome({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#fff" />
      {/* 外环渐变色扇区 */}
      <path
        d="M12 2a10 10 0 0 1 8.66 5H12a5 5 0 0 0-5 5H2.05A10 10 0 0 1 12 2z"
        fill="#EA4335"
      />
      <path
        d="M2.05 12H7a5 5 0 0 0 2.27 4.18L6.4 20.93A10 10 0 0 1 2.05 12z"
        fill="#34A853"
      />
      <path
        d="M12 22a10 10 0 0 1-5.6-1.07l2.87-4.75A5 5 0 0 0 17 12h4.95A10 10 0 0 1 12 22z"
        fill="#4285F4"
      />
      {/* 中心白圆 */}
      <circle cx="12" cy="12" r="3.5" fill="#fff" />
      <circle cx="12" cy="12" r="2.5" fill="#1A73E8" />
    </svg>
  );
}

function IconFirefox({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M21.94 9.6a9.8 9.8 0 0 0-.76-2.19 10 10 0 0 0-2.24-3.04c.07.52.08 1.04.03 1.56a7.4 7.4 0 0 0-.47-1.1 7.5 7.5 0 0 0-3.26-3.1 9.15 9.15 0 0 1 .44 2.44 6.4 6.4 0 0 0-1.21-1.55C13.28 1.45 11.5.9 9.8 1a9.4 9.4 0 0 0-1.83.26 8.5 8.5 0 0 0-4.25 2.8 10 10 0 0 0-2.24 5.6 10 10 0 0 0 .36 3.5A10 10 0 0 0 12 22a10 10 0 0 0 9.97-10.4 10 10 0 0 0-.03-2z"
        fill="#FF6611"
      />
      <path
        d="M12 3.5c1.2 0 2.37.27 3.43.78a6 6 0 0 0-1.15-.12c-3.58 0-6.5 2.83-6.5 6.34 0 1.49.54 2.86 1.43 3.93A6.5 6.5 0 0 1 7.3 10.5C7.3 6.65 9.27 3.5 12 3.5z"
        fill="#FF980A"
      />
      <path
        d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
        fill="#fff"
        opacity=".3"
      />
    </svg>
  );
}

function IconSafari({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#006CFF" />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="#fff"
        strokeWidth="0.5"
      />
      {/* 指针 */}
      <polygon points="12,4 13.4,10.6 12,12 10.6,10.6" fill="#FF3B30" />
      <polygon points="12,20 10.6,13.4 12,12 13.4,13.4" fill="#fff" />
      {/* 刻度点 */}
      <circle cx="12" cy="3.2" r="0.5" fill="#fff" />
      <circle cx="12" cy="20.8" r="0.5" fill="#fff" />
      <circle cx="3.2" cy="12" r="0.5" fill="#fff" />
      <circle cx="20.8" cy="12" r="0.5" fill="#fff" />
    </svg>
  );
}

function IconEdge({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M21.86 17.5c-.32.9-1 1.68-2 2.24a8.18 8.18 0 0 1-3.86.9c-1.08 0-2.08-.17-3-.5a7.35 7.35 0 0 1-3.8-3.14H19c.54 0 .96-.1 1.27-.3.3-.2.5-.52.59-.96v-.02l.01-.05v-.03c.27-1.37.1-2.74-.44-3.91A7.47 7.47 0 0 0 12 8a7.5 7.5 0 0 0-7.5 7.5c0 .58.07 1.14.2 1.68A10 10 0 1 1 21.86 17.5z"
        fill="#0078D4"
      />
      <path
        d="M14.5 10.5A4.5 4.5 0 0 1 19 15H9.5a4.5 4.5 0 0 1 5-4.5z"
        fill="#50E6FF"
        opacity=".8"
      />
    </svg>
  );
}

function IconOpera({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <ellipse cx="12" cy="12" rx="10" ry="10" fill="#FF1B2D" />
      <ellipse
        cx="12"
        cy="12"
        rx="4.2"
        ry="7.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function IconIE({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M21.4 4.6C19.8 3 17.6 2 15 2c-2 0-3.9.6-5.6 1.7C8.1 4.5 7 5.5 6.2 6.6L4.8 5.3A.5.5 0 0 0 4 5.7V18a.5.5 0 0 0 .5.5h12.3a.5.5 0 0 0 .4-.8l-1.3-1.3c1.1-.8 2-1.9 2.7-3.1A9 9 0 0 0 20 9c0-1.6-.4-3.1-1-4.4z"
        fill="#1EBBEE"
      />
      <path
        d="M12 6.5a5.5 5.5 0 0 0-5.5 5.5c0 1.5.6 2.9 1.6 3.9H6a7 7 0 0 1 6-10.9c1.5 0 2.9.5 4 1.3L14.7 8A5.5 5.5 0 0 0 12 6.5z"
        fill="#fff"
        opacity=".9"
      />
    </svg>
  );
}

function IconSamsung({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect width="24" height="24" rx="12" fill="#1428A0" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="#fff"
        fontSize="9"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        S
      </text>
    </svg>
  );
}

function IconYandex({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#FC3F1D" />
      <path
        d="M13.5 6H11c-1.66 0-3 1.34-3 3 0 1.38.93 2.55 2.2 2.88L7 18h2l3-6.06V18h2V6z"
        fill="#fff"
      />
    </svg>
  );
}

function IconUC({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#FF6600" />
      <path d="M8 8v5a4 4 0 0 0 8 0V8h-2v5a2 2 0 0 1-4 0V8H8z" fill="#fff" />
    </svg>
  );
}

function BrowserIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes('chrome')) return <IconChrome />;
  if (n.includes('firefox')) return <IconFirefox />;
  if (n.includes('safari')) return <IconSafari />;
  if (n.includes('edge')) return <IconEdge />;
  if (n.includes('opera')) return <IconOpera />;
  if (n.includes('internet explorer')) return <IconIE />;
  if (n.includes('samsung')) return <IconSamsung />;
  if (n.includes('yandex')) return <IconYandex />;
  if (n.includes('uc browser')) return <IconUC />;
  // 未知浏览器：字母徽章兜底
  return (
    <span className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

function OsIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  let color = 'bg-gray-400';
  let label = name[0]?.toUpperCase() ?? '?';
  if (n.includes('windows')) {
    color = 'bg-blue-500';
    label = 'W';
  } else if (n.includes('macos') || n.includes('mac os')) {
    color = 'bg-gray-700';
    label = '';
  } else if (n === 'ios') {
    color = 'bg-gray-500';
    label = 'i';
  } else if (n.includes('android')) {
    color = 'bg-green-500';
    label = 'A';
  } else if (
    n.includes('ubuntu') ||
    n.includes('debian') ||
    n.includes('fedora') ||
    n.includes('linux')
  ) {
    color = 'bg-yellow-600';
    label = 'L';
  } else if (n.includes('chrome os')) {
    color = 'bg-blue-400';
    label = 'C';
  }
  return (
    <span
      className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
    >
      {label}
    </span>
  );
}

function InfoItem({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-lg border bg-muted/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="font-semibold text-sm">{value}</span>
      </div>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

const SAMPLE_UAS = [
  {
    label: 'Chrome / macOS',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  },
  {
    label: 'Firefox / Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  },
  {
    label: 'Safari / iOS',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  },
  {
    label: 'Edge / Windows',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  },
  {
    label: 'Googlebot',
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
];

function UserAgentPage() {
  const { t } = useTranslation();
  const currentUA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const [ua, setUa] = useState(currentUA);
  const [copied, setCopied] = useState(false);

  const parsed = parseUA(ua);

  const copy = async () => {
    await navigator.clipboard.writeText(ua);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('userAgent.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('userAgent.desc')}
        </p>
      </div>

      {/* UA input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">
            {t('userAgent.uaLabel')}
          </label>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs h-7"
              onClick={() => setUa(currentUA)}
            >
              <RefreshCw className="w-3 h-3" />
              {t('userAgent.useCurrentUA')}
            </Button>
            <button
              onClick={copy}
              className="p-1 rounded hover:bg-muted transition-colors"
              title={t('userAgent.copy')}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
        <textarea
          value={ua}
          onChange={(e) => setUa(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-xs font-mono rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        />
      </div>

      {/* Sample UAs */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1.5">
          {t('userAgent.quickSamples')}
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {SAMPLE_UAS.map((s) => (
            <button
              key={s.label}
              onClick={() => setUa(s.ua)}
              className="text-xs px-2.5 py-1 rounded-full border hover:bg-accent transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {ua.trim() && (
        <div className="space-y-4">
          {/* Device type header */}
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/20">
            <DeviceIcon type={parsed.device.type} />
            <div>
              <p className="font-semibold text-sm">
                {parsed.device.type === 'desktop'
                  ? t('userAgent.deviceDesktop')
                  : parsed.device.type === 'mobile'
                    ? t('userAgent.deviceMobile')
                    : parsed.device.type === 'tablet'
                      ? t('userAgent.deviceTablet')
                      : parsed.device.type === 'bot'
                        ? t('userAgent.deviceBot')
                        : t('userAgent.deviceUnknown')}
              </p>
              {(parsed.device.vendor || parsed.device.model) && (
                <p className="text-xs text-muted-foreground">
                  {parsed.device.vendor} {parsed.device.model}
                </p>
              )}
            </div>
            {parsed.browser.name && (
              <Badge variant="secondary" className="ml-auto">
                <Globe className="w-3 h-3 mr-1" />
                {parsed.browser.name}
              </Badge>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <InfoItem
              label={t('userAgent.labelBrowser')}
              value={parsed.browser.name}
              icon={
                parsed.browser.name ? (
                  <BrowserIcon name={parsed.browser.name} />
                ) : undefined
              }
              sub={
                parsed.browser.version
                  ? t('userAgent.versionSub', { v: parsed.browser.version })
                  : ''
              }
            />
            <InfoItem
              label={t('userAgent.labelEngine')}
              value={parsed.engine.name}
              sub={
                parsed.engine.version
                  ? t('userAgent.versionSub', { v: parsed.engine.version })
                  : ''
              }
            />
            <InfoItem
              label={t('userAgent.labelOS')}
              value={parsed.os.name}
              icon={
                parsed.os.name ? <OsIcon name={parsed.os.name} /> : undefined
              }
              sub={
                parsed.os.version
                  ? t('userAgent.versionSub', { v: parsed.os.version })
                  : ''
              }
            />
          </div>

          {/* Raw tokens */}
          <div className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-2">
              {t('userAgent.tokenBreakdown')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ua.match(/[^()]+|\([^)]*\)/g)?.map((token, i) => (
                <code
                  key={i}
                  className="text-xs bg-muted rounded px-1.5 py-0.5 break-all"
                >
                  {token.trim()}
                </code>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
