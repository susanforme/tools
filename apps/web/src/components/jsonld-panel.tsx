import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '../hooks/useQueryParams';
import type { FormatResult } from '../lib/format-input';
import { extractJsonLdScripts, type JsonLdRequest } from '../lib/jsonld-debug';
import { CodePanel } from './code-panel';
import {
  createFormatWorker,
  FormatActions,
  FormatFeedback,
} from './format-workbench';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';
const SAMPLE = '{"@context":"https://example.com/context","name":"Ada"}';
export default function JsonLdPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    ldMode: string;
    ldSource: string;
  }>({ ldMode: StringParam, ldSource: StringParam });
  const mode = query.ldMode === 'compact' ? 'compact' : 'expand';
  const source = query.ldSource === 'html' ? 'html' : 'json';
  const [input, setInput] = useState('');
  const [context, setContext] = useState('');
  const [contexts, setContexts] = useState('');
  const [error, setError] = useState<string | null>(null);
  const task = useBoundedWorker<JsonLdRequest, FormatResult>(
    createFormatWorker,
    10000,
  );
  useEffect(() => {
    task.clear();
    setError(null);
  }, [mode, source, task.clear]);
  const clearResult = (): void => {
    task.clear();
    setError(null);
  };
  const run = (): void => {
    clearResult();
    try {
      task.run({
        kind: 'jsonld',
        input: source === 'html' ? extractJsonLdScripts(input) : input,
        mode,
        context,
        contexts,
      });
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <section className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">{t('jsonLd.note')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Label>{t('formats.mode')}</Label>
        <Select
          value={mode}
          onValueChange={(ldMode) => {
            clearResult();
            setQuery({ ldMode });
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['expand', 'compact'].map((value) => (
              <SelectItem key={value} value={value}>
                {t(`jsonLd.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={source}
          onValueChange={(ldSource) => {
            clearResult();
            setQuery({ ldSource });
          }}
        >
          <SelectTrigger aria-label={t('jsonLd.source')} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON-LD</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="ld-contexts">{t('jsonLd.contexts')}</Label>
          <Textarea
            id="ld-contexts"
            className="h-36 font-mono text-xs"
            value={contexts}
            onChange={(event) => {
              clearResult();
              setContexts(event.target.value);
            }}
            spellCheck={false}
          />
        </div>
        {mode === 'compact' && (
          <div className="min-w-0 space-y-2">
            <Label htmlFor="ld-context">{t('jsonLd.context')}</Label>
            <Textarea
              id="ld-context"
              className="h-36 font-mono text-xs"
              value={context}
              onChange={(event) => {
                clearResult();
                setContext(event.target.value);
              }}
              spellCheck={false}
            />
          </div>
        )}
      </div>
      <FormatActions
        busy={task.busy}
        run={run}
        cancel={task.cancel}
        clear={() => {
          clearResult();
          setInput('');
          setContext('');
          setContexts('');
        }}
        sample={() => {
          clearResult();
          setInput(
            source === 'html'
              ? `<html><head><script type="application/ld+json">${SAMPLE}</script></head></html>`
              : SAMPLE,
          );
          setContext('{"name":"https://schema.org/name"}');
          setContexts(
            '{"https://example.com/context":{"@context":{"name":"https://schema.org/name"}}}',
          );
        }}
      />
      <FormatFeedback error={error ?? task.error} />
      <CodePanel
        input={input}
        output={task.result?.output ?? ''}
        language={source}
        outputLanguage="json"
        onInputChange={(value) => {
          clearResult();
          setInput(value);
        }}
      />
    </section>
  );
}
