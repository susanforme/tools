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
import AndroidIcon from '~icons/simple-icons/android';
import AppleIcon from '~icons/simple-icons/apple';
import DebianIcon from '~icons/simple-icons/debian';
import FedoraIcon from '~icons/simple-icons/fedora';
import FirefoxIcon from '~icons/simple-icons/firefoxbrowser';
import ChromeIcon from '~icons/simple-icons/googlechrome';
import IEIcon from '~icons/simple-icons/internetexplorer';
import LinuxIcon from '~icons/simple-icons/linux';
import MacosIcon from '~icons/simple-icons/macos';
import EdgeIcon from '~icons/simple-icons/microsoftedge';
import OperaIcon from '~icons/simple-icons/opera';
import SafariIcon from '~icons/simple-icons/safari';
import SamsungIcon from '~icons/simple-icons/samsung';
import UbuntuIcon from '~icons/simple-icons/ubuntu';
import WindowsIcon from '~icons/simple-icons/windows';
import YandexIcon from '~icons/simple-icons/yandexcloud';
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

// ─── UA 解析（轻量，无外部依赖）─────────────────────────────────────────────

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

// ─── 设备图标 ─────────────────────────────────────────────────────────────────

function DeviceIcon({ type }: { type: UAParsed['device']['type'] }) {
  if (type === 'mobile')
    return <Smartphone className="w-5 h-5 text-blue-500" />;
  if (type === 'tablet') return <Tablet className="w-5 h-5 text-purple-500" />;
  if (type === 'bot') return <Cpu className="w-5 h-5 text-orange-500" />;
  return <Monitor className="w-5 h-5 text-gray-500" />;
}

// 匹配关键字 → { 图标组件, 品牌色 }
type IconEntry = {
  match: string;
  Ic: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
};

const BROWSER_ICON_MAP: IconEntry[] = [
  { match: 'chrome', Ic: ChromeIcon, color: '#4285F4' },
  { match: 'firefox', Ic: FirefoxIcon, color: '#FF7139' },
  { match: 'safari', Ic: SafariIcon, color: '#006CFF' },
  { match: 'edge', Ic: EdgeIcon, color: '#0078D4' },
  { match: 'opera', Ic: OperaIcon, color: '#FF1B2D' },
  { match: 'internet explorer', Ic: IEIcon, color: '#0076D6' },
  { match: 'samsung', Ic: SamsungIcon, color: '#1428A0' },
  { match: 'yandex', Ic: YandexIcon, color: '#FC3F1D' },
];

function BrowserIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const entry = BROWSER_ICON_MAP.find(({ match }) => n.includes(match));
  if (entry) {
    return (
      <entry.Ic
        width={20}
        height={20}
        style={{ color: entry.color }}
        className="shrink-0"
      />
    );
  }
  // 未识别浏览器兜底
  return (
    <span className="w-5 h-5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-foreground text-[10px] font-bold shrink-0">
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

// ─── 操作系统图标（simple-icons via unplugin-icons）──────────────────────────

const OS_ICON_MAP: IconEntry[] = [
  { match: 'windows', Ic: WindowsIcon, color: '#0078D4' },
  { match: 'macos', Ic: MacosIcon, color: '#555555' },
  { match: 'mac os', Ic: MacosIcon, color: '#555555' },
  { match: 'ios', Ic: AppleIcon, color: '#555555' },
  { match: 'android', Ic: AndroidIcon, color: '#3DDC84' },
  { match: 'ubuntu', Ic: UbuntuIcon, color: '#E95420' },
  { match: 'fedora', Ic: FedoraIcon, color: '#294172' },
  { match: 'debian', Ic: DebianIcon, color: '#A81D33' },
  { match: 'linux', Ic: LinuxIcon, color: '#FCC624' },
  { match: 'chrome os', Ic: ChromeIcon, color: '#4285F4' },
];

function OsIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const entry = OS_ICON_MAP.find(({ match }) => n.includes(match));
  if (entry) {
    return (
      <entry.Ic
        width={20}
        height={20}
        style={{ color: entry.color }}
        className="shrink-0"
      />
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-foreground text-[10px] font-bold shrink-0">
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

// ─── InfoItem ─────────────────────────────────────────────────────────────────

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

// ─── 示例 UA ──────────────────────────────────────────────────────────────────

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

// ─── 页面 ─────────────────────────────────────────────────────────────────────

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

      {/* UA 输入框 */}
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

      {/* 快速示例 */}
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

      {/* 解析结果 */}
      {ua.trim() && (
        <div className="space-y-4">
          {/* 设备类型标题栏 */}
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

          {/* 信息卡片 */}
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

          {/* Token 分解 */}
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
