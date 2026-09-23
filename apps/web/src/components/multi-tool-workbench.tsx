import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBytes } from '@/lib/download';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';

export type WorkbenchResult = {
  output: string;
  download?: { bytes: Uint8Array; name: string; type: string };
};

export type WorkbenchTool = {
  id: string;
  fields: readonly {
    id: string;
    label: string;
    sample?: string;
    kind?: 'text' | 'number' | 'file';
    accept?: string;
  }[];
  run: (
    values: Record<string, string>,
    file: File | null,
  ) => WorkbenchResult | Promise<WorkbenchResult>;
};

export function MultiToolWorkbench({
  title,
  tools,
}: {
  title: string;
  tools: readonly WorkbenchTool[];
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<string>(
    'mode',
    StringParam,
    tools[0]!.id,
  );
  const active = tools.find((tool) => tool.id === mode) ?? tools[0]!;
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Tabs value={active.id} onValueChange={setMode}>
        <TabsList className="max-w-full flex-wrap group-data-[orientation=horizontal]/tabs:h-auto">
          {tools.map((tool) => (
            <TabsTrigger
              key={tool.id}
              value={tool.id}
              className="h-auto flex-none"
            >
              {t(`nextTools.${tool.id}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <WorkbenchPanel key={active.id} tool={active} />
    </div>
  );
}

function WorkbenchPanel({ tool }: { tool: WorkbenchTool }) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      tool.fields.map((field) => [field.id, field.sample ?? '']),
    ),
  );
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<WorkbenchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function process() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await tool.run(values, file));
    } catch (cause) {
      setError(`${t('nextTools.failed')}：${(cause as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t(`nextTools.${tool.id}`)}</h2>
      {tool.fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={`${tool.id}-${field.id}`}>
            {t(`nextTools.${field.label}`)}
          </Label>
          {field.kind === 'file' ? (
            <Input
              id={`${tool.id}-${field.id}`}
              type="file"
              accept={field.accept}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
          ) : field.kind === 'number' ? (
            <Input
              id={`${tool.id}-${field.id}`}
              type="number"
              value={values[field.id] ?? ''}
              onChange={(event) => {
                setValues({ ...values, [field.id]: event.target.value });
                setResult(null);
              }}
            />
          ) : (
            <Textarea
              id={`${tool.id}-${field.id}`}
              className="min-h-24 font-mono text-xs"
              value={values[field.id] ?? ''}
              onChange={(event) => {
                setValues({ ...values, [field.id]: event.target.value });
                setResult(null);
              }}
            />
          )}
        </div>
      ))}
      <Button disabled={busy} onClick={() => void process()}>
        {busy ? t('nextTools.processing') : t('nextTools.run')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-3">
          <Label htmlFor={`${tool.id}-result`}>{t('nextTools.result')}</Label>
          <Textarea
            id={`${tool.id}-result`}
            readOnly
            className="min-h-40 font-mono text-xs"
            value={result.output}
          />
          <Button
            variant="outline"
            onClick={() => void navigator.clipboard.writeText(result.output)}
          >
            {t('nextTools.copy')}
          </Button>
          {result.download && (
            <Button
              variant="outline"
              onClick={() =>
                downloadBytes(
                  result.download!.bytes,
                  result.download!.name,
                  result.download!.type,
                )
              }
            >
              {t('nextTools.download')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
