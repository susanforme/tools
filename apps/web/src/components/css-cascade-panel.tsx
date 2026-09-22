import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '@/hooks/useQueryParams';
import { createCascadeDocument, type CascadeResult } from '@/lib/css-cascade';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const EXAMPLE =
  '@layer base, theme;\n@layer base { #sample { color: red; } }\n@layer theme { .card { color: blue; } }\n.card { color: green; }';
export default function CssCascadePanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    selector: string;
    property: string;
  }>({
    selector: withDefault<string>(StringParam, '#sample'),
    property: withDefault<string>(StringParam, 'color'),
  });
  const [html, setHtml] = useState(
    '<div id="sample" class="card">Hello CSS</div>',
  );
  const [css, setCss] = useState(EXAMPLE);
  const [doc, setDoc] = useState('');
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const active = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    active.current = '';
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    setResult(null);
    setDoc('');
    setError(null);
  }, [html, css, query.selector, query.property]);
  useEffect(() => {
    const onMessage = (event: MessageEvent<CascadeResult & { id: string }>) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.id !== active.current
      )
        return;
      if (timer.current) clearTimeout(timer.current);
      setBusy(false);
      if (event.data.error) setError(event.data.error);
      else setResult(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (timer.current) clearTimeout(timer.current);
      active.current = '';
    };
  }, []);
  const run = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    const id = crypto.randomUUID();
    active.current = id;
    try {
      const next = await createCascadeDocument(
        html,
        css,
        query.selector ?? '#sample',
        query.property ?? 'color',
        id,
      );
      if (active.current !== id) return;
      setDoc(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setError(t('browserInspection.timeout'));
        setBusy(false);
      }, 5000);
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cascade-html">HTML</Label>
          <Textarea
            id="cascade-html"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="min-h-52 font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cascade-css">CSS</Label>
          <Textarea
            id="cascade-css"
            value={css}
            onChange={(e) => setCss(e.target.value)}
            className="min-h-52 font-mono text-xs"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cascade-selector">
            {t('browserInspection.selector')}
          </Label>
          <Input
            id="cascade-selector"
            value={query.selector}
            onChange={(e) => setQuery({ selector: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cascade-property">
            {t('browserInspection.property')}
          </Label>
          <Input
            id="cascade-property"
            value={query.property}
            onChange={(e) => setQuery({ property: e.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('browserInspection.cascadeScope')}
      </p>
      <Button onClick={() => void run()} disabled={busy}>
        {t(busy ? 'browserInspection.loading' : 'browserInspection.analyze')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('browserInspection.failed', { message: error })}
        </p>
      )}
      {doc && (
        <iframe
          ref={frame}
          title={t('browserInspection.preview')}
          srcDoc={doc}
          sandbox="allow-scripts"
          className="h-32 w-full rounded border bg-white"
        />
      )}
      {result && (
        <>
          <p className="text-sm">
            {t('browserInspection.computed', {
              value: result.computed || '—',
              count: result.matched,
            })}
          </p>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {['selector', 'value', 'context', 'winner'].map((key) => (
                    <th key={key} className="p-2">
                      {t(`browserInspection.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((row, index) => (
                  <tr
                    key={index}
                    className={
                      row.winner ? 'border-t bg-primary/10' : 'border-t'
                    }
                  >
                    <td className="p-2 font-mono">{row.selector}</td>
                    <td className="p-2 font-mono">
                      {row.value}
                      {row.important ? ' !important' : ''}
                    </td>
                    <td className="p-2 font-mono">
                      {row.context || t('browserInspection.unlayered')}
                    </td>
                    <td className="p-2">{row.winner ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
