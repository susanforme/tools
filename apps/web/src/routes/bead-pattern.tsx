import { Checkbox } from '@/components/ui/checkbox';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import {
  CreativePage,
  CreativeProjectActions,
  CreativeTextField,
} from '@/components/creative-tool-controls';
import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  beadPdf,
  beadUsage,
  drawBeadGrid,
  GENERIC_BEAD_COLORS,
  parseBeadColors,
  quantizeBeads,
  validateBeadProject,
  type BeadGrid,
} from '@/lib/bead-pattern';
import {
  canvasPng,
  decodeCreativeImage,
  readCreativeImage,
  type CreativeImage,
} from '@/lib/creative-tools';
import { downloadBlob, downloadBytes } from '@/lib/download';
import { boundedNumber } from '@/lib/focus-tools';
export const Route = createFileRoute('/bead-pattern')({
  component: BeadPatternPage,
});
function BeadPatternPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    columns: number;
    rows: number;
    colors: number;
    labels: string;
  }>({
    columns: NumberParam,
    rows: NumberParam,
    colors: NumberParam,
    labels: StringParam,
  });
  const columns = Math.round(boundedNumber(query.columns, 48, 8, 120)),
    rows = Math.round(boundedNumber(query.rows, 48, 8, 120)),
    limit = Math.round(boundedNumber(query.colors, 12, 1, 32)),
    labels = query.labels !== 'off';
  const [image, setImage] = useState<CreativeImage | null>(null),
    [grid, setGrid] = useState<BeadGrid | null>(null),
    [history, setHistory] = useState<BeadGrid[]>([]),
    [palette, setPalette] = useState(GENERIC_BEAD_COLORS.join(', '));
  const [paint, setPaint] = useState(0),
    [cellX, setCellX] = useState(1),
    [cellY, setCellY] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    job = useRef<AbortController | null>(null),
    alive = useRef(true),
    loading = useRef(false),
    drag = useRef(false),
    beforeStroke = useRef<BeadGrid | null>(null),
    generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      job.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (canvas.current && grid) drawBeadGrid(canvas.current, grid, labels);
  }, [grid, labels]);
  const saveHistory = () => {
    if (grid) setHistory((previous) => [...previous.slice(-19), grid]);
  };
  const generate = async (source = image) => {
    if (!source || loading.current) return;
    loading.current = true;
    setBusy(true);
    setError(null);
    const ticket = ++generation.current;
    try {
      const colors = parseBeadColors(palette);
      const decoded = await decodeCreativeImage(source);
      if (!alive.current || ticket !== generation.current) return;
      const sampled = document.createElement('canvas');
      sampled.width = columns;
      sampled.height = rows;
      const context = sampled.getContext('2d');
      if (!context) throw new Error('creativeCommon.canvasError');
      context.drawImage(decoded, 0, 0, columns, rows);
      const next = quantizeBeads(
        context.getImageData(0, 0, columns, rows).data,
        columns,
        rows,
        colors,
        limit,
      );
      saveHistory();
      setGrid(next);
      setPaint(0);
    } catch (cause) {
      if (alive.current)
        setError(
          t((cause as Error).message, {
            defaultValue: t('creativeCommon.imageError'),
          }),
        );
    } finally {
      loading.current = false;
      if (alive.current && ticket === generation.current) setBusy(false);
    }
  };
  const upload = async (file: File) => {
    if (loading.current) return;
    loading.current = true;
    setBusy(true);
    const ticket = ++generation.current;
    try {
      const source = await readCreativeImage(file);
      if (!alive.current || ticket !== generation.current) return;
      setImage(source);
      loading.current = false;
      await generate(source);
    } catch (cause) {
      if (alive.current)
        setError(
          t((cause as Error).message, {
            defaultValue: t('creativeCommon.imageError'),
          }),
        );
    } finally {
      loading.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const paintCell = (x: number, y: number) =>
    setGrid((previous) => {
      if (
        !previous ||
        x < 0 ||
        y < 0 ||
        x >= previous.columns ||
        y >= previous.rows
      )
        return previous;
      const cells = [...previous.cells];
      cells[y * previous.columns + x] = Math.min(
        paint,
        previous.palette.length - 1,
      );
      return { ...previous, cells };
    });
  const print = async () => {
    if (!grid || busy) return;
    const controller = new AbortController();
    job.current = controller;
    setBusy(true);
    setError(null);
    try {
      const bytes = await beadPdf(
        grid,
        t('beadPattern.title'),
        t('beadPattern.generic'),
        controller.signal,
      );
      if (alive.current && !controller.signal.aborted)
        downloadBytes(bytes, 'bead-pattern.pdf', 'application/pdf');
    } catch (cause) {
      if (alive.current && !controller.signal.aborted)
        setError(
          t((cause as Error).message, {
            defaultValue: t('creativeCommon.saveError'),
          }),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <CreativePage title={t('beadPattern.title')}>
      <FileDropzone
        accept="image/*"
        disabled={busy}
        onFiles={(files) => {
          if (files[0]) void upload(files[0].file);
        }}
        className="flex min-h-24 items-center justify-center rounded-xl p-4"
      >
        {t('beadPattern.upload')}
      </FileDropzone>
      <p className="text-xs text-muted-foreground">
        {t('creativeCommon.imageLimit')}
      </p>
      <fieldset disabled={busy} className="grid gap-3 md:grid-cols-3">
        <NumberField
          label={t('beadPattern.columns')}
          value={columns}
          min={8}
          step={1}
          onChange={(value) =>
            setQuery({ columns: Math.round(boundedNumber(value, 48, 8, 120)) })
          }
        />
        <NumberField
          label={t('beadPattern.rows')}
          value={rows}
          min={8}
          step={1}
          onChange={(value) =>
            setQuery({ rows: Math.round(boundedNumber(value, 48, 8, 120)) })
          }
        />
        <NumberField
          label={t('beadPattern.colors')}
          value={limit}
          min={1}
          step={1}
          onChange={(value) =>
            setQuery({ colors: Math.round(boundedNumber(value, 12, 1, 32)) })
          }
        />
      </fieldset>
      <label className="block space-y-2 text-sm">
        <span>{t('beadPattern.generic')}</span>
        <Textarea
          disabled={busy}
          value={palette}
          onChange={(event) => setPalette(event.target.value)}
          maxLength={500}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!image || busy} onClick={() => void generate()}>
          {t('beadPattern.generate')}
        </Button>
        <Button
          variant="outline"
          disabled={!history.length || busy}
          onClick={() => {
            setGrid(history.at(-1)!);
            setHistory(history.slice(0, -1));
            setPaint(0);
          }}
        >
          {t('creativeCommon.undo')}
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={labels}
            onCheckedChange={(checked) =>
              setQuery({ labels: checked === true ? 'on' : 'off' })
            }
          />
          {t('beadPattern.labels')}
        </label>
      </div>
      {grid && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <ChoiceField
              label={t('beadPattern.paint')}
              value={String(Math.min(paint, grid.palette.length - 1))}
              onChange={(value) => setPaint(Number(value))}
              options={grid.palette.map((color, index) => ({
                value: String(index),
                label: `${index + 1} · ${color.toUpperCase()}`,
              }))}
            />
            <CreativeTextField
              label={t('beadPattern.replaceColor')}
              type="color"
              value={grid.palette[Math.min(paint, grid.palette.length - 1)]}
              onChange={(value) => {
                saveHistory();
                setGrid({
                  ...grid,
                  palette: grid.palette.map((color, index) =>
                    index === paint ? value : color,
                  ),
                });
              }}
            />
            <NumberField
              label={t('beadPattern.column')}
              value={cellX}
              min={1}
              step={1}
              onChange={(value) =>
                setCellX(Math.round(boundedNumber(value, 1, 1, grid.columns)))
              }
            />
            <NumberField
              label={t('beadPattern.row')}
              value={cellY}
              min={1}
              step={1}
              onChange={(value) =>
                setCellY(Math.round(boundedNumber(value, 1, 1, grid.rows)))
              }
            />
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              saveHistory();
              paintCell(cellX - 1, cellY - 1);
            }}
          >
            {t('beadPattern.paintCell')}
          </Button>
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label={t('beadPattern.canvas')}
            className="max-w-full touch-none border"
            onPointerDown={(event) => {
              if (busy) return;
              drag.current = true;
              beforeStroke.current = grid;
              event.currentTarget.setPointerCapture(event.pointerId);
              const rect = event.currentTarget.getBoundingClientRect();
              paintCell(
                Math.floor(
                  ((event.clientX - rect.left) / rect.width) * grid.columns,
                ),
                Math.floor(
                  ((event.clientY - rect.top) / rect.height) * grid.rows,
                ),
              );
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              const rect = event.currentTarget.getBoundingClientRect();
              paintCell(
                Math.floor(
                  ((event.clientX - rect.left) / rect.width) * grid.columns,
                ),
                Math.floor(
                  ((event.clientY - rect.top) / rect.height) * grid.rows,
                ),
              );
            }}
            onPointerUp={() => {
              drag.current = false;
              if (beforeStroke.current) {
                const previous = beforeStroke.current;
                setHistory((items) => [...items.slice(-19), previous]);
                beforeStroke.current = null;
              }
            }}
            onPointerCancel={() => {
              drag.current = false;
              if (beforeStroke.current) setGrid(beforeStroke.current);
              beforeStroke.current = null;
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={async () => {
                try {
                  if (canvas.current) {
                    const blob = await canvasPng(canvas.current);
                    if (alive.current) downloadBlob(blob, 'bead-pattern.png');
                  }
                } catch {
                  if (alive.current) setError(t('creativeCommon.saveError'));
                }
              }}
            >
              {t('creativeCommon.png')}
            </Button>
            <Button disabled={busy} onClick={() => void print()}>
              {t('beadPattern.pdf')}
            </Button>
          </div>
          <p className="text-sm">
            {t('beadPattern.total', { count: grid.cells.length })}
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>{t('beadPattern.code')}</th>
                <th>{t('creativeCommon.color')}</th>
                <th>{t('beadPattern.count')}</th>
              </tr>
            </thead>
            <tbody>
              {beadUsage(grid).map((count, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{grid.palette[index].toUpperCase()}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <CreativeProjectActions
        name="bead-project"
        value={{ version: 1, image, grid }}
        disabled={busy}
        onImport={async (value) => {
          if (!validateBeadProject(value))
            throw new Error('creativeCommon.invalidProject');
          const ticket = ++generation.current;
          if (value.image) await decodeCreativeImage(value.image);
          if (!alive.current || ticket !== generation.current) return;
          setImage(value.image);
          setGrid(value.grid);
          setHistory([]);
          setPaint(0);
          if (value.grid) {
            setPalette(value.grid.palette.join(', '));
            setQuery({
              columns: value.grid.columns,
              rows: value.grid.rows,
              colors: value.grid.palette.length,
            });
          }
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </CreativePage>
  );
}
