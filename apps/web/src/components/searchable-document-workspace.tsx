import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  prepareScanFiles,
  type ScanPage,
  type ScanRequest,
  type ScanResult,
} from '@/lib/searchable-document';
import { downloadBytes } from '@/lib/download';
import { ChoiceField } from './calculator-ui';
import { PracticalText } from './practical-ui';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { VisualError } from './visual-design-ui';
const createWorker = () =>
  new Worker(
    new URL('../workers/searchable-document.worker.ts', import.meta.url),
    { type: 'module' },
  );
export function SearchableScanner() {
  const { t } = useTranslation();
  const [language, setLanguage] = useQueryParam<string>(
    'ocrLanguage',
    StringParam,
    'eng',
  );
  const [files, setFiles] = useState<File[]>([]),
    [pages, setPages] = useState<ScanPage[]>([]),
    [selected, setSelected] = useState(0),
    [font, setFont] = useState<Uint8Array | null>(null),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null),
    fontTicket = useRef(0);
  const ocr = useBoundedWorker<ScanRequest, ScanResult>(createWorker, 180000),
    pdf = useBoundedWorker<ScanRequest, ScanResult>(createWorker, 60000);
  useEffect(() => {
    controller.current?.abort();
    setPreparing(false);
    setPages([]);
    ocr.clear();
    pdf.clear();
    setSelected(0);
    setError(null);
  }, [files, language, ocr.clear, pdf.clear]);
  useEffect(
    () => () => {
      controller.current?.abort();
      fontTicket.current++;
    },
    [],
  );
  useEffect(() => {
    if (ocr.result?.kind === 'ocr') setPages(ocr.result.pages);
  }, [ocr.result]);
  useEffect(() => {
    pdf.clear();
  }, [pages, font, pdf.clear]);
  const [preview, setPreview] = useState<string | null>(null);
  const page = pages[selected];
  useEffect(() => {
    if (!page) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(page.image)], { type: 'image/png' }),
    );
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [page?.image]);
  const run = async () => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setPreparing(true);
    setError(null);
    setPages([]);
    ocr.clear();
    pdf.clear();
    const timer = setTimeout(() => {
      next.abort();
      if (controller.current === next) setError('TIMEOUT');
    }, 60000);
    try {
      const prepared = await prepareScanFiles(files, next.signal);
      next.signal.throwIfAborted();
      ocr.run({ kind: 'ocr', pages: prepared, language });
    } catch (cause) {
      if (!next.signal.aborted) setError((cause as Error).message);
    } finally {
      clearTimeout(timer);
      if (controller.current === next) setPreparing(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('visualDesign.ocrHint')}
      </p>
      <Input
        type="file"
        multiple
        accept=".pdf,image/png,image/jpeg,image/webp,image/bmp"
        aria-label={t('visualDesign.files')}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <ChoiceField
        label={t('visualDesign.language')}
        value={language}
        onChange={setLanguage}
        options={[
          { value: 'eng', label: t('visualDesign.english') },
          { value: 'chi_sim', label: t('visualDesign.chinese') },
          { value: 'eng+chi_sim', label: t('visualDesign.bilingual') },
        ]}
      />
      <div className="flex gap-2">
        <Button
          disabled={!files.length || preparing || ocr.busy}
          onClick={() => void run()}
        >
          {t(
            preparing
              ? 'visualDesign.preparing'
              : ocr.busy
                ? 'visualDesign.recognizing'
                : 'visualDesign.recognize',
          )}
        </Button>
        {(preparing || ocr.busy || pdf.busy) && (
          <Button
            variant="outline"
            onClick={() => {
              controller.current?.abort();
              setPreparing(false);
              ocr.cancel();
              pdf.cancel();
            }}
          >
            {t('visualDesign.cancel')}
          </Button>
        )}
      </div>
      {page && (
        <>
          <ChoiceField
            label={t('visualDesign.page')}
            value={String(selected)}
            options={pages.map((p, i) => ({
              value: String(i),
              label: `${i + 1}. ${p.name}`,
            }))}
            onChange={(v) => setSelected(+v)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {preview && (
              <img
                src={preview}
                alt={page.name}
                className="max-h-[70vh] w-full rounded border object-contain"
              />
            )}
            <div className="max-h-[70vh] space-y-2 overflow-auto rounded border p-3">
              {!page.lines.length && <p>{t('visualDesign.noText')}</p>}
              {page.lines.map((line, i) => (
                <PracticalText
                  key={i}
                  label={`${t('visualDesign.line')} ${i + 1}`}
                  value={line.text}
                  maxLength={5000}
                  onChange={(text) =>
                    setPages(
                      pages.map((p, n) =>
                        n === selected
                          ? {
                              ...p,
                              lines: p.lines.map((l, j) =>
                                j === i ? { ...l, text } : l,
                              ),
                            }
                          : p,
                      ),
                    )
                  }
                />
              ))}
            </div>
          </div>
          <label className="block space-y-1 text-sm">
            {t('visualDesign.font')}
            <Input
              type="file"
              accept=".ttf,.otf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const ticket = ++fontTicket.current;
                setFont(null);
                if (!file) return;
                void (async () => {
                  try {
                    if (file.size > 20 * 1024 * 1024) throw new Error('size');
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    if (ticket === fontTicket.current) {
                      setFont(bytes);
                      setError(null);
                    }
                  } catch (cause) {
                    if (ticket === fontTicket.current)
                      setError((cause as Error).message);
                  }
                })();
              }}
            />
          </label>
          <Button
            disabled={pdf.busy}
            onClick={() => pdf.run({ kind: 'pdf', pages, font })}
          >
            {t('visualDesign.searchablePdf')}
          </Button>
        </>
      )}
      {pdf.result?.kind === 'pdf' && (
        <Button
          onClick={() => {
            if (pdf.result?.kind === 'pdf')
              downloadBytes(
                pdf.result.bytes,
                'searchable-scan.pdf',
                'application/pdf',
              );
          }}
        >
          {t('visualDesign.download')}
        </Button>
      )}
      <VisualError error={error ?? ocr.error ?? pdf.error} />
    </div>
  );
}
