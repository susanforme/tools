import { Button } from '@/components/ui/button';
import { DnsComparePanel } from '@/components/extra-tool-panels';
import { DnsZonePanel } from '@/components/protocol-tool-panels';
import { DnssecPanel } from '@/components/modern-web-tool-panels';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/dns')({ component: DnsPage });

const RECORD_TYPES = [
  'A',
  'AAAA',
  'CNAME',
  'MX',
  'TXT',
  'NS',
  'CAA',
  'SRV',
  'HTTPS',
] as const;
type RecordType = (typeof RECORD_TYPES)[number];
type DnsAnswer = { name: string; type: number; TTL: number; data: string };
type DnsResponse = { Status: number; Answer?: DnsAnswer[]; Comment?: string };

function DnsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<'lookup' | 'compare' | 'zone' | 'dnssec'>(
    'tab',
    StringParam,
    'lookup',
  );
  const [type, setType] = useQueryParam<RecordType>('type', StringParam, 'A');
  const [name, setName] = useState('example.com');
  const [response, setResponse] = useState<DnsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ name: name.trim(), type });
      const result = await fetch(
        `https://cloudflare-dns.com/dns-query?${query}`,
        {
          headers: { Accept: 'application/dns-json' },
        },
      );
      if (!result.ok) throw new Error(`${result.status} ${result.statusText}`);
      setResponse((await result.json()) as DnsResponse);
    } catch (cause) {
      setResponse(null);
      setError(t('dns.failed', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('dns.title')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value as 'lookup' | 'compare' | 'zone' | 'dnssec')
        }
      >
        <TabsList>
          <TabsTrigger value="lookup">{t('dns.lookup')}</TabsTrigger>
          <TabsTrigger value="compare">{t('dns.compare')}</TabsTrigger>
          <TabsTrigger value="zone">{t('protocol.tabs.dnsZone')}</TabsTrigger>
          <TabsTrigger value="dnssec">DNSSEC</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'compare' ? (
        <DnsComparePanel />
      ) : tab === 'zone' ? (
        <DnsZonePanel />
      ) : tab === 'dnssec' ? (
        <DnssecPanel />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-w-64 flex-1"
            />
            <Select
              value={type}
              onValueChange={(value) => setType(value as RecordType)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={loading || !name.trim()}
              onClick={() => void lookup()}
            >
              {loading ? t('dns.loading') : t('dns.lookup')}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {response && (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">{t('dns.name')}</th>
                    <th className="p-3">TTL</th>
                    <th className="p-3">{t('dns.value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(response.Answer ?? []).map((answer, index) => (
                    <tr key={`${answer.data}-${index}`} className="border-t">
                      <td className="p-3 font-mono">{answer.name}</td>
                      <td className="p-3 font-mono">{answer.TTL}</td>
                      <td className="break-all p-3 font-mono">{answer.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!response.Answer?.length && (
                <p className="p-4 text-sm text-muted-foreground">
                  {t('dns.empty', { status: response.Status })}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
