import { useTaskWorker } from '@/hooks/use-task-worker';
import {
  ArrayParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  TRANSLATION_LIMIT,
  TRANSLATION_RULES,
  type TranslationIssue,
  type TranslationRequest,
  type TranslationRule,
  type TranslationSource,
} from '@/lib/i18n-checker';
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/i18n-checker')({
  component: I18nCheckerPage,
});
const PAGE_SIZE = 50;
const QUERY_PARAMS = { rules: ArrayParam };

const createWorker = (): Worker =>
  new Worker(new URL('../workers/i18n-checker.worker.ts', import.meta.url), {
    type: 'module',
  });

const IcuMessagePanel = lazy(() => import('../components/icu-message-panel'));
function I18nCheckerPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ tab: string }>({
    tab: StringParam,
  });
  const tab = query.tab === 'icu' ? 'icu' : 'check';
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4 min-w-0">
      <h1 className="text-2xl font-bold">{t('i18nChecker.title')}</h1>
      <Tabs value={tab} onValueChange={(value) => setQuery({ tab: value })}>
        <TabsList>
          <TabsTrigger value="check">
            {t('community.translationCheck')}
          </TabsTrigger>
          <TabsTrigger value="icu">{t('icu.title')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'icu' ? (
        <Suspense fallback={<p>{t('formats.running')}</p>}>
          <IcuMessagePanel />
        </Suspense>
      ) : (
        <TranslationCheckPanel />
      )}
    </div>
  );
}
function TranslationCheckPanel() {
  const runWorker = useTaskWorker<TranslationRequest, TranslationIssue[]>(
    createWorker,
  );
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ rules: string[] }>(QUERY_PARAMS);
  const rules = (query.rules ?? [...TRANSLATION_RULES]).filter(
    (rule): rule is TranslationRule =>
      TRANSLATION_RULES.includes(rule as TranslationRule),
  );
  const [base, setBase] = useState('');
  const [target, setTarget] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [issues, setIssues] = useState<TranslationIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [inputVersion, setInputVersion] = useState(0);
  const invalidate = (): void => {
    setIssues(null);
    setError(null);
    setPage(0);
  };
  const pages = Math.max(1, Math.ceil((issues?.length ?? 0) / PAGE_SIZE));

  const loadBase = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    invalidate();
    setBusy(true);
    try {
      if (file.size > TRANSLATION_LIMIT)
        throw new Error(t('i18nChecker.tooLarge'));
      setBase(await file.text());
    } catch (cause) {
      setError(
        t('i18nChecker.loadError', { message: (cause as Error).message }),
      );
    } finally {
      setBusy(false);
    }
  };
  const check = async (): Promise<void> => {
    invalidate();
    setBusy(true);
    try {
      if (files.length > 20) throw new Error(t('i18nChecker.tooMany'));
      const sources: TranslationSource[] = [];
      if (target.trim())
        sources.push({ name: t('i18nChecker.target'), text: target });
      for (const file of files) {
        if (file.size > TRANSLATION_LIMIT)
          throw new Error(`${file.name}: ${t('i18nChecker.tooLarge')}`);
        sources.push({ name: file.name, text: await file.text() });
      }
      if (!sources.length) throw new Error(t('i18nChecker.noTarget'));
      setIssues(await runWorker({ base, sources, rules }));
    } catch (cause) {
      setError(t('i18nChecker.error', { message: (cause as Error).message }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('i18nChecker.limits')}</p>
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="translation-base">{t('i18nChecker.base')}</Label>
            <Input
              key={`base-${inputVersion}`}
              type="file"
              accept=".json,application/json"
              aria-label={t('i18nChecker.base')}
              onChange={(event) => void loadBase(event.target.files?.[0])}
            />
            <Textarea
              id="translation-base"
              value={base}
              onChange={(event) => {
                setBase(event.target.value);
                invalidate();
              }}
              className="h-64 font-mono text-sm"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="translation-target">
              {t('i18nChecker.target')}
            </Label>
            <Input
              key={`target-${inputVersion}`}
              type="file"
              multiple
              accept=".json,application/json"
              aria-label={t('i18nChecker.files')}
              onChange={(event) => {
                setFiles(Array.from(event.target.files ?? []));
                invalidate();
              }}
            />
            <Textarea
              id="translation-target"
              value={target}
              onChange={(event) => {
                setTarget(event.target.value);
                invalidate();
              }}
              className="h-64 font-mono text-sm"
              spellCheck={false}
            />
            {files.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('i18nChecker.selected', { count: files.length })}
              </p>
            )}
          </div>
        </div>
        <div
          className="flex flex-wrap gap-4"
          aria-label={t('i18nChecker.rules')}
        >
          {TRANSLATION_RULES.map((rule) => (
            <Label key={rule} className="flex items-center gap-2">
              <Checkbox
                checked={rules.includes(rule)}
                onCheckedChange={(checked) => {
                  void setQuery({
                    rules: checked
                      ? [...rules, rule]
                      : rules.filter((item) => item !== rule),
                  });
                  invalidate();
                }}
              />
              {t(`i18nChecker.rule.${rule}`)}
            </Label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void check()}
            disabled={!base.trim() || !rules.length}
          >
            {t(busy ? 'i18nChecker.checking' : 'i18nChecker.check')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setBase('');
              setTarget('');
              setFiles([]);
              setInputVersion((value) => value + 1);
              invalidate();
            }}
          >
            {t('i18nChecker.clear')}
          </Button>
        </div>
      </fieldset>
      {error && (
        <div
          role="alert"
          className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2"
        >
          {error}
        </div>
      )}
      {issues !== null && (
        <section className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap gap-3 items-center">
            <p>
              {issues.length
                ? t('i18nChecker.result', { count: issues.length })
                : t('i18nChecker.clean')}
            </p>
            <Button
              variant="outline"
              onClick={() =>
                downloadBlob(
                  new Blob([JSON.stringify(issues, null, 2)], {
                    type: 'application/json',
                  }),
                  'translation-issues.json',
                )
              }
            >
              {t('i18nChecker.download')}
            </Button>
          </div>
          {issues
            .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
            .map((issue, index) => (
              <article
                key={`${page}-${index}`}
                className="border rounded-md p-3 space-y-2 text-sm"
              >
                <p className="font-medium break-all">
                  {issue.target} · {issue.path} ·{' '}
                  {t(`i18nChecker.rule.${issue.rule}`)}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">
                      {t('i18nChecker.base')}
                    </span>
                    <pre className="whitespace-pre-wrap break-all max-h-32 overflow-auto">
                      {JSON.stringify(issue.base)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t('i18nChecker.value')}
                    </span>
                    <pre className="whitespace-pre-wrap break-all max-h-32 overflow-auto">
                      {JSON.stringify(issue.value)}
                    </pre>
                  </div>
                </div>
              </article>
            ))}
          {pages > 1 && (
            <div className="flex gap-3 items-center">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                {t('i18nChecker.previous')}
              </Button>
              <span>
                {t('i18nChecker.page', { page: page + 1, total: pages })}
              </span>
              <Button
                variant="outline"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t('i18nChecker.next')}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
