import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseUnixMode } from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/unix-permissions')({
  component: UnixPermissionsPage,
});

function UnixPermissionsPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState('755');
  const result = useMemo(() => {
    try {
      return { data: parseUnixMode(input), error: null };
    } catch {
      return { data: null, error: t('unixPermissions.invalid') };
    }
  }, [input, t]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('unixPermissions.title')}</h1>
      <div className="space-y-2">
        <Label htmlFor="unix-mode">{t('unixPermissions.input')}</Label>
        <Input
          id="unix-mode"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="755 / rwxr-xr-x / 4755"
          className="font-mono"
          spellCheck={false}
        />
      </div>
      {result.error && (
        <p className="text-sm text-destructive">{result.error}</p>
      )}
      {result.data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-5">
            <p className="text-sm text-muted-foreground">
              {t('unixPermissions.octal')}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold">
              {result.data.octal}
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <p className="text-sm text-muted-foreground">
              {t('unixPermissions.symbolic')}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold">
              {result.data.symbolic}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
