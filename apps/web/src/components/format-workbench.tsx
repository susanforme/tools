import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
export const createFormatWorker = (): Worker =>
  new Worker(
    new URL('../workers/expansion-formats.worker.ts', import.meta.url),
    { type: 'module' },
  );
export function FormatActions({
  busy,
  run,
  cancel,
  clear,
  sample,
}: {
  busy: boolean;
  run: () => void;
  cancel: () => void;
  clear: () => void;
  sample: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={run}>
        {t(busy ? 'formats.running' : 'formats.run')}
      </Button>
      {busy && (
        <Button size="sm" variant="outline" onClick={cancel}>
          {t('formats.cancel')}
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={sample}>
        {t('formats.sample')}
      </Button>
      <Button size="sm" variant="outline" onClick={clear}>
        {t('formats.clear')}
      </Button>
    </div>
  );
}
export function FormatFeedback({
  error,
  info,
}: {
  error: string | null;
  info?: string;
}) {
  const { t } = useTranslation();
  const [code, ...details] = error?.split(':') ?? [];
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm break-all text-destructive"
        >
          {t('formats.failed', {
            message: `${t(`formats.errors.${code}`, { defaultValue: code })}${details.length ? `: ${details.join(':')}` : ''}`,
          })}
        </p>
      )}
      {info && (
        <Textarea
          aria-label={t('formats.info')}
          className="min-h-32 font-mono text-xs"
          readOnly
          value={info}
        />
      )}
    </>
  );
}
