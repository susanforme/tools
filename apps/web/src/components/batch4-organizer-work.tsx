import { useOrganizerStore, OrganizerInput } from './organizer-store';
import { Button } from './ui/button';
import { localDay } from '@/lib/organizer-tools';
import {
  validWorkEntries,
  workMinutes,
  type WorkEntry,
} from '@/lib/batch4-organizer-tools';
import { downloadBlob } from '@/lib/download';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
const INITIAL: WorkEntry[] = [];
export function WorkRecords({
  month,
  planned,
}: {
  month: string;
  planned: number;
}) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`batch4Organizers.${key}`);
  const store = useOrganizerStore(
    'tools.work-records.v1',
    INITIAL,
    validWorkEntries,
  );
  const [date, setDate] = useState(localDay());
  const [start, setStart] = useState('09:00'),
    [end, setEnd] = useState('18:00'),
    [rest, setRest] = useState(60),
    [project, setProject] = useState('');
  const [error, setError] = useState<string | null>(null);
  const records = store.data.filter((r) => r.date.startsWith(month));
  const total = records.reduce((sum, r) => sum + workMinutes(r), 0) / 60;
  const projects = new Map<string, number>();
  records.forEach((r) =>
    projects.set(
      r.project,
      (projects.get(r.project) ?? 0) + workMinutes(r) / 60,
    ),
  );
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">{tr('work.title')}</h2>
      <p>
        {tr('work.planned')}: {planned.toFixed(2)} h · {tr('work.actual')}:{' '}
        {total.toFixed(2)} h · {tr('work.difference')}:{' '}
        {(total - planned).toFixed(2)} h
      </p>
      <fieldset disabled={!store.ready} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-5">
          <OrganizerInput
            label={tr('date')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <OrganizerInput
            label={tr('work.start')}
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <OrganizerInput
            label={tr('work.end')}
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
          <OrganizerInput
            label={tr('work.break')}
            type="number"
            min={0}
            max={1439}
            value={rest}
            onChange={(e) => setRest(Number(e.target.value))}
          />
          <OrganizerInput
            label={tr('work.project')}
            value={project}
            maxLength={200}
            onChange={(e) => setProject(e.target.value)}
          />
        </div>
        <Button
          onClick={() => {
            const e = {
              id: crypto.randomUUID(),
              date,
              start,
              end,
              breakMinutes: rest,
              project,
            };
            if (!validWorkEntries([e])) {
              setError(tr('invalid'));
              return;
            }
            store.setData((d) => [...d, e]);
            setError(null);
          }}
        >
          {tr('add')}
        </Button>
        <p className="text-sm text-muted-foreground">{tr('work.hint')}</p>
        {[...projects].map(([p, h]) => (
          <p key={p}>
            {p || '—'}: {h.toFixed(2)} h
          </p>
        ))}
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3">
              <span>
                {r.date} {r.start}–{r.end} · {r.project || '—'} ·{' '}
                {(workMinutes(r) / 60).toFixed(2)} h
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  store.setData((d) => d.filter((e) => e.id !== r.id))
                }
              >
                {tr('delete')}
              </Button>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="outline" onClick={store.backup}>
          {t('organizer.backup')}
        </Button>
        <OrganizerInput
          label={t('organizer.restore')}
          type="file"
          accept=".json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void store.restore(f);
            e.target.value = '';
          }}
        />
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const { default: Papa } = await import('papaparse');
              downloadBlob(
                new Blob(
                  [
                    Papa.unparse(
                      records.map((r) => ({
                        ...r,
                        hours: (workMinutes(r) / 60).toFixed(2),
                      })),
                      { escapeFormulae: true },
                    ),
                  ],
                  { type: 'text/csv;charset=utf-8' },
                ),
                'work-hours.csv',
              );
            } catch {
              setError(tr('exportError'));
            }
          }}
        >
          {tr('exportCsv')}
        </Button>
      </div>
      {(error || store.error) && (
        <p role="alert" className="text-destructive">
          {error ?? t(`organizer.${store.error}`)}
        </p>
      )}
    </section>
  );
}
