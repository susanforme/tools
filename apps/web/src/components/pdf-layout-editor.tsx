import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { type RedactRect, validateRect } from '@/lib/document-workspace-core';
import { rebuildPdf } from '@/lib/pdf-layout-processing';
import { renderPdfPage } from '@/lib/pdf-tools';
import { downloadBytes } from '@/lib/download';
import { PracticalText, useLatestJob } from './practical-ui';
import { ChoiceField, NumberField } from './calculator-ui';
import { DocumentError } from './document-workspace-ui';
import { Input } from './ui/input';
import { Button } from './ui/button';
export function PdfLayoutPanel() {
  const { t } = useTranslation();
  const [q, setQ] = useQueryParams<{
    paper: string;
    crop: number;
    numbers: number;
  }>({ paper: StringParam, crop: NumberParam, numbers: NumberParam });
  const [file, setFile] = useState<File | null>(null);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [header, setHeader] = useState(''),
    [footer, setFooter] = useState('');
  const [rectangles, setRectangles] = useState<RedactRect[]>([]);
  const [error, setError] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const preview = useLatestJob<Awaited<ReturnType<typeof renderPdfPage>>>(
    `${revision}-${page}`,
  );
  const job = useLatestJob<Uint8Array>(
    JSON.stringify([revision, q, header, footer, rectangles]),
  );
  const paper = q.paper ?? 'original';
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('documentWorkspaces.pdfHint')}
      </p>
      <Input
        type="file"
        accept=".pdf,application/pdf"
        aria-label={t('documentWorkspaces.files')}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setRevision((v) => v + 1);
          setPage(1);
          setRectangles([]);
          setError(null);
        }}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('documentWorkspaces.paper')}
          value={paper}
          options={['original', 'a4', 'letter'].map((value) => ({
            value,
            label: t(`documentWorkspaces.${value}`),
          }))}
          onChange={(paper) => setQ({ paper })}
        />
        <ChoiceField
          label={t('documentWorkspaces.crop')}
          value={String(q.crop ?? 0)}
          options={[
            { value: '0', label: t('documentWorkspaces.no') },
            { value: '1', label: t('documentWorkspaces.yes') },
          ]}
          onChange={(v) => setQ({ crop: +v })}
        />
        <ChoiceField
          label={t('documentWorkspaces.numbers')}
          value={String(q.numbers ?? 1)}
          options={[
            { value: '0', label: t('documentWorkspaces.no') },
            { value: '1', label: t('documentWorkspaces.yes') },
          ]}
          onChange={(v) => setQ({ numbers: +v })}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <PracticalText
          label={t('documentWorkspaces.header')}
          value={header}
          onChange={setHeader}
          maxLength={120}
        />
        <PracticalText
          label={t('documentWorkspaces.footer')}
          value={footer}
          onChange={setFooter}
          maxLength={120}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <NumberField
          label={t('documentWorkspaces.page')}
          value={page}
          min={1}
          max={50}
          step={1}
          onChange={setPage}
        />
        <Button
          disabled={!file || preview.busy}
          variant="outline"
          onClick={() =>
            void preview.run(async () => {
              if (
                !file ||
                file.size > 20 * 1024 * 1024 ||
                !Number.isInteger(page) ||
                page < 1 ||
                page > 50
              )
                throw new Error('size');
              return renderPdfPage(file, page);
            })
          }
        >
          {t('documentWorkspaces.previewPage')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('documentWorkspaces.redactHint')}
      </p>
      {preview.result && (
        <svg
          viewBox={`0 0 ${preview.result.page.width} ${preview.result.page.height}`}
          className="max-h-[600px] w-full touch-none select-none rounded border"
          role="img"
          aria-label={t('documentWorkspaces.redactPreview')}
          onPointerDown={(e) => {
            const svg = e.currentTarget;
            const matrix = svg.getScreenCTM();
            if (!matrix) return;
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              matrix.inverse(),
            );
            if (
              p.x < 0 ||
              p.y < 0 ||
              p.x > preview.result!.page.width ||
              p.y > preview.result!.page.height
            )
              return;
            start.current = {
              x: (p.x / preview.result!.page.width) * 100,
              y: (p.y / preview.result!.page.height) * 100,
            };
            svg.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (!start.current) return;
            const matrix = e.currentTarget.getScreenCTM();
            if (!matrix) return;
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              matrix.inverse(),
            );
            const x = Math.max(
                0,
                Math.min(100, (p.x / preview.result!.page.width) * 100),
              ),
              y = Math.max(
                0,
                Math.min(100, (p.y / preview.result!.page.height) * 100),
              );
            const rect = {
              page,
              x: Math.min(x, start.current.x),
              y: Math.min(y, start.current.y),
              width: Math.abs(x - start.current.x),
              height: Math.abs(y - start.current.y),
            };
            start.current = null;
            try {
              validateRect(rect);
              if (rectangles.length >= 100) throw new Error('limit');
              setRectangles([...rectangles, rect]);
              setError(null);
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
          onPointerCancel={() => {
            start.current = null;
          }}
        >
          <image
            href={preview.result.page.dataUrl}
            width={preview.result.page.width}
            height={preview.result.page.height}
          />
          {rectangles
            .filter((r) => r.page === page)
            .map((r, i) => (
              <rect
                key={i}
                x={`${r.x}%`}
                y={`${r.y}%`}
                width={`${r.width}%`}
                height={`${r.height}%`}
                fill="black"
              />
            ))}
        </svg>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={rectangles.length >= 100}
          onClick={() =>
            setRectangles([
              ...rectangles,
              { page, x: 10, y: 10, width: 20, height: 10 },
            ])
          }
        >
          {t('documentWorkspaces.addRect')}
        </Button>
        <Button
          variant="outline"
          disabled={!rectangles.length}
          onClick={() => setRectangles(rectangles.slice(0, -1))}
        >
          {t('documentWorkspaces.undo')}
        </Button>
      </div>
      {rectangles.map((rect, i) => (
        <div key={i} className="grid gap-2 rounded border p-2 md:grid-cols-5">
          {(['page', 'x', 'y', 'width', 'height'] as const).map((key) => (
            <NumberField
              key={key}
              label={t(`documentWorkspaces.${key}`)}
              value={rect[key]}
              min={key === 'page' ? 1 : 0}
              max={key === 'page' ? 50 : 100}
              onChange={(value) =>
                setRectangles(
                  rectangles.map((r, n) =>
                    n === i ? { ...r, [key]: value } : r,
                  ),
                )
              }
            />
          ))}
        </div>
      ))}
      <Button
        disabled={!file || job.busy}
        onClick={() =>
          void job.run(async () => {
            if (!file) throw new Error('document');
            return rebuildPdf(file, {
              paper,
              crop: q.crop === 1,
              numbers: q.numbers !== 0,
              header,
              footer,
              rectangles,
            });
          })
        }
      >
        {t(
          job.busy ? 'documentWorkspaces.processing' : 'documentWorkspaces.generate',
        )}
      </Button>
      <DocumentError error={error ?? job.error ?? preview.error} />
      {job.result && (
        <Button
          onClick={() =>
            downloadBytes(job.result!, 'processed.pdf', 'application/pdf')
          }
        >
          {t('documentWorkspaces.download')}
        </Button>
      )}
    </div>
  );
}
