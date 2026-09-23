import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  OFFICE_MODES,
  buildOfficeDocument,
  type OfficeMode,
} from '@/lib/practical-workbenches';
import { createFileRoute } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/office-workbench')({
  component: OfficeWorkbenchPage,
});

function OfficeWorkbenchPage() {
  const { t } = useTranslation();
  const [queryMode, setMode] = useQueryParam<OfficeMode>(
    'tool',
    StringParam,
    'agenda',
  );
  const mode = OFFICE_MODES.includes(queryMode) ? queryMode : 'agenda';
  const [stored, setStored] = useState<Record<string, string>>({});
  const [startTime, setStartTime] = useState('09:00');
  const input =
    stored[mode] ?? t(`practicalWorkbenches.office.examples.${mode}`);
  const headers =
    mode === 'raci'
      ? ['task', 'responsible', 'accountable', 'consulted', 'informed']
      : mode === 'stockCount'
        ? [
            'sku',
            'expected',
            'counted',
            'difference',
            'unitCost',
            'valueDifference',
          ]
        : [];
  let output: ReturnType<typeof buildOfficeDocument> | null = null;
  let error: string | null = null;
  try {
    output = buildOfficeDocument(
      mode,
      input,
      startTime,
      headers.map((key) => t(`practicalWorkbenches.office.csv.${key}`)),
    );
  } catch (cause) {
    error = (cause as Error).message;
  }
  const exportOutput = () => {
    if (!output) return;
    downloadBlob(
      new Blob([output.content], {
        type:
          output.extension === 'csv'
            ? 'text/csv;charset=utf-8'
            : 'text/markdown;charset=utf-8',
      }),
      `${mode}.${output.extension}`,
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t('practicalWorkbenches.groups.office.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('practicalWorkbenches.groups.office.description')}
        </p>
      </div>
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as OfficeMode)}
      >
        <TabsList className="h-auto flex-wrap">
          {OFFICE_MODES.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`practicalWorkbenches.office.modes.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        {t(`practicalWorkbenches.office.help.${mode}`)}
      </p>
      {mode === 'agenda' && (
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="agenda-start">
            {t('practicalWorkbenches.office.startTime')}
          </Label>
          <Input
            id="agenda-start"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="office-source">
            {t('practicalWorkbenches.office.input')}
          </Label>
          <Textarea
            id="office-source"
            className="min-h-72 font-mono"
            value={input}
            onChange={(event) =>
              setStored((current) => ({
                ...current,
                [mode]: event.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="office-result">
            {t('practicalWorkbenches.office.output')}
          </Label>
          <Textarea
            id="office-result"
            className="min-h-72 font-mono"
            value={output?.content ?? ''}
            readOnly
          />
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t(`practicalWorkbenches.office.errors.${error}`, {
            defaultValue: t('practicalWorkbenches.office.errors.columns'),
          })}
        </p>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {t(`practicalWorkbenches.office.summary.${mode}`)}: {output?.summary}
        </p>
      )}
      <Button variant="outline" disabled={!output} onClick={exportOutput}>
        <Download className="h-4 w-4" />
        {t('practicalWorkbenches.export')}
      </Button>
    </div>
  );
}
