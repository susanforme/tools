import { localDay } from '@/lib/organizer-tools';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from './organizer-store';
import { Button } from './ui/button';
import {
  runTimeline,
  validRun,
  type RunSheet,
  type RunSegment,
} from '@/lib/life-workspace-data';
import { LifeError, LifePrint } from './life-workspace-ui';
const INITIAL: RunSheet = {
  title: '',
  start: localDay() + 'T09:00',
  segments: [],
};
export function RunSheetPanel() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`lifeWorkspace.${k}`);
  const store = useOrganizerStore('run-sheet-v1', INITIAL, validRun);
  const [current, setCurrent] = useQueryParam<number>('cue', NumberParam, 0);
  const [draft, setDraft] = useState<RunSegment | null>(null),
    [error, setError] = useState<string | null>(null);
  const rows = runTimeline(store.data);
  const active = Number.isFinite(current)
    ? Math.max(0, Math.min(Math.max(0, rows.length - 1), Math.floor(current)))
    : 0;
  const selected = rows[active];
  const format = (ms: number) => new Date(ms).toLocaleString();
  const move = (i: number, j: number) =>
    store.setData((d) => {
      const segments = [...d.segments];
      [segments[i], segments[j]] = [segments[j], segments[i]];
      return { ...d, segments };
    });
  return (
    <OrganizerFrame title={tr('run.title')} store={store}>
      <div className="grid gap-3 md:grid-cols-2">
        <OrganizerInput
          label={tr('title')}
          value={store.data.title}
          maxLength={200}
          onChange={(e) =>
            store.setData((d) => ({ ...d, title: e.target.value }))
          }
        />
        <OrganizerInput
          label={tr('start')}
          type="datetime-local"
          value={store.data.start}
          onChange={(e) =>
            store.setData((d) => ({ ...d, start: e.target.value }))
          }
        />
      </div>
      {selected && (
        <section
          className="space-y-3 rounded border-2 border-primary bg-primary/5 p-4"
          aria-live="polite"
        >
          <h2 className="text-lg font-bold">
            {tr('run.current')}: {selected.title}
          </h2>
          <p>
            {selected.owner} · {format(selected.start)}–{format(selected.end)}
          </p>
          <p className="whitespace-pre-wrap">{selected.cue || '—'}</p>
          <Button
            disabled={active <= 0}
            variant="outline"
            onClick={() => setCurrent(Math.max(0, active - 1))}
          >
            {tr('previous')}
          </Button>
          <Button
            disabled={active >= rows.length - 1}
            onClick={() => setCurrent(active + 1)}
          >
            {tr('next')}
          </Button>
        </section>
      )}
      <Button
        disabled={rows.length >= 200}
        onClick={() =>
          setDraft({
            id: crypto.randomUUID(),
            title: '',
            minutes: 10,
            delay: 0,
            owner: '',
            equipment: '',
            cue: '',
          })
        }
      >
        {tr('add')}
      </Button>
      <p className="text-sm text-muted-foreground">{tr('run.hint')}</p>
      {draft && (
        <section className="min-w-0 space-y-3 break-words rounded border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(['title', 'owner', 'equipment', 'cue'] as const).map((k) => (
              <OrganizerInput
                key={k}
                label={tr(k === 'title' ? k : `run.${k}`)}
                value={draft[k]}
                maxLength={k === 'cue' ? 2000 : k === 'equipment' ? 1000 : 120}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            ))}
            <OrganizerInput
              label={tr('run.minutes')}
              type="number"
              min={1}
              max={1440}
              value={draft.minutes}
              onChange={(e) =>
                setDraft({ ...draft, minutes: Number(e.target.value) })
              }
            />
            <OrganizerInput
              label={tr('run.delay')}
              type="number"
              min={0}
              max={1440}
              value={draft.delay}
              onChange={(e) =>
                setDraft({ ...draft, delay: Number(e.target.value) })
              }
            />
          </div>
          <Button
            onClick={() => {
              const next = {
                ...store.data,
                segments: rows.some((s) => s.id === draft.id)
                  ? store.data.segments.map((s) =>
                      s.id === draft.id ? draft : s,
                    )
                  : [...store.data.segments, draft],
              };
              if (!validRun(next)) {
                setError('invalid');
                return;
              }
              if (store.setData(next)) {
                setDraft(null);
                setError(null);
              }
            }}
          >
            {tr('save')}
          </Button>
          <Button variant="ghost" onClick={() => setDraft(null)}>
            {tr('cancel')}
          </Button>
        </section>
      )}
      <LifeError error={error} />
      {rows.map((r, i) => (
        <article
          key={r.id}
          className="min-w-0 space-y-2 break-words rounded border p-4"
        >
          <h2 className="font-semibold">
            {i + 1}. {r.title} · {r.minutes} min
          </h2>
          <p>
            {format(r.start)} → {format(r.end)}
          </p>
          <p>
            {r.owner} · {r.equipment}
          </p>
          <p className="whitespace-pre-wrap break-words">{r.cue}</p>
          <div className="flex flex-wrap items-end gap-2">
            <OrganizerInput
              label={tr('run.delay')}
              type="number"
              className="w-28"
              min={0}
              max={1440}
              value={r.delay}
              onChange={(e) =>
                store.setData((d) => ({
                  ...d,
                  segments: d.segments.map((s) =>
                    s.id === r.id ? { ...s, delay: Number(e.target.value) } : s,
                  ),
                }))
              }
            />
            <Button
              size="sm"
              variant="outline"
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              {tr('up')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={i === rows.length - 1}
              onClick={() => move(i, i + 1)}
            >
              {tr('down')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft(store.data.segments[i])}
            >
              {tr('edit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                store.setData((d) => ({
                  ...d,
                  segments: d.segments.filter((s) => s.id !== r.id),
                }))
              }
            >
              {tr('delete')}
            </Button>
          </div>
        </article>
      ))}
      <LifePrint
        title={store.data.title || tr('run.title')}
        filename="run-sheet.pdf"
        lines={rows.map(
          (r, i) =>
            `${i + 1}. ${format(r.start)} → ${format(r.end)}\n${r.title} · ${r.owner}\n${tr('run.equipment')}: ${r.equipment}\n${tr('run.cue')}: ${r.cue}`,
        )}
      />
    </OrganizerFrame>
  );
}
