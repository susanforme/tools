import { Checkbox } from '@/components/ui/checkbox';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceField, Metric, NumberField } from '@/components/calculator-ui';
import {
  CreativePage,
  CreativeProjectActions,
  CreativeTextField,
} from '@/components/creative-tool-controls';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  cutSheetSvg,
  planCuts,
  validateCutProject,
  type CutPart,
  type CutProject,
  type Grain,
} from '@/lib/cut-planner';
import { downloadBlob, downloadBytes } from '@/lib/download';
import { boundedNumber } from '@/lib/focus-tools';
export const Route = createFileRoute('/cut-planner')({
  component: CutPlannerPage,
});
const INITIAL_PARTS: CutPart[] = [
  {
    id: 'part-1',
    name: 'A',
    width: 600,
    height: 400,
    quantity: 4,
    rotate: true,
    grain: 'none',
  },
];
function CutPlannerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    width: number;
    height: number;
    sheets: number;
    kerf: number;
    grain: string;
  }>({
    width: NumberParam,
    height: NumberParam,
    sheets: NumberParam,
    kerf: NumberParam,
    grain: StringParam,
  });
  const [parts, setParts] = useState<CutPart[]>(INITIAL_PARTS),
    [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const project: CutProject = {
    version: 1,
    sheetWidth: boundedNumber(query.width, 2440, 1, 100000),
    sheetHeight: boundedNumber(query.height, 1220, 1, 100000),
    sheets: Math.round(boundedNumber(query.sheets, 5, 1, 50)),
    kerf: boundedNumber(query.kerf, 3, 0, 100),
    grain:
      query.grain === 'width' || query.grain === 'height'
        ? query.grain
        : 'none',
    parts,
  };
  const result = useMemo(() => {
    try {
      return planCuts(project);
    } catch {
      return null;
    }
  }, [
    project.sheetWidth,
    project.sheetHeight,
    project.sheets,
    project.kerf,
    project.grain,
    parts,
  ]);
  const update = (id: string, patch: Partial<CutPart>) =>
    setParts((previous) =>
      previous.map((part) => (part.id === id ? { ...part, ...patch } : part)),
    );
  const grainOptions = ['none', 'width', 'height'].map((value) => ({
    value,
    label: t(`cutPlanner.grain${value}`),
  }));
  const exportAll = async () => {
    try {
      if (!result) return;
      const { zipSync, strToU8 } = await import('fflate');
      if (!alive.current) return;
      const entries = Object.fromEntries(
        result.sheets.map((sheet, index) => [
          `sheet-${index + 1}.svg`,
          strToU8(cutSheetSvg(project, sheet)),
        ]),
      );
      downloadBytes(zipSync(entries), 'cut-plans.zip', 'application/zip');
    } catch {
      if (alive.current) setError(t('creativeCommon.saveError'));
    }
  };
  return (
    <CreativePage title={t('cutPlanner.title')}>
      <p className="text-sm text-muted-foreground">
        {t('cutPlanner.heuristic')}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <NumberField
          label={t('cutPlanner.sheetWidth')}
          value={project.sheetWidth}
          min={1}
          onChange={(value) =>
            setQuery({ width: boundedNumber(value, 2440, 1, 100000) })
          }
        />
        <NumberField
          label={t('cutPlanner.sheetHeight')}
          value={project.sheetHeight}
          min={1}
          onChange={(value) =>
            setQuery({ height: boundedNumber(value, 1220, 1, 100000) })
          }
        />
        <NumberField
          label={t('cutPlanner.sheets')}
          value={project.sheets}
          min={1}
          step={1}
          onChange={(value) =>
            setQuery({ sheets: Math.round(boundedNumber(value, 5, 1, 50)) })
          }
        />
        <NumberField
          label={t('cutPlanner.kerf')}
          value={project.kerf}
          onChange={(value) =>
            setQuery({ kerf: boundedNumber(value, 3, 0, 100) })
          }
        />
        <ChoiceField
          label={t('cutPlanner.sheetGrain')}
          value={project.grain}
          onChange={(value) => setQuery({ grain: value })}
          options={grainOptions}
        />
      </div>
      <div className="space-y-3">
        {parts.map((part) => (
          <div
            key={part.id}
            className="grid gap-3 rounded-lg border p-3 md:grid-cols-4"
          >
            <CreativeTextField
              label={t('cutPlanner.name')}
              value={part.name}
              maxLength={100}
              onChange={(value) => update(part.id, { name: value })}
            />
            <NumberField
              label={t('cutPlanner.width')}
              value={part.width}
              min={1}
              onChange={(value) =>
                update(part.id, { width: boundedNumber(value, 100, 1, 100000) })
              }
            />
            <NumberField
              label={t('cutPlanner.height')}
              value={part.height}
              min={1}
              onChange={(value) =>
                update(part.id, {
                  height: boundedNumber(value, 100, 1, 100000),
                })
              }
            />
            <NumberField
              label={t('cutPlanner.quantity')}
              value={part.quantity}
              min={1}
              step={1}
              onChange={(value) =>
                update(part.id, {
                  quantity: Math.round(boundedNumber(value, 1, 1, 300)),
                })
              }
            />
            <ChoiceField
              label={t('cutPlanner.partGrain')}
              value={part.grain}
              onChange={(value) => update(part.id, { grain: value as Grain })}
              options={grainOptions}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={part.rotate}
                onCheckedChange={(checked) =>
                  update(part.id, { rotate: checked === true })
                }
              />
              {t('cutPlanner.rotate')}
            </label>
            <Button
              variant="outline"
              onClick={() =>
                setParts((previous) =>
                  previous.filter((item) => item.id !== part.id),
                )
              }
            >
              {t('creativeCommon.remove')}
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        disabled={parts.length >= 50}
        onClick={() =>
          setParts((previous) => [
            ...previous,
            {
              id: crypto.randomUUID(),
              name: String.fromCharCode(65 + (previous.length % 26)),
              width: 300,
              height: 200,
              quantity: 1,
              rotate: true,
              grain: 'none',
            },
          ])
        }
      >
        {t('cutPlanner.add')}
      </Button>
      {!result && (
        <p role="alert" className="text-sm text-destructive">
          {t('cutPlanner.invalid')}
        </p>
      )}
      {result && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric
              label={t('cutPlanner.usedSheets')}
              value={String(result.sheets.length)}
            />
            <Metric
              label={t('cutPlanner.utilization')}
              value={`${result.utilization.toFixed(2)}%`}
            />
            <Metric
              label={t('cutPlanner.leftover')}
              value={`${(result.leftover / 1_000_000).toFixed(3)} m²`}
            />
            <Metric
              label={t('cutPlanner.kerfWaste')}
              value={`${(result.kerfWaste / 1_000_000).toFixed(3)} m²`}
            />
          </div>
          {result.unplaced.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              {t('cutPlanner.unplaced', { count: result.unplaced.length })}:{' '}
              {result.unplaced
                .slice(0, 30)
                .map((part) => part.name)
                .join(', ')}
            </p>
          )}
          {result.sheets.map((sheet, index) => (
            <div key={index} className="space-y-2 rounded border p-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {t('cutPlanner.sheet', { number: index + 1 })}
                </h2>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadBlob(
                      new Blob([cutSheetSvg(project, sheet)], {
                        type: 'image/svg+xml',
                      }),
                      `cut-sheet-${index + 1}.svg`,
                    )
                  }
                >
                  {t('creativeCommon.svg')}
                </Button>
              </div>
              <img
                alt={t('cutPlanner.sheet', { number: index + 1 })}
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(cutSheetSvg(project, sheet))}`}
                className="max-h-[60vh] w-full object-contain"
              />
              <details>
                <summary>
                  {t('cutPlanner.remnants')} ({sheet.free.length})
                </summary>
                <p className="text-sm text-muted-foreground">
                  {sheet.free
                    .map(
                      (rect) =>
                        `${rect.width.toFixed(1)} × ${rect.height.toFixed(1)} @ (${rect.x.toFixed(1)}, ${rect.y.toFixed(1)})`,
                    )
                    .join('; ')}
                </p>
              </details>
            </div>
          ))}
          <Button
            disabled={!result.sheets.length}
            onClick={() => void exportAll()}
          >
            {t('cutPlanner.zip')}
          </Button>
        </>
      )}
      <CreativeProjectActions
        name="cut-project"
        value={project}
        onImport={(value) => {
          if (!validateCutProject(value))
            throw new Error('creativeCommon.invalidProject');
          setParts(value.parts);
          setQuery({
            width: value.sheetWidth,
            height: value.sheetHeight,
            sheets: value.sheets,
            kerf: value.kerf,
            grain: value.grain,
          });
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
