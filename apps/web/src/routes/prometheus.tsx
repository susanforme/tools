import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  StringParam,
  useQueryParams,
  withDefault,
} from '../hooks/useQueryParams';
export const Route = createFileRoute('/prometheus')({
  component: PrometheusPage,
});
const SAMPLE =
  '# HELP http_requests_total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total{method="GET",code="200"} 42\n# TYPE request_seconds histogram\nrequest_seconds_bucket{le="0.5"} 9\nrequest_seconds_bucket{le="+Inf"} 10\nrequest_seconds_sum 2.4\nrequest_seconds_count 10\n# EOF';
function PrometheusPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{ tab: string; format: string }>({
    tab: withDefault<string>(StringParam, 'metrics'),
    format: withDefault<string>(StringParam, 'prometheus'),
  });
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const invalidate = () => {
    generation.current++;
    setOutput('');
    setError(null);
    setLoading(false);
  };
  const run = async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    setOutput('');
    try {
      const { inspectMetrics, inspectPromql } =
        await import('../lib/metrics-inspector');
      const result =
        query.tab === 'promql'
          ? await inspectPromql(input)
          : inspectMetrics(input, query.format === 'openmetrics');
      if (version === generation.current)
        setOutput(JSON.stringify(result, null, 2));
    } catch (cause) {
      if (version === generation.current)
        setError(
          t('dataTools.failed', {
            defaultValue: '处理失败：{{message}}',
            message: (cause as Error).message,
          }),
        );
    } finally {
      if (version === generation.current) setLoading(false);
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">
        {t('dataTools.prometheusTitle', {
          defaultValue: 'Prometheus / PromQL 检查器',
        })}
      </h1>
      <Tabs
        value={query.tab === 'promql' ? 'promql' : 'metrics'}
        onValueChange={(tab) => {
          invalidate();
          setInput('');
          setQuery({ tab });
        }}
      >
        <TabsList>
          <TabsTrigger value="metrics">
            {t('dataTools.metrics', { defaultValue: '指标文本' })}
          </TabsTrigger>
          <TabsTrigger value="promql">PromQL</TabsTrigger>
        </TabsList>
      </Tabs>
      {query.tab !== 'promql' && (
        <Tabs
          value={query.format === 'openmetrics' ? 'openmetrics' : 'prometheus'}
          onValueChange={(format) => {
            invalidate();
            setQuery({ format });
          }}
        >
          <TabsList>
            <TabsTrigger value="prometheus">Prometheus</TabsTrigger>
            <TabsTrigger value="openmetrics">OpenMetrics</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <p className="text-sm text-muted-foreground">
        {query.tab === 'promql'
          ? t('dataTools.promqlLimit', {
              defaultValue:
                '仅检查语法并展示语法树，不执行查询或类型检查。最多 100 KB。',
            })
          : t('dataTools.metricsLimit', {
              defaultValue:
                '最多 2 MB。支持经典指标样本；暂不支持 UTF-8 指标名称和原生直方图。',
            })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={loading}>
          {loading
            ? t('dataTools.processing', { defaultValue: '处理中…' })
            : t('dataTools.inspect', { defaultValue: '检查' })}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            invalidate();
            setInput(
              query.tab === 'promql'
                ? 'sum by (job) (rate(http_requests_total[5m]))'
                : SAMPLE,
            );
          }}
        >
          {t('dataTools.sample', { defaultValue: '填入示例' })}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            invalidate();
            setInput('');
          }}
        >
          {t('dataTools.clear', { defaultValue: '清空' })}
        </Button>
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={(value) => {
          invalidate();
          setInput(value);
        }}
        error={error}
        language="plaintext"
        outputLanguage="json"
      />
    </div>
  );
}
