import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalysisFrame } from '@/components/analysis-tool-ui';
import { ChoiceField, NumberField } from '@/components/calculator-ui';
import { PracticalText, ExportText } from '@/components/practical-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import type { CitationRequest, CitationResult } from '@/lib/analysis-citations';
export const Route = createFileRoute('/citation-tool')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: CitationTool,
});
const createWorker = () =>
  new Worker(
    new URL('../workers/analysis-citations.worker.ts', import.meta.url),
    { type: 'module' },
  );
function CitationTool() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    input: string;
    output: string;
    style: string;
    locale: string;
    deduplicate: string;
    entry: number;
  }>({
    input: StringParam,
    output: StringParam,
    style: StringParam,
    locale: StringParam,
    deduplicate: StringParam,
    entry: NumberParam,
  });
  const input = ['bibtex', 'ris', 'json'].includes(query.input ?? '')
      ? query.input!
      : 'bibtex',
    output = ['bibtex', 'ris', 'json', 'bibliography'].includes(
      query.output ?? '',
    )
      ? query.output!
      : 'bibliography',
    style = ['apa', 'vancouver', 'harvard1'].includes(query.style ?? '')
      ? query.style!
      : 'apa',
    locale = ['en-US', 'fr-FR', 'de-DE', 'es-ES', 'nl-NL'].includes(
      query.locale ?? '',
    )
      ? query.locale!
      : 'en-US',
    deduplicate = query.deduplicate !== 'no',
    entry = query.entry ?? 0;
  const [source, setSource] = useState(
    '@book{lovelace2024,\n  author = {Lovelace, Ada},\n  title = {Notes on the Analytical Engine},\n  year = {2024},\n  publisher = {Example Press}\n}',
  );
  const [error, setError] = useState<string | null>(null);
  const worker = useBoundedWorker<CitationRequest, CitationResult>(
    createWorker,
    30000,
  );
  useEffect(() => {
    worker.clear();
    setError(null);
  }, [source, input, output, style, locale, deduplicate, entry, worker.clear]);
  const formatOptions = (values: string[]) =>
    values.map((value) => ({
      value,
      label:
        value === 'bibliography'
          ? t('analysisTools.citations.bibliography')
          : value === 'json'
            ? 'CSL-JSON'
            : value === 'bibtex'
              ? 'BibTeX'
              : 'RIS',
    }));
  const result = worker.result;
  return (
    <AnalysisFrame tool="citations" error={error ?? worker.error}>
      <p className="text-sm text-muted-foreground">
        {t('analysisTools.citations.limit')}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <ChoiceField
          label={t('analysisTools.citations.input')}
          value={input}
          options={formatOptions(['bibtex', 'ris', 'json'])}
          onChange={(input) => setQuery({ input })}
        />
        <ChoiceField
          label={t('analysisTools.citations.output')}
          value={output}
          options={formatOptions(['bibtex', 'ris', 'json', 'bibliography'])}
          onChange={(output) => setQuery({ output })}
        />
        <ChoiceField
          label={t('analysisTools.citations.style')}
          value={style}
          options={[
            { value: 'apa', label: 'APA 7' },
            { value: 'vancouver', label: 'Vancouver' },
            { value: 'harvard1', label: 'Harvard (Cite Them Right)' },
          ]}
          onChange={(style) => setQuery({ style })}
        />
        <ChoiceField
          label={t('analysisTools.citations.locale')}
          value={locale}
          options={['en-US', 'fr-FR', 'de-DE', 'es-ES', 'nl-NL'].map(
            (value) => ({ value, label: value }),
          )}
          onChange={(locale) => setQuery({ locale })}
        />
        <ChoiceField
          label={t('analysisTools.citations.deduplicate')}
          value={deduplicate ? 'yes' : 'no'}
          options={['yes', 'no'].map((value) => ({
            value,
            label: t(`analysisTools.${value}`),
          }))}
          onChange={(deduplicate) => setQuery({ deduplicate })}
        />
        <NumberField
          label={t('analysisTools.citations.entry')}
          value={entry}
          min={0}
          max={300}
          step={1}
          onChange={(entry) => setQuery({ entry })}
        />
      </div>
      <Input
        type="file"
        accept=".bib,.ris,.json,text/plain,application/json"
        aria-label={t('analysisTools.import')}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            if (file.size > 500000) throw new Error('citationLimit');
            setSource(await file.text());
            setQuery({
              input: file.name.endsWith('.json')
                ? 'json'
                : file.name.endsWith('.ris')
                  ? 'ris'
                  : 'bibtex',
            });
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      />
      <PracticalText
        label={t('analysisTools.source')}
        value={source}
        onChange={setSource}
        multiline
        maxLength={500000}
      />
      <p className="text-sm text-muted-foreground">
        {t('analysisTools.citations.dedupNote')}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={worker.busy}
          onClick={() =>
            worker.run({
              source,
              input,
              output,
              style,
              locale,
              deduplicate,
              entry,
            })
          }
        >
          {t(worker.busy ? 'analysisTools.busy' : 'analysisTools.run')}
        </Button>
        {worker.busy && (
          <Button variant="outline" onClick={worker.cancel}>
            {t('analysisTools.cancel')}
          </Button>
        )}
      </div>
      {result && (
        <>
          <p>
            {t('analysisTools.citations.count', {
              count: result.count,
              removed: result.removed.length,
            })}
          </p>
          <section className="space-y-2 rounded border p-4">
            <h2 className="font-semibold">
              {t('analysisTools.citations.citation')}
            </h2>
            <p className="break-words">{result.citation}</p>
            <ExportText value={result.citation} name="citation.txt" />
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">{t('analysisTools.citations.output')}</h2>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border bg-muted p-4 text-sm">
              {result.output}
            </pre>
            <ExportText
              value={result.output}
              name={`references.${output === 'bibtex' ? 'bib' : output === 'json' ? 'json' : output === 'ris' ? 'ris' : 'txt'}`}
            />
          </section>
          {output !== 'bibliography' && (
            <details className="rounded border p-3">
              <summary>{t('analysisTools.citations.bibliography')}</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-sm">
                {result.bibliography}
              </pre>
              <ExportText value={result.bibliography} name="bibliography.txt" />
            </details>
          )}
          {result.removed.length > 0 && (
            <details className="rounded border p-3">
              <summary>{t('analysisTools.citations.removed')}</summary>
              <ul className="list-inside list-disc">
                {result.removed.map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </AnalysisFrame>
  );
}
