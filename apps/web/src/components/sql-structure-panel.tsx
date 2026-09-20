import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import { StringParam, useQueryParam } from '../hooks/useQueryParams';
import type {
  SqlStructureRequest,
  SqlStructureResult,
} from '../lib/sql-structure';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';
const createWorker = () =>
  new Worker(new URL('../workers/sql-structure.worker.ts', import.meta.url), {
    type: 'module',
  });
const SAMPLE = {
  dependencies:
    'WITH recent AS (SELECT * FROM public.orders WHERE created_at > CURRENT_DATE)\nSELECT u.id, r.id FROM users u JOIN recent r ON u.id = r.user_id;',
  ddl: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));\nCREATE TABLE orders (id INT PRIMARY KEY, user_id INT NOT NULL,\n  FOREIGN KEY (user_id) REFERENCES users(id));',
};
export default function SqlStructurePanel({
  mode,
}: {
  mode: 'dependencies' | 'ddl';
}) {
  const { t } = useTranslation();
  const [dialect, setDialect] = useQueryParam<string>(
    'structureDialect',
    StringParam,
    'postgresql',
  );
  const [source, setSource] = useState(SAMPLE[mode]);
  const [imageUrl, setImageUrl] = useState('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const rendering = useRef(0);
  const { result, error, busy, run, clear, cancel } = useBoundedWorker<
    SqlStructureRequest,
    SqlStructureResult
  >(createWorker, 25000);
  useEffect(() => {
    clear();
  }, [dialect, clear]);
  useEffect(() => {
    const generation = ++rendering.current;
    let url = '';
    setImageUrl('');
    setRenderError(null);
    if (result?.diagram)
      void (async () => {
        try {
          const [{ default: mermaid }, { default: DOMPurify }] =
            await Promise.all([import('mermaid'), import('dompurify')]);
          if (generation !== rendering.current) return;
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            maxTextSize: 100000,
            maxEdges: 1000,
          });
          const rendered = await mermaid.render(
            `sql-er-${crypto.randomUUID()}`,
            result.diagram,
          );
          if (generation !== rendering.current) return;
          const svg = DOMPurify.sanitize(rendered.svg, {
            // Mermaid ER 的单元格使用 foreignObject，保留经过清理的 HTML 标签。
            USE_PROFILES: { html: true, svg: true, svgFilters: true },
            ADD_TAGS: ['foreignObject'],
            HTML_INTEGRATION_POINTS: { foreignobject: true },
          });
          url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
          setImageUrl(url);
        } catch (cause) {
          if (generation === rendering.current)
            setRenderError((cause as Error).message);
        }
      })();
    return () => {
      rendering.current++;
      if (url) URL.revokeObjectURL(url);
    };
  }, [result]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t(`communitySchema.${mode}Hint`)}
      </p>
      <div className="space-y-2">
        <Label htmlFor={`sql-${mode}-source`}>
          {t('communitySchema.source')}
        </Label>
        <Textarea
          id={`sql-${mode}-source`}
          value={source}
          onChange={(event) => {
            clear();
            setSource(event.target.value);
          }}
          className="min-h-56 font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={dialect} onValueChange={setDialect}>
          <SelectTrigger
            className="w-40"
            aria-label={t('communitySchema.dialect')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postgresql">PostgreSQL</SelectItem>
            <SelectItem value="mysql">MySQL</SelectItem>
          </SelectContent>
        </Select>
        <Button
          disabled={busy}
          onClick={() =>
            run({
              source,
              mode,
              dialect: dialect === 'mysql' ? 'mysql' : 'postgresql',
            })
          }
        >
          {t(busy ? 'communitySchema.running' : 'communitySchema.analyze')}
        </Button>
        {busy && (
          <Button variant="outline" onClick={cancel}>
            {t('communitySchema.cancel')}
          </Button>
        )}
      </div>
      {(error || renderError) && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('communitySchema.failed', {
            message: t(`communitySchema.errors.${error ?? renderError}`, {
              defaultValue: error ?? renderError ?? '',
            }),
          })}
        </p>
      )}
      {imageUrl && (
        <div className="overflow-auto rounded-md border">
          <img
            src={imageUrl}
            alt={t('communitySchema.ddlTitle')}
            className="mx-auto max-w-full"
          />
        </div>
      )}
      {result && (
        <div className="space-y-2">
          <p role="status" className="text-sm">
            {t('communitySchema.complete')}
          </p>
          <Label htmlFor={`sql-${mode}-output`}>
            {t('communitySchema.output')}
          </Label>
          <Textarea
            id={`sql-${mode}-output`}
            readOnly
            value={result.output}
            className="min-h-64 font-mono text-xs"
          />
          {result.diagram && (
            <>
              <Label htmlFor="sql-mermaid">Mermaid</Label>
              <Textarea
                id="sql-mermaid"
                readOnly
                value={result.diagram}
                className="min-h-32 font-mono text-xs"
              />
              <Button variant="outline" disabled={!imageUrl} asChild>
                <a href={imageUrl || undefined} download="schema-er.svg">
                  {t('communitySchema.downloadSvg')}
                </a>
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
