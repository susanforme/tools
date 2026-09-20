import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { downloadBlob } from '@/lib/download';
export const createCommunityWorker = (): Worker =>
  new Worker(
    new URL('../workers/community-protocols.worker.ts', import.meta.url),
    { type: 'module' },
  );
export function CommunityError({ error }: { error: string | null }) {
  const { t } = useTranslation();
  if (!error) return null;
  const [code, ...detail] = error.split(':');
  return (
    <p
      role="alert"
      className="break-all rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      {t('formats.failed', {
        message: `${t(`community.errors.${code}`, { defaultValue: t(`formats.errors.${code}`, { defaultValue: code }) })}${detail.length ? `: ${detail.join(':')}` : ''}`,
      })}
    </p>
  );
}
export function CommunityOutput({ output }: { output: string }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 space-y-2">
      <Textarea
        aria-label={t('formats.output')}
        readOnly
        value={output}
        className="h-72 font-mono text-xs"
      />
      <Button
        size="sm"
        variant="outline"
        disabled={!output}
        onClick={() =>
          downloadBlob(
            new Blob([output], { type: 'text/plain;charset=utf-8' }),
            'result.txt',
          )
        }
      >
        {t('community.export')}
      </Button>
    </div>
  );
}
