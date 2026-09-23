import { LifeWorkspace } from '@/components/life-workspace-ui';
import { ToolExtensionSelector } from '@/components/tool-extension-selector';
import { RunSheetPanel } from '@/components/event-run-sheet-workspace';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { validateProject, type ProjectTask } from '@/lib/productivity-data';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { ChoiceField, Metric } from '@/components/calculator-ui';
import { ProductivityError } from '@/components/productivity-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export const Route = createFileRoute('/project-planner')({
  component: ExpandedPage,
});
const INITIAL: ProjectTask[] = [];
const STATUSES = ['todo', 'doing', 'done'] as const;
function newTask(): ProjectTask {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return {
    id: crypto.randomUUID(),
    name: '',
    start: date,
    end: date,
    status: 'todo',
    milestone: false,
    dependencies: [],
  };
}
function ProjectPlanner() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'project-planner-v1',
    INITIAL,
    validateProject,
  );
  const [view, setView] = useQueryParam<string>('view', StringParam, 'board');
  const [draft, setDraft] = useState<ProjectTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tasks = store.data;
  const completed = tasks.filter((x) => x.status === 'done').length;
  const update = (next: ProjectTask[]) => {
    if (!validateProject(next)) {
      setError('cycle');
      return false;
    }
    if (store.setData(next)) {
      setError(null);
      return true;
    }
    return false;
  };
  const blocked = (task: ProjectTask) =>
    task.dependencies.some(
      (id) => tasks.find((x) => x.id === id)?.status !== 'done',
    );
  const setStatus = (task: ProjectTask, status: ProjectTask['status']) => {
    if (status === 'done' && blocked(task)) {
      setError('blocked');
      return;
    }
    update(tasks.map((x) => (x.id === task.id ? { ...x, status } : x)));
  };
  const min = tasks.length
    ? Math.min(...tasks.map((x) => Date.parse(x.start)))
    : 0;
  const max = tasks.length
    ? Math.max(...tasks.map((x) => Date.parse(x.end)))
    : 0;
  const days = (max - min) / 86400000 + 1;
  return (
    <OrganizerFrame
      title={t('productivity.tools.project-planner.title')}
      store={store}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label={t('productivity.progress')}
          value={`${completed} / ${tasks.length} (${tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%)`}
        />
        <ChoiceField
          label={t('productivity.preview')}
          value={view === 'gantt' ? 'gantt' : 'board'}
          options={['board', 'gantt'].map((value) => ({
            value,
            label: t(`productivity.${value}`),
          }))}
          onChange={setView}
        />
        <Button
          className="self-end"
          disabled={tasks.length >= 200}
          onClick={() => setDraft(newTask())}
        >
          {t('productivity.add')} {t('productivity.task')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('productivity.taskLimit')}
      </p>
      {draft && (
        <section className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <OrganizerInput
              label={t('productivity.name')}
              value={draft.name}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <OrganizerInput
              label={t('productivity.start')}
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              value={draft.start}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  start: e.target.value,
                  ...(draft.milestone ? { end: e.target.value } : {}),
                })
              }
            />
            <OrganizerInput
              label={t('productivity.end')}
              type="date"
              min={draft.start}
              max="2200-12-31"
              disabled={draft.milestone}
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={draft.milestone}
              onCheckedChange={(v) =>
                setDraft({
                  ...draft,
                  milestone: v === true,
                  ...(v === true ? { end: draft.start } : {}),
                })
              }
            />
            {t('productivity.milestone')}
          </label>
          <fieldset className="space-y-2">
            <legend>{t('productivity.dependencies')}</legend>
            <div className="flex max-h-40 flex-wrap gap-3 overflow-auto">
              {tasks
                .filter((x) => x.id !== draft.id)
                .map((task) => (
                  <label key={task.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={draft.dependencies.includes(task.id)}
                      onCheckedChange={(v) =>
                        setDraft({
                          ...draft,
                          dependencies:
                            v === true
                              ? [...draft.dependencies, task.id]
                              : draft.dependencies.filter(
                                  (id) => id !== task.id,
                                ),
                        })
                      }
                    />
                    {task.name}
                  </label>
                ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (
                  !draft.name.trim() ||
                  !draft.start ||
                  !draft.end ||
                  draft.start > draft.end
                ) {
                  setError('invalid');
                  return;
                }
                const next = tasks.some((x) => x.id === draft.id)
                  ? tasks.map((x) => (x.id === draft.id ? draft : x))
                  : [...tasks, draft];
                if (update(next)) setDraft(null);
              }}
            >
              {t('productivity.save')}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t('productivity.cancel')}
            </Button>
          </div>
        </section>
      )}
      {view === 'gantt' && tasks.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <svg
            role="img"
            aria-label={t('productivity.gantt')}
            viewBox={`0 0 1000 ${tasks.length * 42 + 65}`}
            className="min-w-[700px] w-full"
          >
            <text x="220" y="20" fontSize="12" fill="currentColor">
              {new Date(min).toISOString().slice(0, 10)}
            </text>
            <text
              x="985"
              y="20"
              textAnchor="end"
              fontSize="12"
              fill="currentColor"
            >
              {new Date(max).toISOString().slice(0, 10)}
            </text>
            {tasks.map((task, index) => {
              const x =
                220 + ((Date.parse(task.start) - min) / 86400000 / days) * 760;
              const width = Math.max(
                4,
                (((Date.parse(task.end) - Date.parse(task.start)) / 86400000 +
                  1) /
                  days) *
                  760,
              );
              const y = index * 42 + 40;
              return (
                <g key={task.id}>
                  <title>
                    {task.name}: {task.start} – {task.end}
                  </title>
                  <text x="10" y={y + 15} fontSize="12" fill="currentColor">
                    {task.name.length > 20
                      ? task.name.slice(0, 20) + '…'
                      : task.name}
                  </text>
                  {task.milestone ? (
                    <path
                      d={`M ${x + 8} ${y} l 8 10 l -8 10 l -8 -10 Z`}
                      fill="#d97706"
                    />
                  ) : (
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height="22"
                      rx="3"
                      fill={
                        task.status === 'done'
                          ? '#10b981'
                          : task.status === 'doing'
                            ? '#3b82f6'
                            : '#64748b'
                      }
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {STATUSES.map((status) => (
          <section
            key={status}
            className="space-y-3 rounded-lg border bg-muted/30 p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const task = tasks.find(
                (x) => x.id === e.dataTransfer.getData('text/plain'),
              );
              if (task) setStatus(task, status);
            }}
          >
            <h2 className="font-semibold">
              {t(`productivity.${status}`)} (
              {tasks.filter((x) => x.status === status).length})
            </h2>
            {tasks
              .filter((x) => x.status === status)
              .map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData('text/plain', task.id)
                  }
                  className="space-y-3 rounded-md border bg-background p-3"
                >
                  <h3 className="break-words font-medium">
                    {task.milestone ? '◆ ' : ''}
                    {task.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {task.start} → {task.end}
                  </p>
                  {task.dependencies.length > 0 && (
                    <p className="text-sm">
                      {t('productivity.dependencies')}:{' '}
                      {task.dependencies
                        .map((id) => tasks.find((x) => x.id === id)?.name)
                        .join(', ')}
                    </p>
                  )}
                  {blocked(task) && (
                    <p className="text-xs text-amber-600">
                      {t('productivity.blocked')}
                    </p>
                  )}
                  <ChoiceField
                    label={t('productivity.status')}
                    value={task.status}
                    options={STATUSES.map((value) => ({
                      value,
                      label: t(`productivity.${value}`),
                    }))}
                    onChange={(v) =>
                      setStatus(task, v as ProjectTask['status'])
                    }
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDraft({ ...task })}
                    >
                      {t('productivity.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        update(
                          tasks
                            .filter((x) => x.id !== task.id)
                            .map((x) => ({
                              ...x,
                              dependencies: x.dependencies.filter(
                                (id) => id !== task.id,
                              ),
                            })),
                        );
                        if (draft?.id === task.id) setDraft(null);
                      }}
                    >
                      {t('productivity.remove')}
                    </Button>
                  </div>
                </article>
              ))}
          </section>
        ))}
      </div>
      <ProductivityError error={error} />
    </OrganizerFrame>
  );
}

function ExpandedPage() {
  return (
    <ToolExtensionSelector
      panels={['capacity']}
      base={
        <LifeWorkspace
          label="lifeWorkspace.run.title"
          panel={<RunSheetPanel />}
        >
          <ProjectPlanner />
        </LifeWorkspace>
      }
    />
  );
}
