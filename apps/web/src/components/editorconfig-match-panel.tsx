import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorConfigMatch } from '../lib/editorconfig-match';
import ImportResultsTable from './import-results-table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
const EXAMPLE = JSON.stringify(
  [
    {
      path: '/.editorconfig',
      content:
        'root = true\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf',
    },
    {
      path: '/src/.editorconfig',
      content:
        '[*.{ts,tsx}]\nindent_size = 4\n[generated/**]\nindent_size = unset',
    },
  ],
  null,
  2,
);
export default function EditorConfigMatchPanel() {
  const { t } = useTranslation();
  const tr = (key: string) => t(`performanceImport.${key}`);
  const [input, setInput] = useState(EXAMPLE),
    [target, setTarget] = useState('/src/app.ts');
  const [result, setResult] = useState<EditorConfigMatch | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const clear = () => {
    generation.current++;
    setResult(null);
    setError(null);
    setBusy(false);
  };
  const run = async () => {
    const id = ++generation.current;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const { matchEditorConfig } = await import('../lib/editorconfig-match');
      const result = await matchEditorConfig(target, input);
      if (id === generation.current) setResult(result);
    } catch (cause) {
      if (id === generation.current) setError((cause as Error).message);
    } finally {
      if (id === generation.current) setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{tr('editorHint')}</p>
      <Label htmlFor="editor-target">{tr('targetPath')}</Label>
      <Input
        id="editor-target"
        value={target}
        onChange={(e) => {
          clear();
          setTarget(e.target.value);
        }}
      />
      <Label htmlFor="editor-configs">{tr('configs')}</Label>
      <Textarea
        id="editor-configs"
        value={input}
        onChange={(e) => {
          clear();
          setInput(e.target.value);
        }}
        className="min-h-64 font-mono text-xs"
      />
      <Button disabled={busy} onClick={() => void run()}>
        {tr(busy ? 'loading' : 'analyze')}
      </Button>
      {error && (
        <p role="alert" className="text-destructive">
          {tr('failed')}：
          {t(`performanceImport.errors.${error}`, { defaultValue: error })}
        </p>
      )}
      {result && (
        <>
          <h2 className="font-semibold">{tr('effective')}</h2>
          <ImportResultsTable
            headers={[tr('property'), tr('value'), tr('source')]}
            rows={result.properties.map((row) => [
              row.key,
              row.value,
              row.source,
            ])}
          />
          <h2 className="font-semibold">{tr('history')}</h2>
          <ImportResultsTable
            headers={[tr('property'), tr('value'), tr('source')]}
            rows={result.history.map((row) => [row.key, row.value, row.source])}
          />
        </>
      )}
    </div>
  );
}
