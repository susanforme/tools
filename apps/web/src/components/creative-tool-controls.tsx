import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '@/lib/download';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function CreativeProjectActions({
  name,
  value,
  onImport,
  disabled = false,
}: {
  name: string;
  value: unknown;
  onImport: (value: unknown) => void | Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      if (file.size > 80_000_000)
        throw new Error('creativeCommon.projectLimit');
      const data: unknown = JSON.parse(await file.text());
      if (alive.current) await onImport(data);
    } catch (cause) {
      if (alive.current)
        setError(
          t((cause as Error).message, {
            defaultValue: t('creativeCommon.invalidProject'),
          }),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled || busy}
          onClick={() => {
            try {
              downloadBlob(
                new Blob([JSON.stringify(value)], { type: 'application/json' }),
                `${name}.json`,
              );
            } catch {
              setError(t('creativeCommon.saveError'));
            }
          }}
        >
          {t('creativeCommon.saveProject')}
        </Button>
        <Button
          variant="outline"
          disabled={disabled || busy}
          onClick={() => fileInput.current?.click()}
        >
          {t('creativeCommon.importProject')}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label={t('creativeCommon.importProject')}
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void load(file);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function CreativeTextField({
  label,
  value,
  onChange,
  type = 'text',
  maxLength = 200,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'color';
  maxLength?: number;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span>{label}</span>
      <Input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function CreativePage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
