import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { StringParam, useQueryParam } from '../hooks/useQueryParams';
import { downloadBlob } from '../lib/download';
import type { OcrLanguage, OcrProgress } from '../lib/ocr';

export const Route = createFileRoute('/ocr')({ component: OcrPage });

function OcrPage() {
  const { t } = useTranslation();
  const [language, setLanguage] = useQueryParam<OcrLanguage>(
    'language',
    StringParam,
    'eng+chi_sim',
  );
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const controller = useRef<AbortController | null>(null);
  const activeLanguage: OcrLanguage = [
    'eng',
    'chi_sim',
    'eng+chi_sim',
  ].includes(language)
    ? language
    : 'eng+chi_sim';

  useEffect(() => () => controller.current?.abort(), []);

  const selectFile = (next: File | null) => {
    controller.current?.abort();
    controller.current = null;
    setRunning(false);
    setFile(next);
    setOutput('');
    setProgress(null);
    setError(null);
  };

  const recognize = async () => {
    if (!file || running) return;
    const run = new AbortController();
    controller.current = run;
    setRunning(true);
    setError(null);
    setOutput('');
    setProgress({ page: 1, pages: 1, progress: 0 });
    try {
      const { recognizeFile } = await import('../lib/ocr');
      await recognizeFile(
        file,
        activeLanguage,
        run.signal,
        setProgress,
        (text, page) => {
          if (!run.signal.aborted)
            setOutput((current) => current + (page > 1 ? '\n\n' : '') + text);
        },
      );
      if (!run.signal.aborted)
        setProgress((current) =>
          current ? { ...current, progress: 1 } : null,
        );
    } catch (cause) {
      if (!run.signal.aborted)
        setError(t('ocr.error', { message: (cause as Error).message }));
    } finally {
      if (controller.current === run) {
        setRunning(false);
        controller.current = null;
      }
    }
  };

  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    setRunning(false);
    setProgress(null);
  };

  return (
    <div
      className="mx-auto max-w-6xl space-y-4 px-4 py-6"
      onPaste={(event) => {
        const image = Array.from(event.clipboardData.files).find((item) =>
          item.type.startsWith('image/'),
        );
        if (image) {
          event.preventDefault();
          selectFile(image);
        }
      }}
    >
      <h1 className="text-2xl font-bold">{t('ocr.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('ocr.limits')}</p>
      <div className="space-y-2">
        <Label htmlFor="ocr-file">{t('ocr.file')}</Label>
        <Input
          id="ocr-file"
          type="file"
          accept="image/*,.pdf,application/pdf"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
        {file && <p className="break-all text-sm">{file.name}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="ocr-language">{t('ocr.language')}</Label>
        <Select
          value={activeLanguage}
          onValueChange={(value) => setLanguage(value as OcrLanguage)}
          disabled={running}
        >
          <SelectTrigger id="ocr-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="eng+chi_sim">{t('ocr.bilingual')}</SelectItem>
            <SelectItem value="chi_sim">{t('ocr.chinese')}</SelectItem>
            <SelectItem value="eng">{t('ocr.english')}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => void recognize()} disabled={!file || running}>
          {t(running ? 'ocr.running' : 'ocr.run')}
        </Button>
        {running && (
          <Button variant="outline" onClick={cancel}>
            {t('ocr.cancel')}
          </Button>
        )}
      </div>
      {progress && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('ocr.progress', {
            page: progress.page,
            pages: progress.pages,
            percent: Math.round(progress.progress * 100),
          })}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="ocr-output">{t('ocr.output')}</Label>
        <Button
          size="sm"
          variant="outline"
          disabled={!output}
          onClick={() => {
            void navigator.clipboard
              .writeText(output)
              .catch((cause: Error) =>
                setError(t('ocr.copyError', { message: cause.message })),
              );
          }}
        >
          {t('ocr.copy')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!output}
          onClick={() =>
            downloadBlob(
              new Blob([output], { type: 'text/plain;charset=utf-8' }),
              `${file?.name ?? 'ocr'}.txt`,
            )
          }
        >
          {t('ocr.download')}
        </Button>
      </div>
      <Textarea
        id="ocr-output"
        value={output}
        onChange={(event) => setOutput(event.target.value)}
        className="min-h-80 font-mono"
      />
    </div>
  );
}
