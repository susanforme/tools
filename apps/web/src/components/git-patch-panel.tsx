import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '../hooks/useQueryParams';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import type { ParsedPatch } from '../lib/git-patch';
const EXAMPLE =
  'diff --git a/app.ts b/app.ts\n--- a/app.ts\n+++ b/app.ts\n@@ -1,2 +1,2 @@\n const name = "tools";\n-console.log(name);\n+console.info(name);\n';
export default function GitPatchPanel() {
  const { t } = useTranslation();
  const tr = (key: string) => t(`performanceImport.${key}`);
  const [input, setInput] = useState(EXAMPLE),
    [patches, setPatches] = useState<ParsedPatch[]>([]),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [view, setView] = useQueryParam<string>(
    'patchView',
    StringParam,
    'split',
  );
  const generation = useRef(0);
  const edit = (text: string) => {
    generation.current++;
    setInput(text);
    setPatches([]);
    setError(null);
    setBusy(false);
  };
  const parse = async () => {
    const id = ++generation.current;
    setBusy(true);
    setError(null);
    setPatches([]);
    try {
      const { parseGitPatch } = await import('../lib/git-patch');
      const result = await parseGitPatch(input);
      if (id === generation.current) setPatches(result);
    } catch (cause) {
      if (id === generation.current) setError((cause as Error).message);
    } finally {
      if (id === generation.current) setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{tr('patchHint')}</p>
      <Input
        aria-label={tr('file')}
        type="file"
        accept=".diff,.patch,.txt"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const id = ++generation.current;
          try {
            if (file.size > 2 * 1024 * 1024) throw new Error('patchLimit');
            const text = await file.text();
            if (id === generation.current) edit(text);
          } catch (cause) {
            if (id === generation.current) setError((cause as Error).message);
          }
        }}
      />
      <Textarea
        value={input}
        onChange={(e) => edit(e.target.value)}
        className="min-h-48 font-mono text-xs"
        aria-label={tr('patchTitle')}
      />
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void parse()}>
          {tr(busy ? 'loading' : 'analyze')}
        </Button>
        <Button variant="outline" onClick={() => edit('')}>
          {tr('clear')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {tr('failed')}：
          {t(`performanceImport.errors.${error}`, { defaultValue: error })}
        </p>
      )}
      {patches.length > 0 && (
        <>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="split">{tr('split')}</TabsTrigger>
              <TabsTrigger value="unified">{tr('unified')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {patches.map((patch, index) => (
            <details
              key={index}
              open
              className="overflow-hidden rounded-md border"
            >
              <summary className="cursor-pointer break-all bg-muted px-3 py-2 text-sm">
                {patch.oldFileName} → {patch.newFileName} · +{patch.added} / −
                {patch.removed}
              </summary>
              {patch.hunks.length === 0 && (
                <p className="p-3 text-sm">{tr('metadataOnly')}</p>
              )}
              {patch.hunks.map((hunk, i) => (
                <div key={i} className="overflow-x-auto">
                  <div className="bg-muted/50 px-3 py-1 font-mono text-xs">
                    @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},
                    {hunk.newLines} @@
                  </div>
                  {view === 'unified' ? (
                    <pre className="p-2 text-xs">
                      {hunk.lines.map((line, j) => (
                        <div
                          key={j}
                          className={
                            line.startsWith('+')
                              ? 'bg-primary/10'
                              : line.startsWith('-')
                                ? 'bg-destructive/10'
                                : ''
                          }
                        >
                          {line}
                        </div>
                      ))}
                    </pre>
                  ) : (
                    <div className="grid min-w-[36rem] grid-cols-2 divide-x font-mono text-xs">
                      <pre className="p-2">
                        {hunk.left.map((line, j) => (
                          <div
                            key={j}
                            className={line.changed ? 'bg-destructive/10' : ''}
                          >
                            {line.number ?? ' '} {line.text || ' '}
                          </div>
                        ))}
                      </pre>
                      <pre className="p-2">
                        {hunk.right.map((line, j) => (
                          <div
                            key={j}
                            className={line.changed ? 'bg-primary/10' : ''}
                          >
                            {line.number ?? ' '} {line.text || ' '}
                          </div>
                        ))}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </details>
          ))}
        </>
      )}
    </div>
  );
}
