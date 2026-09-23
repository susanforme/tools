import { useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ScienceResultFrame } from '@/components/science-result-frame';
import { NumberField, Metric } from '@/components/calculator-ui';
import { PracticalText } from '@/components/practical-ui';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  astronomyIcs,
  type AstronomyRequest,
  type AstronomyResult,
} from '@/lib/astronomy-calculations';
import { downloadBlob } from '@/lib/download';
export const Route = createFileRoute('/astronomy-toolbox')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: AstronomyToolbox,
});
const worker = () =>
  new Worker(
    new URL('../workers/astronomy-calculations.worker.ts', import.meta.url),
    { type: 'module' },
  );
function AstronomyToolbox() {
  const { t } = useTranslation(),
    l = (key: string) => t(`scienceExpansion.${key}`),
    a = (key: string) => l(`astro.${key}`);
  const [q, set] = useQueryParams<AstronomyRequest>({
    date: StringParam,
    time: StringParam,
    offset: NumberParam,
    latitude: NumberParam,
    longitude: NumberParam,
    height: NumberParam,
  });
  const offset = q.offset ?? 8,
    displayOffset =
      Number.isFinite(offset) && offset >= -12 && offset <= 14 ? offset : 8;
  const request: AstronomyRequest = {
    date:
      q.date ??
      new Date(Date.now() + displayOffset * 3600000).toISOString().slice(0, 10),
    time: q.time ?? '21:00',
    offset,
    latitude: q.latitude ?? 31.23,
    longitude: q.longitude ?? 121.47,
    height: q.height ?? 0,
  };
  const key = JSON.stringify(request),
    job = useBoundedWorker<AstronomyRequest, AstronomyResult>(worker, 15000);
  useEffect(() => job.clear(), [key, job.clear]);
  const display = (date: string | null) =>
    date
      ? new Date(Date.parse(date) + displayOffset * 3600000)
          .toISOString()
          .slice(0, 16)
          .replace('T', ' ')
      : a('none');
  const result = job.result;
  return (
    <ScienceResultFrame title="astro.title" error={job.error}>
      <div className="grid gap-3 md:grid-cols-3">
        <PracticalText
          label={a('date')}
          value={request.date}
          type="date"
          onChange={(date) => set({ date })}
        />
        <PracticalText
          label={a('time')}
          value={request.time}
          type="time"
          onChange={(time) => set({ time })}
        />
        {(['offset', 'latitude', 'longitude', 'height'] as const).map(
          (field) => (
            <NumberField
              key={field}
              label={a(field)}
              value={request[field]}
              min={
                field === 'latitude'
                  ? -90
                  : field === 'longitude'
                    ? -180
                    : field === 'offset'
                      ? -12
                      : -400
              }
              max={
                field === 'latitude'
                  ? 90
                  : field === 'longitude'
                    ? 180
                    : field === 'offset'
                      ? 14
                      : 10000
              }
              onChange={(n) => set({ [field]: n })}
            />
          ),
        )}
      </div>
      <p className="text-sm text-muted-foreground">{a('hint')}</p>
      <div className="flex gap-2">
        <Button disabled={job.busy} onClick={() => job.run(request)}>
          {l('run')}
        </Button>
        {job.busy && (
          <Button variant="outline" onClick={job.cancel}>
            {l('cancel')}
          </Button>
        )}
      </div>
      {result && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Metric label={a('phase')} value={result.phase.toFixed(2)} />
            <Metric
              label={a('illumination')}
              value={`${(result.illumination * 100).toFixed(1)}%`}
            />
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    'body',
                    'azimuth',
                    'altitude',
                    'rise',
                    'set',
                    'windows',
                  ].map((key) => (
                    <th key={key} className="p-2">
                      {a(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.bodies.map((body) => (
                  <tr key={body.body} className="border-t">
                    <td className="p-2">{a(body.body)}</td>
                    <td className="p-2">{body.azimuth.toFixed(1)}</td>
                    <td className="p-2">{body.altitude.toFixed(1)}</td>
                    <td className="p-2">{display(body.rise)}</td>
                    <td className="p-2">{display(body.set)}</td>
                    <td className="p-2">
                      {body.windows.length
                        ? body.windows.map((w, i) => (
                            <div key={i}>
                              {display(w.start)} → {display(w.end)}
                            </div>
                          ))
                        : a('none')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 className="font-semibold">{a('phases')}</h2>
          <div className="grid gap-3 md:grid-cols-4">
            {result.phases.map((p) => (
              <Metric
                key={p.angle}
                label={a(`phase${p.angle}`)}
                value={display(p.time)}
              />
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const events = [
                ...result.bodies.flatMap((b) =>
                  b.windows.map((w) => ({
                    title: `${a(b.body)} · ${a('windows')}`,
                    ...w,
                  })),
                ),
                ...result.phases.map((p) => ({
                  title: a(`phase${p.angle}`),
                  start: p.time,
                  end: new Date(Date.parse(p.time) + 60000).toISOString(),
                })),
              ];
              downloadBlob(
                new Blob(
                  [
                    astronomyIcs(
                      events,
                      `${request.latitude}, ${request.longitude}`,
                    ),
                  ],
                  { type: 'text/calendar' },
                ),
                'astronomy.ics',
              );
            }}
          >
            {a('calendar')}
          </Button>
        </>
      )}
    </ScienceResultFrame>
  );
}
