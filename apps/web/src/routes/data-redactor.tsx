import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  analyzeRedaction,
  type RedactionMatch,
  type RedactionResult,
} from '@/lib/data-redactor';
import { downloadBlob } from '@/lib/download';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/data-redactor')({
  component: DataRedactorPage,
});
function DataRedactorPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<string>('mode', StringParam, 'text');
  const format = mode === 'json' ? 'json' : 'text';
  const [input, setInput] = useState('');
  const [paths, setPaths] = useState('');
  const [result, setResult] = useState<RedactionResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [copied, setCopied] = useState(false);
  const reset = (): void => {
    setResult(null);
    setDirty(false);
    setError(null);
    setPage(0);
    setCopied(false);
  };
  const process = (overrides: RedactionMatch[] = []): void => {
    setError(null);
    setCopied(false);
    try {
      setResult(
        analyzeRedaction(
          input,
          {
            format,
            paths: paths
              .split('\n')
              .map((path) => path.trim())
              .filter(Boolean),
          },
          overrides,
        ),
      );
      setDirty(false);
    } catch (caught) {
      const message = (caught as Error).message;
      const known: Record<string, string> = {
        INPUT_TOO_LARGE: 'inputTooLarge',
        TOO_MANY_MATCHES: 'tooMany',
        INVALID_POINTER: 'invalidPointer',
        TOO_DEEP: 'tooDeep',
      };
      setError(
        t('dataRedactor.failed', {
          message: known[message]
            ? t(`dataRedactor.${known[message]}`)
            : message,
        }),
      );
      setResult(null);
    }
  };
  const update = (
    id: string,
    values: Partial<Pick<RedactionMatch, 'replacement' | 'enabled'>>,
  ): void => {
    setResult((previous) =>
      previous
        ? {
            ...previous,
            matches: previous.matches.map((match) =>
              match.id === id ? { ...match, ...values } : match,
            ),
          }
        : null,
    );
    setDirty(true);
    setCopied(false);
  };
  const pages = Math.max(1, Math.ceil((result?.matches.length ?? 0) / 50));
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dataRedactor.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dataRedactor.description')}
        </p>
      </div>
      <Tabs
        value={format}
        onValueChange={(value) => {
          setMode(value);
          reset();
        }}
      >
        <TabsList aria-label={t('dataRedactor.mode')}>
          <TabsTrigger value="text">{t('dataRedactor.text')}</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="space-y-2">
        <Label htmlFor="redact-input">{t('dataRedactor.input')}</Label>
        <Textarea
          id="redact-input"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            reset();
          }}
          className="min-h-48 font-mono"
        />
      </div>
      {format === 'json' && (
        <div className="space-y-2">
          <Label htmlFor="redact-paths">{t('dataRedactor.paths')}</Label>
          <Textarea
            id="redact-paths"
            value={paths}
            onChange={(event) => {
              setPaths(event.target.value);
              reset();
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t('dataRedactor.pathsHint')}
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setPage(0);
            process();
          }}
          disabled={!input}
        >
          {t('dataRedactor.detect')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setInput('');
            setPaths('');
            reset();
          }}
        >
          {t('dataRedactor.clear')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('dataRedactor.limit')}</p>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {result && (
        <>
          <h2 className="font-semibold">
            {t('dataRedactor.review', { count: result.matches.length })}
          </h2>
          <div className="space-y-2">
            {result.matches
              .slice(page * 50, page * 50 + 50)
              .map((match, index) => (
                <div
                  key={match.id}
                  className="grid items-center gap-2 rounded-md border p-3 md:grid-cols-[auto_1fr_1fr]"
                >
                  <Checkbox
                    checked={match.enabled}
                    onCheckedChange={(value) =>
                      update(match.id, { enabled: value === true })
                    }
                    aria-label={`${t('dataRedactor.enabled')} ${page * 50 + index + 1}`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground">
                      {match.kind} ·{' '}
                      {t('dataRedactor.occurrences', {
                        count: match.occurrences,
                      })}
                    </span>
                    <p className="max-h-24 overflow-auto break-all font-mono text-sm">
                      {match.value}
                    </p>
                  </div>
                  <Input
                    value={match.replacement}
                    onChange={(event) =>
                      update(match.id, { replacement: event.target.value })
                    }
                    aria-label={`${t('dataRedactor.replacement')} ${page * 50 + index + 1}`}
                  />
                </div>
              ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {t('dataRedactor.previous')}
              </Button>
              <span className="text-sm">
                {t('dataRedactor.page', { page: page + 1, total: pages })}
              </span>
              <Button
                variant="outline"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t('dataRedactor.next')}
              </Button>
            </div>
          )}
          {dirty && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t('dataRedactor.dirty')}
              </span>
              <Button onClick={() => process(result.matches)}>
                {t('dataRedactor.apply')}
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="redact-output">{t('dataRedactor.output')}</Label>
            <Textarea
              id="redact-output"
              readOnly
              value={result.output}
              className="min-h-48 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={dirty}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.output);
                  setCopied(true);
                } catch (caught) {
                  setError(
                    t('dataRedactor.failed', {
                      message: (caught as Error).message,
                    }),
                  );
                }
              }}
            >
              {t(copied ? 'dataRedactor.copied' : 'dataRedactor.copy')}
            </Button>
            <Button
              disabled={dirty}
              onClick={() =>
                downloadBlob(
                  new Blob([result.output], {
                    type: format === 'json' ? 'application/json' : 'text/plain',
                  }),
                  `redacted.${format === 'json' ? 'json' : 'txt'}`,
                )
              }
            >
              {t('dataRedactor.download')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
