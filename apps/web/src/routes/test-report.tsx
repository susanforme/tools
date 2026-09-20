import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { useBoundedWorker } from '../hooks/use-bounded-worker';
import { StringParam, useQueryParams } from '../hooks/useQueryParams';
import type {
  TestReportRequest,
  TestReportResult,
} from '../workers/test-report.worker';

export const Route = createFileRoute('/test-report')({
  component: TestReportPage,
});
const JunitPanel = lazy(() => import('../components/junit-report-panel'));
const LcovPanel = lazy(() => import('../components/lcov-report-panel'));
const createWorker = (): Worker =>
  new Worker(new URL('../workers/test-report.worker.ts', import.meta.url), {
    type: 'module',
  });
const SAMPLES = {
  junit: [
    '<testsuite name="checkout"><testcase classname="Cart" name="adds item" time="0.12"><failure message="Expected 2 items">Expected: 2\nReceived: 1\n  at cart.test.ts:24</failure></testcase><testcase classname="Cart" name="removes item" time="0.04"/><testcase name="coupon"><skipped message="Feature disabled"/></testcase></testsuite>',
    '<testsuite name="checkout"><testcase classname="Cart" name="adds item" time="0.1"/><testcase classname="Cart" name="removes item" time="0.05"/></testsuite>',
  ],
  lcov: [
    'TN:current\nSF:src/cart.ts\nDA:1,3\nDA:2,0\nDA:3,0\nBRDA:2,0,0,0\nBRDA:2,0,1,-\nend_of_record\nSF:src/empty.ts\nend_of_record',
    'TN:baseline\nSF:src/cart.ts\nDA:1,2\nDA:2,1\nDA:3,0\nBRDA:2,0,0,1\nBRDA:2,0,1,0\nend_of_record',
  ],
};
function TestReportPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    tab: string;
    status: string;
    coverage: string;
  }>({ tab: StringParam, status: StringParam, coverage: StringParam });
  const tab = query.tab === 'lcov' ? 'lcov' : 'junit';
  const [inputs, setInputs] = useState(['', '']);
  const [reading, setReading] = useState([false, false]);
  const [fileError, setFileError] = useState<string | null>(null);
  const epochs = useRef([0, 0]);
  const task = useBoundedWorker<TestReportRequest, TestReportResult>(
    createWorker,
    10000,
  );
  useEffect(
    () => () => {
      epochs.current = epochs.current.map((value) => value + 1);
    },
    [],
  );
  useEffect(() => {
    epochs.current = epochs.current.map((value) => value + 1);
    setInputs(['', '']);
    setReading([false, false]);
    setFileError(null);
    task.clear();
  }, [tab, task.clear]);
  const change = (index: number, value: string): void => {
    epochs.current[index]++;
    setReading((previous) =>
      previous.map((item, position) => (position === index ? false : item)),
    );
    task.clear();
    setFileError(null);
    setInputs((previous) =>
      previous.map((item, position) => (position === index ? value : item)),
    );
  };
  const read = async (index: number, file: File): Promise<void> => {
    const epoch = ++epochs.current[index];
    task.clear();
    setFileError(null);
    setReading((previous) =>
      previous.map((item, position) => (position === index ? true : item)),
    );
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('REPORT_TOO_LARGE');
      const text = await file.text();
      if (epochs.current[index] === epoch)
        setInputs((previous) =>
          previous.map((item, position) => (position === index ? text : item)),
        );
    } catch (cause) {
      if (epochs.current[index] === epoch)
        setFileError((cause as Error).message);
    } finally {
      if (epochs.current[index] === epoch)
        setReading((previous) =>
          previous.map((item, position) => (position === index ? false : item)),
        );
    }
  };
  const rawError = fileError ?? task.error;
  const [code, ...detail] = rawError?.split(':') ?? [];
  const error = rawError
    ? `${t(`testReport.errors.${code}`, { defaultValue: code })}${detail.length ? `: ${detail.join(':')}` : ''}`
    : null;
  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('testReport.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('testReport.description')}
        </p>
      </div>
      <Tabs value={tab} onValueChange={(value) => setQuery({ tab: value })}>
        <TabsList>
          <TabsTrigger value="junit">JUnit</TabsTrigger>
          <TabsTrigger value="lcov">LCOV</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-xs text-muted-foreground">{t('testReport.limits')}</p>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        {inputs.map((value, index) => (
          <div key={`${tab}-${index}`} className="min-w-0 space-y-2">
            <Label htmlFor={`report-${index}`}>
              {t(index === 0 ? 'testReport.current' : 'testReport.baseline')}
            </Label>
            <Input
              type="file"
              aria-label={`${t('testReport.upload')} ${t(index === 0 ? 'testReport.current' : 'testReport.baseline')}`}
              accept={tab === 'junit' ? '.xml' : '.info,.lcov,.txt'}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void read(index, file);
                event.target.value = '';
              }}
            />
            <Textarea
              id={`report-${index}`}
              className="h-56 min-w-0 font-mono text-xs"
              value={value}
              onChange={(event) => change(index, event.target.value)}
              spellCheck={false}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={task.busy || reading.some(Boolean) || !inputs[0].trim()}
          onClick={() =>
            task.run({ tab, current: inputs[0], baseline: inputs[1] })
          }
        >
          {t(task.busy ? 'testReport.running' : 'testReport.analyze')}
        </Button>
        {task.busy && (
          <Button size="sm" variant="outline" onClick={task.cancel}>
            {t('testReport.cancel')}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            change(0, SAMPLES[tab][0]);
            change(1, SAMPLES[tab][1]);
          }}
        >
          {t('testReport.sample')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            change(0, '');
            change(1, '');
          }}
        >
          {t('testReport.clear')}
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm break-all text-destructive"
        >
          {t('testReport.failureMessage', { message: error })}
        </div>
      )}
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">
            {t('testReport.running')}
          </p>
        }
      >
        {task.result?.tab === 'junit' && tab === 'junit' && (
          <JunitPanel
            result={task.result.report}
            filter={query.status ?? 'all'}
            onFilter={(status) => setQuery({ status })}
          />
        )}
        {task.result?.tab === 'lcov' && tab === 'lcov' && (
          <LcovPanel
            result={task.result.report}
            filter={query.coverage ?? 'all'}
            onFilter={(coverage) => setQuery({ coverage })}
          />
        )}
      </Suspense>
    </div>
  );
}
