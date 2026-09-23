import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/workflow-review')({
  component: WorkflowReview,
});

type Job = {
  name: string;
  needs: string[];
  combinations: number;
  matrix: string;
  variants: string[];
};

function WorkflowReview() {
  const { t } = useTranslation();
  const [view, setView] = useQueryParam<'jobs' | 'matrix'>(
    'view',
    StringParam,
    'jobs',
  );
  const [source, setSource] = useState(
    'name: CI\njobs:\n  build:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: [20, 22]\n        os: [ubuntu-latest, windows-latest]\n    steps: []\n  test:\n    needs: build\n    runs-on: ubuntu-latest\n    steps: []',
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const positions = new Map<string, { x: number; y: number }>();
  const levels = new Map<string, number>();
  const byName = new Map(jobs.map((job) => [job.name, job]));
  const level = (name: string): number => {
    const known = levels.get(name);
    if (known !== undefined) return known;
    const needs = byName.get(name)?.needs ?? [];
    const next = needs.length ? 1 + Math.max(...needs.map(level)) : 0;
    levels.set(name, next);
    return next;
  };
  jobs.forEach((job, index) =>
    positions.set(job.name, {
      x: 20 + level(job.name) * 210,
      y: 20 + index * 72,
    }),
  );
  const graphWidth = Math.max(
    600,
    ...[...positions.values()].map(({ x }) => x + 190),
  );
  const graphHeight = Math.max(120, jobs.length * 72 + 20);

  async function inspect() {
    setError(null);
    try {
      const parsed: unknown = (await import('js-yaml')).load(source);
      if (!parsed || typeof parsed !== 'object' || !('jobs' in parsed))
        throw new Error(t('newTools.invalidWorkflow'));
      const raw = (parsed as { jobs: unknown }).jobs;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error(t('newTools.invalidWorkflow'));
      const entries = Object.entries(raw as Record<string, unknown>);
      if (entries.length > 100) throw new Error(t('newTools.jobLimit'));
      const ids = new Set(entries.map(([id]) => id));
      const next = entries.map(([name, value]): Job => {
        const job =
          value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
        const needs =
          typeof job.needs === 'string'
            ? [job.needs]
            : Array.isArray(job.needs)
              ? job.needs.filter(
                  (item): item is string => typeof item === 'string',
                )
              : [];
        const strategy =
          job.strategy && typeof job.strategy === 'object'
            ? (job.strategy as Record<string, unknown>)
            : {};
        const matrix =
          strategy.matrix && typeof strategy.matrix === 'object'
            ? (strategy.matrix as Record<string, unknown>)
            : {};
        const axes = Object.entries(matrix).filter(
          ([key, item]) =>
            key !== 'include' && key !== 'exclude' && Array.isArray(item),
        );
        const count = axes.reduce(
          (total, [, values]) => total * (values as unknown[]).length,
          1,
        );
        if (count > 1000) throw new Error(t('newTools.matrixLimit'));
        let variants: Array<Record<string, unknown>> = [{}];
        for (const [axis, values] of axes)
          variants = variants.flatMap((variant) =>
            (values as unknown[]).map((value) => ({
              ...variant,
              [axis]: value,
            })),
          );
        const excluded = Array.isArray(matrix.exclude)
          ? matrix.exclude.filter(isObject)
          : [];
        variants = variants.filter(
          (variant) =>
            !excluded.some((rule) =>
              Object.entries(rule).every(
                ([key, value]) => variant[key] === value,
              ),
            ),
        );
        const included = Array.isArray(matrix.include)
          ? matrix.include.filter(isObject)
          : [];
        for (const extra of included) {
          const match = variants.find((variant) =>
            axes.every(
              ([key]) => !(key in extra) || variant[key] === extra[key],
            ),
          );
          if (match) Object.assign(match, extra);
          else variants.push(extra);
        }
        return {
          name,
          needs,
          combinations: variants.length,
          matrix: axes
            .map(
              ([key, values]) => `${key}: ${(values as unknown[]).join(', ')}`,
            )
            .join(' · '),
          variants: variants.map((variant) =>
            Object.entries(variant)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(', '),
          ),
        };
      });
      if (next.some((job) => job.needs.some((need) => !ids.has(need))))
        throw new Error(t('newTools.unknownDependency'));
      const visited = new Set<string>(),
        active = new Set<string>();
      const byName = new Map(next.map((job) => [job.name, job]));
      const visit = (name: string): void => {
        if (active.has(name)) throw new Error(t('newTools.cycle'));
        if (visited.has(name)) return;
        active.add(name);
        byName.get(name)?.needs.forEach(visit);
        active.delete(name);
        visited.add(name);
      };
      next.forEach((job) => visit(job.name));
      setJobs(next);
    } catch (cause) {
      setJobs([]);
      setError((cause as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('newTools.workflow')}</h1>
      <Textarea
        aria-label="workflow YAML"
        className="min-h-64 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <div className="flex gap-2">
        <Button onClick={() => void inspect()}>{t('newTools.analyze')}</Button>
        <Button
          variant={view === 'jobs' ? 'default' : 'outline'}
          onClick={() => setView('jobs')}
        >
          {t('newTools.jobs')}
        </Button>
        <Button
          variant={view === 'matrix' ? 'default' : 'outline'}
          onClick={() => setView('matrix')}
        >
          Matrix
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {jobs.length > 0 && (
        <div className="space-y-2">
          {view === 'jobs' && (
            <div className="overflow-x-auto rounded-md border">
              <svg
                role="img"
                aria-label={t('newTools.workflowGraph')}
                viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                width={graphWidth}
                height={graphHeight}
                className="max-w-none"
              >
                {jobs.flatMap((job) =>
                  job.needs.map((need) => {
                    const from = positions.get(need)!,
                      to = positions.get(job.name)!;
                    return (
                      <line
                        key={`${need}-${job.name}`}
                        x1={from.x + 160}
                        y1={from.y + 22}
                        x2={to.x}
                        y2={to.y + 22}
                        stroke="currentColor"
                        strokeOpacity=".45"
                        strokeWidth="2"
                      />
                    );
                  }),
                )}
                {jobs.map((job) => {
                  const position = positions.get(job.name)!;
                  return (
                    <g key={job.name}>
                      <rect
                        x={position.x}
                        y={position.y}
                        width="160"
                        height="44"
                        rx="6"
                        fill="#4f46e5"
                      />
                      <text
                        x={position.x + 10}
                        y={position.y + 27}
                        fill="white"
                        fontSize="13"
                      >
                        {job.name.slice(0, 19)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
          {jobs.map((job) => (
            <div key={job.name} className="rounded-md border p-3">
              <strong>{job.name}</strong>
              <p className="text-sm text-muted-foreground">
                {view === 'jobs'
                  ? `${t('newTools.depends')}: ${job.needs.join(', ') || '—'}`
                  : `${job.matrix || '—'} · ${job.combinations} ${t('newTools.combinations')}`}
              </p>
              {view === 'matrix' && (
                <div className="mt-2 max-h-40 overflow-auto font-mono text-xs">
                  {job.variants.map((variant, index) => (
                    <p key={index}>{variant || '—'}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
