import { createFileRoute } from '@tanstack/react-router';
import {
  Building2,
  Globe,
  Info,
  Loader2,
  MapPin,
  Network,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/ip-lookup')({ component: IpLookupPage });

const IP_REGEX =
  /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
const IPV6_REGEX =
  /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b|\b::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g;

type IpInfo = {
  ip: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  status: 'success' | 'fail';
  message?: string;
};

async function queryIp(ip: string): Promise<IpInfo> {
  const url =
    ip === 'me'
      ? 'https://ip-api.com/json/?fields=66846719'
      : `https://ip-api.com/json/${ip}?fields=66846719`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as IpInfo;
  return { ...data, ip: ip === 'me' ? (data.ip ?? '') : ip };
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b last:border-0">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span className="text-xs text-muted-foreground w-20 shrink-0">
        {label}
      </span>
      <span className="text-sm break-all">{value}</span>
    </div>
  );
}

function IpCard({ info }: { info: IpInfo }) {
  if (info.status === 'fail') {
    return (
      <div className="border rounded-lg p-4 border-destructive/30 bg-destructive/5">
        <p className="text-sm text-destructive">
          ❌ 查询失败：{info.message ?? '未知错误'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">IP: {info.ip}</p>
      </div>
    );
  }
  return (
    <div className="border rounded-lg p-4 space-y-0.5">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-blue-500" />
        <span className="font-mono font-bold">{info.ip}</span>
        {info.countryCode && (
          <Badge variant="outline" className="text-xs">
            {info.countryCode}
          </Badge>
        )}
      </div>
      <InfoRow
        icon={<MapPin className="w-3.5 h-3.5 text-red-500" />}
        label="国家/地区"
        value={info.country}
      />
      <InfoRow
        icon={<MapPin className="w-3.5 h-3.5 text-orange-400" />}
        label="省/州"
        value={info.regionName}
      />
      <InfoRow
        icon={<MapPin className="w-3.5 h-3.5 text-yellow-500" />}
        label="城市"
        value={info.city}
      />
      <InfoRow
        icon={<Building2 className="w-3.5 h-3.5 text-purple-500" />}
        label="ISP"
        value={info.isp}
      />
      <InfoRow
        icon={<Building2 className="w-3.5 h-3.5 text-indigo-500" />}
        label="组织"
        value={info.org}
      />
      <InfoRow
        icon={<Network className="w-3.5 h-3.5 text-green-500" />}
        label="AS"
        value={info.as}
      />
      <InfoRow
        icon={<Globe className="w-3.5 h-3.5 text-teal-500" />}
        label="时区"
        value={info.timezone}
      />
      {info.lat !== undefined && info.lon !== undefined && (
        <InfoRow
          icon={<MapPin className="w-3.5 h-3.5 text-pink-500" />}
          label="坐标"
          value={`${info.lat}, ${info.lon}`}
        />
      )}
    </div>
  );
}

function IpLookupPage() {
  const { t } = useTranslation();
  const [lookupIp, setLookupIp] = useState('');
  const [lookupResult, setLookupResult] = useState<IpInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [extractText, setExtractText] = useState('');
  const [extractedIps, setExtractedIps] = useState<string[]>([]);

  const [myIpResult, setMyIpResult] = useState<IpInfo | null>(null);
  const [myIpLoading, setMyIpLoading] = useState(false);

  const lookup = async (ip?: string) => {
    const target = ip ?? lookupIp.trim();
    if (!target) return;
    setLookupError(null);
    setLookupResult(null);
    setLookupLoading(true);
    try {
      const info = await queryIp(target);
      setLookupResult(info);
    } catch (e) {
      setLookupError(`查询失败：${(e as Error).message}`);
    } finally {
      setLookupLoading(false);
    }
  };

  const getMyIp = async () => {
    setMyIpLoading(true);
    setMyIpResult(null);
    try {
      const info = await queryIp('me');
      setMyIpResult(info);
    } catch (e) {
      setMyIpResult({ ip: '', status: 'fail', message: (e as Error).message });
    } finally {
      setMyIpLoading(false);
    }
  };

  const extract = () => {
    const v4 = extractText.match(IP_REGEX) ?? [];
    const v6 = extractText.match(IPV6_REGEX) ?? [];
    const all = [...new Set([...v4, ...v6])];
    setExtractedIps(all);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('ipLookup.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('ipLookup.desc')}
        </p>
      </div>

      <div className="flex gap-2 items-start rounded-md border bg-blue-500/5 border-blue-500/20 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">{t('ipLookup.note')}</p>
      </div>

      <Tabs defaultValue="lookup">
        <TabsList>
          <TabsTrigger value="lookup">IP 查询</TabsTrigger>
          <TabsTrigger value="myip">本机 IP</TabsTrigger>
          <TabsTrigger value="extract">提取 IP</TabsTrigger>
        </TabsList>

        <TabsContent value="lookup" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={lookupIp}
              onChange={(e) => setLookupIp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="输入 IPv4 地址，如 8.8.8.8"
              className="flex-1 h-9 px-3 text-sm rounded border bg-transparent font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              onClick={() => lookup()}
              disabled={lookupLoading}
              className="gap-1.5 shrink-0"
            >
              {lookupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              查询
            </Button>
          </div>
          {lookupError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-2">
              {lookupError}
            </div>
          )}
          {lookupResult && <IpCard info={lookupResult} />}
        </TabsContent>

        <TabsContent value="myip" className="mt-4 space-y-3">
          <Button
            size="sm"
            onClick={getMyIp}
            disabled={myIpLoading}
            className="gap-1.5"
          >
            {myIpLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Globe className="w-4 h-4" />
            )}
            获取本机 IP 及归属地
          </Button>
          {myIpResult && <IpCard info={myIpResult} />}
        </TabsContent>

        <TabsContent value="extract" className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              粘贴包含 IP 地址的文本
            </label>
            <textarea
              value={extractText}
              onChange={(e) => setExtractText(e.target.value)}
              placeholder={
                '粘贴日志、配置文件或任意文本，工具将提取其中的 IP 地址...\n\n例如：\nConnected from 192.168.1.1 at 2024-01-01\nBlocked IP: 10.0.0.1, 172.16.0.5'
              }
              className="w-full h-32 px-3 py-2 text-xs font-mono rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
          <Button size="sm" onClick={extract}>
            提取 IP 地址
          </Button>
          {extractedIps.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                共提取到 {extractedIps.length} 个唯一 IP
              </p>
              <div className="flex flex-wrap gap-1.5">
                {extractedIps.map((ip) => (
                  <button
                    key={ip}
                    onClick={() => {
                      setLookupIp(ip);
                      lookup(ip);
                    }}
                    className="font-mono text-xs bg-muted hover:bg-accent px-2 py-1 rounded border transition-colors"
                    title="点击查询此 IP"
                  >
                    {ip}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                点击 IP 地址可跳转至「IP 查询」标签查询归属地
              </p>
            </div>
          )}
          {extractText && extractedIps.length === 0 && (
            <p className="text-xs text-muted-foreground">
              未在文本中找到 IP 地址
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
