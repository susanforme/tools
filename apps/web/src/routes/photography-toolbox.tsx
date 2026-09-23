import { ScienceFrame } from '@/components/science-workspace-ui';
import { ChoiceField, Metric, NumberField } from '@/components/calculator-ui';
import { PracticalText, useLatestJob } from '@/components/practical-ui';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { photoCalculation, photoSun } from '@/lib/science-calculations';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/photography-toolbox')({
  validateSearch: (search: Record<string, unknown>) => search,
  component: Photography,
});
const FIELDS: Record<string, Array<{ key: string; value: number }>> = {
  dof: [
    { key: 'focalLength', value: 50 },
    { key: 'aperture', value: 2.8 },
    { key: 'focusDistance', value: 3 },
    { key: 'coc', value: 0.03 },
  ],
  focal: [
    { key: 'focalLength', value: 35 },
    { key: 'crop', value: 1.5 },
  ],
  nd: [
    { key: 'shutter', value: 0.01 },
    { key: 'stops', value: 10 },
  ],
  exposure: [
    { key: 'aperture', value: 4 },
    { key: 'shutter', value: 0.008 },
    { key: 'iso', value: 100 },
    { key: 'newAperture', value: 8 },
  ],
};
function Photography() {
  const { t } = useTranslation();
  const label = (key: string) => t(`scienceTools.${key}`);
  const [q, set] = useQueryParams<{
    mode: string;
    a: number;
    b: number;
    c: number;
    d: number;
    date: string;
    latitude: number;
    longitude: number;
    offset: number;
  }>({
    mode: StringParam,
    a: NumberParam,
    b: NumberParam,
    c: NumberParam,
    d: NumberParam,
    date: StringParam,
    latitude: NumberParam,
    longitude: NumberParam,
    offset: NumberParam,
  });
  const mode =
    q.mode === 'sun' || Object.hasOwn(FIELDS, q.mode ?? '') ? q.mode! : 'dof';
  const fields = FIELDS[mode] ?? [],
    keys = ['a', 'b', 'c', 'd'] as const;
  const latitude = q.latitude ?? 31.23,
    longitude = q.longitude ?? 121.47,
    offset = q.offset ?? 8;
  const dayOffset =
    Number.isFinite(offset) && offset >= -12 && offset <= 14 ? offset : 8;
  const date =
    q.date ??
    new Date(Date.now() + dayOffset * 3600000).toISOString().slice(0, 10);
  let result: Record<string, number> | null = null,
    error: string | null = null;
  try {
    if (mode !== 'sun')
      result = photoCalculation(
        mode,
        fields.map((f, i) => q[keys[i]] ?? f.value),
      );
  } catch (cause) {
    error = (cause as Error).message;
  }
  const job = useLatestJob<Awaited<ReturnType<typeof photoSun>>>(
    JSON.stringify({ date, latitude, longitude, offset, mode }),
  );
  return (
    <ScienceFrame tool="photography" error={error ?? job.error}>
      <ChoiceField
        label={label('mode')}
        value={mode}
        options={[...Object.keys(FIELDS), 'sun'].map((value) => ({
          value,
          label: label(value),
        }))}
        onChange={(mode) =>
          set({ mode, a: undefined, b: undefined, c: undefined, d: undefined })
        }
      />
      {mode === 'sun' ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <PracticalText
              type="date"
              label={label('date')}
              value={date}
              onChange={(date) => set({ date })}
            />
            {(['latitude', 'longitude', 'offset'] as const).map((key) => (
              <NumberField
                key={key}
                label={label(key)}
                value={{ latitude, longitude, offset }[key]}
                min={
                  key === 'latitude' ? -90 : key === 'longitude' ? -180 : -12
                }
                max={key === 'latitude' ? 90 : key === 'longitude' ? 180 : 14}
                onChange={(value) => set({ [key]: value })}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{label('offsetHint')}</p>
          <Button
            disabled={job.busy}
            onClick={() =>
              void job.run(() => photoSun(date, latitude, longitude, offset))
            }
          >
            {label('calculate')}
          </Button>
          {job.result && (
            <>
              {job.result.alwaysUp && <p>{label('alwaysUp')}</p>}
              {job.result.alwaysDown && <p>{label('alwaysDown')}</p>}
              <div className="grid gap-3 md:grid-cols-3">
                {job.result.times.map((item) => (
                  <Metric
                    key={item.key}
                    label={label(item.key)}
                    value={
                      item.value
                        ? new Date(Date.parse(item.value) + offset * 3600000)
                            .toISOString()
                            .slice(0, 16)
                            .replace('T', ' ')
                        : label('noEvent')
                    }
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {fields.map((field, i) => (
              <NumberField
                key={field.key}
                label={label(field.key)}
                value={q[keys[i]] ?? field.value}
                min={0}
                max={1e12}
                onChange={(value) => set({ [keys[i]]: value })}
              />
            ))}
          </div>
          {result && (
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(result).map(([key, value]) => (
                <Metric
                  key={key}
                  label={label(key === 'exposure' ? 'exposureResult' : key)}
                  value={
                    Number.isFinite(value)
                      ? value.toPrecision(8)
                      : label('infinity')
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </ScienceFrame>
  );
}
