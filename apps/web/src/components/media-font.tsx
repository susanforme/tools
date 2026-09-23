import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { layoutCss, escapeHtml, type LayoutFont } from '@/lib/media-font';
import { ChoiceField, NumberField } from './calculator-ui';
import { FileDropzone } from './file-dropzone';
import { PracticalText, ExportText } from './practical-ui';
import { Button } from './ui/button';
const createWorker = () =>
  new Worker(new URL('../workers/media-font.worker.ts', import.meta.url), {
    type: 'module',
  });
export function MediaFont() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    heading: string;
    body: string;
    minimum: number;
    maximum: number;
    spacing: number;
    leading: number;
    axes: string;
    viewport: number;
  }>({
    heading: StringParam,
    body: StringParam,
    minimum: NumberParam,
    maximum: NumberParam,
    spacing: NumberParam,
    leading: NumberParam,
    axes: StringParam,
    viewport: NumberParam,
  });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [heading, setHeading] = useState('排版 Typography'),
    [paragraph, setParagraph] = useState(
      '文字让想法清晰可见。调整字体组合、字距和行距，找到适合阅读的节奏。\nTypography brings ideas to life. Find a comfortable rhythm for your readers.',
    );
  const task = useBoundedWorker<File[], LayoutFont[]>(createWorker, 30000),
    fonts = task.result ?? [];
  let css = '',
    error: string | null = uploadError,
    axes: Record<string, number> = {};
  try {
    const parsed: unknown = JSON.parse(query.axes ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('invalid');
    axes = parsed as Record<string, number>;
    css = layoutCss(
      {
        heading: query.heading ?? 'serif',
        body: query.body ?? 'sans-serif',
        minimum: query.minimum ?? 16,
        maximum: query.maximum ?? 22,
        spacing: query.spacing ?? 0,
        leading: query.leading ?? 1.6,
        axes,
      },
      fonts,
    );
  } catch (cause) {
    error = (cause as Error).message;
  }
  const options = [
    'serif',
    'sans-serif',
    'monospace',
    ...fonts.map((_, i) => `Uploaded${i}`),
  ].map((value) => ({
    value,
    label: value.startsWith('Uploaded')
      ? fonts[Number(value.replace('Uploaded', ''))].name
      : value,
  }));
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('mediaWorkflow.fontLimit')}
      </p>
      <FileDropzone
        accept=".ttf,.otf,.woff,.woff2"
        multiple
        onFiles={(files) => {
          setUploadError(null);
          if (files.length > 2) {
            setUploadError('limit');
            return;
          }
          setQuery({ heading: 'serif', body: 'sans-serif', axes: '{}' });
          task.run(files.map((f) => f.file));
        }}
      >
        {t('mediaWorkflow.fontUpload')}
      </FileDropzone>
      {task.busy && (
        <Button variant="outline" onClick={task.cancel}>
          {t('studio20.cancel')}
        </Button>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <ChoiceField
          label={t('mediaWorkflow.headingFont')}
          value={query.heading ?? 'serif'}
          options={options}
          onChange={(heading) => setQuery({ heading })}
        />
        <ChoiceField
          label={t('mediaWorkflow.bodyFont')}
          value={query.body ?? 'sans-serif'}
          options={options}
          onChange={(body) => setQuery({ body })}
        />
        {(
          ['minimum', 'maximum', 'spacing', 'leading', 'viewport'] as const
        ).map((key, i) => (
          <NumberField
            key={key}
            label={t(`mediaWorkflow.${key}`)}
            value={query[key] ?? [16, 22, 0, 1.6, 800][i]}
            min={[8, 8, -5, 0.8, 240][i]}
            max={[120, 120, 20, 3, 1600][i]}
            onChange={(value) => setQuery({ [key]: value })}
          />
        ))}
      </div>
      {fonts.flatMap((font, index) =>
        font.axes.map((axis) => (
          <NumberField
            key={`${index}-${axis.tag}`}
            label={`${font.name} · ${axis.name} (${axis.tag})`}
            min={axis.min}
            max={axis.max}
            value={axes[`${index}-${axis.tag}`] ?? axis.default}
            onChange={(value) =>
              setQuery({
                axes: JSON.stringify({
                  ...axes,
                  [`${index}-${axis.tag}`]: value,
                }),
              })
            }
          />
        )),
      )}
      <PracticalText
        label={t('mediaWorkflow.heading')}
        value={heading}
        onChange={setHeading}
        maxLength={500}
      />
      <PracticalText
        label={t('mediaWorkflow.paragraph')}
        value={paragraph}
        onChange={setParagraph}
        multiline
        maxLength={10000}
      />
      {css && (
        <>
          <iframe
            title={t('mediaWorkflow.typesetting')}
            sandbox=""
            className="h-96 max-w-full rounded border bg-white"
            width={Math.max(240, Math.min(1600, query.viewport ?? 800))}
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:"><style>body{padding:24px;margin:0;color:#111;overflow-wrap:anywhere}p{white-space:pre-wrap}${css}</style></head><body><h2 class="heading">${escapeHtml(heading)}</h2><p class="body">${escapeHtml(paragraph)}</p></body></html>`}
          />
          <ExportText value={css} name="typography.css" type="text/css" />
        </>
      )}
      {(error || task.error) && (
        <p role="alert" className="text-destructive">
          {t('mediaWorkflow.failed', {
            message: t(`mediaWorkflow.${error ?? task.error}`, {
              defaultValue: error ?? task.error ?? '',
            }),
          })}
        </p>
      )}
    </section>
  );
}
