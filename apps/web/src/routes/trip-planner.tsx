import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { ChoiceField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { LifeError, LifePrint } from '@/components/life-workspace-ui';
import {
  tripAnalysis,
  tripIcs,
  validTrip,
  type TripPlan,
  type TripStop,
} from '@/lib/life-workspace-data';
import { localDay } from '@/lib/organizer-tools';
import { downloadBlob } from '@/lib/download';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
export const Route = createFileRoute('/trip-planner')({
  component: TripPlanner,
});
const INITIAL: TripPlan = { title: '', currency: 'CNY', budget: 0, stops: [] };
const stop = (): TripStop => ({
  id: crypto.randomUUID(),
  title: '',
  kind: 'visit',
  place: '',
  start: localDay() + 'T09:00',
  end: localDay() + 'T10:00',
  zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  endZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  cost: 0,
  note: '',
});
function TripPlanner() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`lifeWorkspace.${k}`);
  const store = useOrganizerStore('trip-planner-v1', INITIAL, validTrip);
  const [draft, setDraft] = useState<TripStop | null>(null),
    [error, setError] = useState<string | null>(null);
  const [day, setDay] = useQueryParam<string>('day', StringParam, 'all');
  const report = useMemo(() => tripAnalysis(store.data), [store.data]);
  const dates = [...new Set(report.stops.map((s) => s.start.slice(0, 10)))];
  const rows = report.stops.filter(
    (s) => !dates.includes(day) || s.start.startsWith(day),
  );
  return (
    <OrganizerFrame title={tr('trip.title')} store={store}>
      <div className="grid gap-3 md:grid-cols-3">
        <OrganizerInput
          label={tr('title')}
          value={store.data.title}
          maxLength={200}
          onChange={(e) =>
            store.setData((d) => ({ ...d, title: e.target.value }))
          }
        />
        <OrganizerInput
          label={tr('trip.currency')}
          value={store.data.currency}
          maxLength={20}
          onChange={(e) =>
            store.setData((d) => ({ ...d, currency: e.target.value }))
          }
        />
        <OrganizerInput
          label={tr('trip.budget')}
          type="number"
          min={0}
          value={store.data.budget}
          onChange={(e) =>
            store.setData((d) => ({ ...d, budget: Number(e.target.value) }))
          }
        />
      </div>
      <p>
        {tr('trip.total')}: {report.total.toFixed(2)} {store.data.currency} ·{' '}
        {tr('trip.remaining')}: {(store.data.budget - report.total).toFixed(2)}
      </p>
      <div className="flex flex-wrap gap-3">
        <ChoiceField
          label={tr('trip.day')}
          value={dates.includes(day) ? day : 'all'}
          options={[
            { value: 'all', label: tr('all') },
            ...dates.map((value) => ({ value, label: value })),
          ]}
          onChange={setDay}
        />
        <Button
          disabled={store.data.stops.length >= 200}
          onClick={() => setDraft(stop())}
        >
          {tr('add')}
        </Button>
        <Button
          variant="outline"
          disabled={!report.stops.length}
          onClick={() => {
            try {
              downloadBlob(
                new Blob([tripIcs(store.data)], { type: 'text/calendar' }),
                'trip.ics',
              );
            } catch {
              setError('exportError');
            }
          }}
        >
          {tr('ics')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{tr('trip.hint')}</p>
      {draft && (
        <section className="min-w-0 space-y-3 break-words rounded border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(['title', 'place', 'zone', 'endZone', 'note'] as const).map(
              (k) => (
                <OrganizerInput
                  key={k}
                  label={tr(k === 'title' || k === 'note' ? k : `trip.${k}`)}
                  value={draft[k]}
                  maxLength={k === 'note' ? 2000 : k === 'place' ? 300 : 120}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                />
              ),
            )}
            <ChoiceField
              label={tr('kind')}
              value={draft.kind}
              options={['visit', 'transport', 'stay'].map((value) => ({
                value,
                label: tr(`trip.${value}`),
              }))}
              onChange={(kind) =>
                setDraft({ ...draft, kind: kind as TripStop['kind'] })
              }
            />
            {(['start', 'end'] as const).map((k) => (
              <OrganizerInput
                key={k}
                label={tr(k)}
                type="datetime-local"
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            ))}
            <OrganizerInput
              label={tr('trip.cost')}
              type="number"
              min={0}
              step="0.01"
              value={draft.cost}
              onChange={(e) =>
                setDraft({ ...draft, cost: Number(e.target.value) })
              }
            />
          </div>
          <Button
            onClick={() => {
              const next = {
                ...store.data,
                stops: store.data.stops.some((s) => s.id === draft.id)
                  ? store.data.stops.map((s) => (s.id === draft.id ? draft : s))
                  : [...store.data.stops, draft],
              };
              if (!validTrip(next)) {
                setError('tripInvalid');
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
      {report.conflicts.length > 0 && (
        <section className="rounded border border-destructive/30 p-3">
          <h2 className="font-semibold">
            {tr('trip.conflicts')} ({report.conflicts.length})
          </h2>
          {report.conflicts.length > 100 && <p>{tr('trip.truncated')}</p>}
          {report.conflicts.slice(0, 100).map(([a, b]) => (
            <p key={a + b}>
              {report.stops.find((s) => s.id === a)?.title} ↔{' '}
              {report.stops.find((s) => s.id === b)?.title}
            </p>
          ))}
        </section>
      )}
      {rows.map((s) => (
        <article
          key={s.id}
          className="min-w-0 space-y-2 break-words rounded border p-4"
        >
          <h2 className="font-semibold">
            {s.title} · {tr(`trip.${s.kind}`)}
          </h2>
          <p>
            {s.start.replace('T', ' ')} ({s.zone}) → {s.end.replace('T', ' ')} (
            {s.endZone})
          </p>
          <p>
            {s.place} · {s.cost.toFixed(2)} {store.data.currency}
          </p>
          <p className="whitespace-pre-wrap break-words">{s.note}</p>
          <Button size="sm" variant="outline" onClick={() => setDraft(s)}>
            {tr('edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              store.setData((d) => ({
                ...d,
                stops: d.stops.filter((x) => x.id !== s.id),
              }))
            }
          >
            {tr('delete')}
          </Button>
        </article>
      ))}
      <LifePrint
        title={store.data.title || tr('trip.title')}
        filename="trip.pdf"
        lines={rows.map(
          (s) =>
            `${s.start.replace('T', ' ')} ${s.zone} → ${s.end.replace('T', ' ')} ${s.endZone}\n${s.title} · ${s.place}\n${s.cost.toFixed(2)} ${store.data.currency}\n${s.note}`,
        )}
      />
    </OrganizerFrame>
  );
}
