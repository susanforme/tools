import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportStudyPdf } from '@/lib/study-print';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
export function StudyText({
  label,
  value,
  onChange,
  multiline = false,
  maxLength = 10000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-28"
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
export function StudyImport({
  onText,
  json = false,
}: {
  onText: (text: string) => void;
  json?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {t(json ? 'studyCommon.restore' : 'studyCommon.importFile')}
      </Label>
      <Input
        id={id}
        type="file"
        accept={json ? '.json' : '.txt,.csv,.tsv'}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const request = ++generation.current;
          try {
            if (file.size > (json ? 16 : 1) * 1024 * 1024)
              throw new Error('size');
            const source = await file.text();
            if (request !== generation.current) return;
            onText(source);
            setError(null);
          } catch {
            if (request === generation.current)
              setError(
                t(json ? 'studyCommon.backupError' : 'studyCommon.importError'),
              );
          }
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function StudyPreview({
  images,
  filename,
}: {
  images: string[];
  filename: string;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const index = Math.min(page, Math.max(0, images.length - 1));
  if (!images.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await exportStudyPdf(images, filename);
            } catch {
              setError(t('studyCommon.exportError'));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t(busy ? 'studyCommon.exporting' : 'studyCommon.pdf')}
        </Button>
        <Button
          variant="outline"
          disabled={!index}
          onClick={() => setPage(index - 1)}
        >
          {t('studyCommon.previous')}
        </Button>
        <span>
          {index + 1} / {images.length}
        </span>
        <Button
          variant="outline"
          disabled={index + 1 >= images.length}
          onClick={() => setPage(index + 1)}
        >
          {t('studyCommon.next')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t('studyCommon.printScale')}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <img
        src={images[index]}
        alt={t('studyCommon.page', { count: index + 1 })}
        className="mx-auto w-full max-w-[630px] border shadow-sm"
      />
    </section>
  );
}
