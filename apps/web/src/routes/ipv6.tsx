import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  generateIpv6Ula,
  inspectIpv6,
  type Ipv6Info,
} from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/ipv6')({ component: Ipv6Page });

function Ipv6Page() {
  const { t } = useTranslation();
  const [input, setInput] = useState('2001:db8::1/64');
  const [result, setResult] = useState<Ipv6Info | null>(null);
  const [ula, setUla] = useState('');
  const [error, setError] = useState<string | null>(null);

  const inspect = () => {
    setError(null);
    try {
      setResult(inspectIpv6(input));
    } catch (cause) {
      setResult(null);
      setError(t('ipv6.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('ipv6.title')}</h1>
      <div className="space-y-2">
        <Label htmlFor="ipv6-input">{t('ipv6.input')}</Label>
        <div className="flex gap-2">
          <Input
            id="ipv6-input"
            className="font-mono"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && inspect()}
          />
          <Button onClick={inspect}>{t('ipv6.inspect')}</Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {result && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['compressed', result.address],
              ['expanded', result.expanded],
              ['prefix', String(result.prefix)],
              ['network', result.network],
              ['lastAddress', result.lastAddress],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="space-y-1 rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">
                {t(`ipv6.${label}`)}
              </div>
              <div className="break-all font-mono text-sm">{value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3 rounded-xl border p-4">
        <Label>{t('ipv6.ula')}</Label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setUla(generateIpv6Ula())}>
            {t('ipv6.generate')}
          </Button>
          {ula && <code className="self-center break-all text-sm">{ula}</code>}
        </div>
      </div>
    </div>
  );
}
