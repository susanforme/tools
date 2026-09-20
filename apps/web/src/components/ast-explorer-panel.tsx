import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import { StringParam, useQueryParam } from '../hooks/useQueryParams';
import type { AstRequest, AstResult } from '../lib/ast-explorer';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
  new Worker(new URL('../workers/ast-explorer.worker.ts', import.meta.url), {
    type: 'module',
  });
const SAMPLE =
  'interface User { name: string }\nconst greet = (user: User): string => `Hello, ${user.name}`;';
export default function AstExplorerPanel() {
  const { t } = useTranslation();
  const [syntax, setSyntax] = useQueryParam<string>(
    'astSyntax',
    StringParam,
    'ts',
  );
  const [source, setSource] = useState(SAMPLE);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const { result, error, busy, run, clear, cancel } = useBoundedWorker<
    AstRequest,
    AstResult
  >(createWorker, 15000);
  useEffect(() => {
    clear();
    setSelected(0);
  }, [syntax, clear]);
  const current = result?.nodes[selected];
  const matches =
    result?.nodes.filter((node) =>
      `${node.type} ${node.summary}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  const visible = search
    ? matches.slice(0, 100)
    : (current?.children.slice(0, 100).map((id) => result!.nodes[id]!) ?? []);
  const select = (id: number) => {
    setSelected(id);
    const node = result?.nodes[id];
    if (node && editor.current) {
      editor.current.focus();
      editor.current.setSelectionRange(node.start, node.end);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('developerExpansion.astHint')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Select value={syntax} onValueChange={setSyntax}>
          <SelectTrigger
            className="w-36"
            aria-label={t('developerExpansion.syntax')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="js">JS / JSX</SelectItem>
            <SelectItem value="ts">TypeScript</SelectItem>
            <SelectItem value="tsx">TSX</SelectItem>
          </SelectContent>
        </Select>
        <Button
          disabled={busy}
          onClick={() => {
            setSelected(0);
            run({
              source,
              syntax: syntax === 'js' || syntax === 'tsx' ? syntax : 'ts',
            });
          }}
        >
          {t(
            busy ? 'developerExpansion.running' : 'developerExpansion.analyze',
          )}
        </Button>
        {busy && (
          <Button variant="outline" onClick={cancel}>
            {t('developerExpansion.cancel')}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="break-all text-sm text-destructive">
          {t('developerExpansion.failed', {
            message: t(`developerExpansion.errors.${error}`, {
              defaultValue: error,
            }),
          })}
        </p>
      )}
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="ast-source">{t('developerExpansion.source')}</Label>
          <Textarea
            ref={editor}
            id="ast-source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              clear();
            }}
            spellCheck={false}
            className="min-h-96 font-mono text-xs"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="ast-search">{t('developerExpansion.astTree')}</Label>
          <Input
            id="ast-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('developerExpansion.astSearch')}
          />
          {current && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => select(0)}>
                  {t('developerExpansion.root')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={current.parent === null}
                  onClick={() => select(current.parent ?? 0)}
                >
                  {t('developerExpansion.parent')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => select(current.id)}
                >
                  {t('developerExpansion.locate')}
                </Button>
              </div>
              <p className="break-all font-mono text-sm">
                {current.field}: {current.type} · {current.line}:
                {current.column + 1} · [{current.start}, {current.end})
              </p>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs">
                {JSON.stringify(current.details, null, 2)}
              </pre>
              <p className="text-xs text-muted-foreground">
                {t('developerExpansion.astCount', {
                  count: result!.nodes.length,
                })}
              </p>
            </>
          )}
          <div className="max-h-96 space-y-1 overflow-auto">
            {visible.map((node) => (
              <Button
                key={node.id}
                variant="ghost"
                className="h-auto w-full justify-start whitespace-normal break-all text-left font-mono text-xs"
                onClick={() => select(node.id)}
              >
                {node.field}: {node.type} {node.summary} · {node.line}:
                {node.column + 1}
              </Button>
            ))}
          </div>
          {current && (
            <pre
              aria-label={t('developerExpansion.selectedSource')}
              className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border p-2 font-mono text-xs"
            >
              {source.slice(
                current.start,
                Math.min(current.end, current.start + 4000),
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
