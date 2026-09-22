import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  NumberParam,
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { downloadBytes } from '@/lib/download';
import {
  PAPER_TYPES,
  createPaperPdf,
  createPaperSheets,
  type PaperSheet,
} from '@/lib/printable-paper';
import { createFileRoute } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/printable-paper')({
  component: PrintablePaperPage,
});

export function PrintablePaperPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    type: string;
    spacing: number;
    margin: number;
    color: string;
    pages: number;
  }>({
    type: withDefault<string>(StringParam, 'grid'),
    spacing: withDefault<number>(NumberParam, 10),
    margin: withDefault<number>(NumberParam, 15),
    color: withDefault<string>(StringParam, '#94a3b8'),
    pages: withDefault<number>(NumberParam, 1),
  });
  const options = {
    type: query.type ?? 'grid',
    spacing: query.spacing ?? 10,
    margin: query.margin ?? 15,
    color: query.color ?? '#94a3b8',
    pages: query.pages ?? 1,
  };
  const [text, setText] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  let sheets: PaperSheet[] = [];
  let validation: string | null = null;
  try {
    sheets = createPaperSheets({ ...options, text });
  } catch (cause) {
    validation = t(`printablePaper.${(cause as Error).message}`);
  }
  const currentPage = Math.min(pageIndex, Math.max(0, sheets.length - 1));
  const sheet = sheets[currentPage];
  const exportPdf = async () => {
    const id = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const bytes = await createPaperPdf({ ...options, text });
      if (generation.current === id)
        downloadBytes(bytes, `${options.type}-A4.pdf`, 'application/pdf');
    } catch (cause) {
      if (generation.current === id)
        setError(
          t('printablePaper.error', {
            msg: t(`printablePaper.${(cause as Error).message}`, {
              defaultValue: (cause as Error).message,
            }),
          }),
        );
    } finally {
      if (generation.current === id) setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('printablePaper.title')}</h1>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="paper-type">{t('printablePaper.type')}</Label>
            <Select
              value={options.type}
              onValueChange={(type) => {
                setQuery({
                  type,
                  ...(type === 'practice' && options.spacing < 8
                    ? { spacing: 12 }
                    : {}),
                });
                setPageIndex(0);
              }}
            >
              <SelectTrigger id="paper-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`printablePaper.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(
            [
              'spacing',
              'margin',
              ...(options.type === 'practice' ? [] : ['pages']),
            ] as Array<'spacing' | 'margin' | 'pages'>
          ).map((key) => (
            <div className="space-y-1.5" key={key}>
              <Label htmlFor={`paper-${key}`}>
                {t(`printablePaper.${key}`)}
              </Label>
              <Input
                id={`paper-${key}`}
                type="number"
                min={
                  key === 'spacing'
                    ? options.type === 'practice'
                      ? 8
                      : 3
                    : key === 'margin'
                      ? 5
                      : 1
                }
                max={key === 'spacing' ? 30 : key === 'margin' ? 40 : 20}
                step={key === 'pages' ? 1 : 0.5}
                value={options[key]}
                onChange={(event) =>
                  setQuery({ [key]: Number(event.target.value) })
                }
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="paper-color">{t('printablePaper.color')}</Label>
            <Input
              id="paper-color"
              type="color"
              value={options.color}
              onChange={(event) => setQuery({ color: event.target.value })}
            />
          </div>
          {options.type === 'practice' && (
            <div className="space-y-1.5">
              <Label htmlFor="paper-text">{t('printablePaper.text')}</Label>
              <Textarea
                id="paper-text"
                value={text}
                placeholder={t('printablePaper.textPlaceholder')}
                onChange={(event) => {
                  setText(event.target.value);
                  setPageIndex(0);
                }}
              />
            </div>
          )}
          {(validation || error) && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {validation || error}
            </p>
          )}
          <Button disabled={busy || !sheet} onClick={() => void exportPdf()}>
            <Download className="h-4 w-4" />
            {t(busy ? 'printablePaper.exporting' : 'printablePaper.download')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t('printablePaper.printHint')}
          </p>
        </div>
        <div className="space-y-3">
          {sheet && (
            <svg
              viewBox="0 0 210 297"
              role="img"
              aria-label={t('printablePaper.preview')}
              className="h-auto w-full border bg-white shadow-sm"
            >
              <rect width="210" height="297" fill="white" />
              {sheet.lines.map((line, index) => (
                <line
                  key={index}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={options.color}
                  strokeWidth="0.14"
                  strokeDasharray={line.dashed ? '0.7 0.7' : undefined}
                />
              ))}
              {sheet.dots.map((dot, index) => (
                <circle
                  key={index}
                  cx={dot.x}
                  cy={dot.y}
                  r="0.124"
                  fill={options.color}
                />
              ))}
              {sheet.glyphs.map((glyph, index) => (
                <text
                  key={index}
                  x={glyph.x}
                  y={glyph.y}
                  fontFamily="serif"
                  fontSize={glyph.size}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="black"
                  opacity={glyph.opacity}
                >
                  {glyph.text}
                </text>
              ))}
            </svg>
          )}
          {sheets.length > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0}
                onClick={() => setPageIndex(currentPage - 1)}
              >
                {t('printablePaper.previous')}
              </Button>
              <span className="text-sm">
                {t('printablePaper.page', {
                  page: currentPage + 1,
                  total: sheets.length,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === sheets.length - 1}
                onClick={() => setPageIndex(currentPage + 1)}
              >
                {t('printablePaper.next')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
