import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '@/lib/download';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function ProductivityError({ error }: { error: string | null }) {
  const { t } = useTranslation();
  return error ? (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {t('productivity.error', {
        message: t(`productivity.${error}`, { defaultValue: error }),
      })}
    </p>
  ) : null;
}
export function ProductivityFrame({
  id,
  children,
  error,
}: {
  id: string;
  children: ReactNode;
  error?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t(`productivity.tools.${id}.title`)}
      </h1>
      {children}
      <ProductivityError error={error ?? null} />
    </div>
  );
}
export function saveProductivityText(
  value: string,
  name: string,
  type = 'text/plain',
) {
  downloadBlob(new Blob([value], { type }), name);
}
/** 导入回调在读取结束时只应用到仍挂载的最新操作，防止旧文件覆盖新选择。 */
export function ProductivityImport<T>({
  accept,
  parse,
  onImport,
}: {
  accept: string;
  parse: (text: string, file: File) => T | Promise<T>;
  onImport: (data: T) => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  const onImportRef = useRef(onImport);
  onImportRef.current = onImport;
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  return (
    <div className="space-y-2">
      <label className="block space-y-2 text-sm">
        <span>{t('productivity.import')}</span>
        <Input
          type="file"
          accept={accept}
          multiple
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (!files.length) return;
            const request = ++revision.current;
            setBusy(true);
            setError(null);
            try {
              if (
                files.length > 50 ||
                files.reduce((s, f) => s + f.size, 0) > 2_000_000
              )
                throw new Error('invalidFile');
              const parsed: T[] = [];
              for (const file of files) {
                const result = await parse(await file.text(), file);
                if (request !== revision.current) return;
                parsed.push(result);
              }
              for (const result of parsed) onImportRef.current(result);
            } catch (cause) {
              if (request === revision.current)
                setError((cause as Error).message);
            } finally {
              if (request === revision.current) setBusy(false);
            }
          }}
        />
      </label>
      {busy && <p role="status">{t('productivity.working')}</p>}
      <ProductivityError error={error} />
    </div>
  );
}
export function MoveButtons({
  index,
  length,
  move,
}: {
  index: number;
  length: number;
  move: (to: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={index === 0}
        onClick={() => move(index - 1)}
      >
        {t('productivity.up')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={index === length - 1}
        onClick={() => move(index + 1)}
      >
        {t('productivity.down')}
      </Button>
    </div>
  );
}
