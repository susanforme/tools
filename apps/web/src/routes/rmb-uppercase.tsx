import { toRmbUppercase } from '@/lib/rmb-uppercase';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export const Route = createFileRoute('/rmb-uppercase')({
  component: RmbUppercasePage,
});

function RmbUppercasePage() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('1234.56');
  const [copied, setCopied] = useState(false);

  const { result, error } = useMemo(() => {
    const trimmed = amount.trim();
    if (!trimmed) {
      return { result: '', error: null as string | null };
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      return {
        result: '',
        error: t('rmbUppercase.invalid'),
      };
    }
    try {
      return { result: toRmbUppercase(parsed), error: null as string | null };
    } catch (cause) {
      return {
        result: '',
        error: t('rmbUppercase.failed', { msg: (cause as Error).message }),
      };
    }
  }, [amount, t]);

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('rmbUppercase.title')}</h1>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rmb-amount">{t('rmbUppercase.amount')}</Label>
        <Input
          id="rmb-amount"
          type="number"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          className="font-mono text-lg"
        />
      </div>
      <div className="space-y-3 rounded-lg border bg-muted/30 px-5 py-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('rmbUppercase.result')}
        </p>
        <p className="break-all text-2xl font-semibold leading-relaxed tracking-wide">
          {result || '—'}
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={!result}
          onClick={() => void copy()}
          className="gap-1.5"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {t(copied ? 'rmbUppercase.copied' : 'rmbUppercase.copy')}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
