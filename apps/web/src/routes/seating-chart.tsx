import { ChoiceField, NumberField } from '@/components/calculator-ui';
import {
  StudyImport,
  StudyPreview,
  StudyText,
} from '@/components/study-tools-ui';
import { Button } from '@/components/ui/button';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  buildSeats,
  seatingImages,
  shuffleSeats,
  type Seat,
} from '@/lib/seating-chart';
import { studyRows } from '@/lib/study-print';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/seating-chart')({
  component: SeatingChartPage,
});
function SeatingChartPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    rows: number;
    columns: number;
    aisles: string;
  }>({ rows: NumberParam, columns: NumberParam, aisles: StringParam });
  const rows = query.rows ?? 5;
  const columns = query.columns ?? 6;
  const [layout, setLayout] = useState({
    rows: 5,
    columns: 6,
    aisles: [] as number[],
  });
  const [text, setText] = useState('');
  const [names, setNames] = useState<string[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const invalidateImport = () => {
    generation.current++;
    setBusy(false);
  };
  const change = (next: Seat[]) => {
    invalidateImport();
    setSeats(next);
    setImages([]);
  };
  const remaining = [...names];
  seats.forEach((seat) => {
    if (seat.name) {
      const i = remaining.indexOf(seat.name);
      if (i >= 0) remaining.splice(i, 1);
    }
  });
  const swap = (from: number, to: number) => {
    if (
      from === to ||
      seats[from]?.fixed ||
      seats[to]?.fixed ||
      seats[from]?.blocked ||
      seats[to]?.blocked
    )
      return;
    const next = seats.map((seat) => ({ ...seat }));
    [next[from]!.name, next[to]!.name] = [next[to]!.name, next[from]!.name];
    change(next);
  };
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('seatingChart.title')}</h1>
      <StudyImport
        onText={(value) => {
          invalidateImport();
          setText(value);
        }}
      />
      <StudyText
        label={t('seatingChart.names')}
        value={text}
        onChange={(value) => {
          invalidateImport();
          setText(value);
        }}
        multiline
        maxLength={100000}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <NumberField
          label={t('seatingChart.rows')}
          value={rows}
          onChange={(value) => {
            invalidateImport();
            setQuery({ rows: value });
          }}
          min={1}
          step={1}
        />
        <NumberField
          label={t('seatingChart.columns')}
          value={columns}
          onChange={(value) => {
            invalidateImport();
            setQuery({ columns: value });
          }}
          min={1}
          step={1}
        />
        <StudyText
          label={t('seatingChart.aisles')}
          value={query.aisles ?? ''}
          onChange={(value) => {
            invalidateImport();
            setQuery({ aisles: value });
          }}
        />
        <StudyText
          label={t('seatingChart.heading')}
          value={heading}
          onChange={(value) => {
            setHeading(value);
            setImages([]);
          }}
          maxLength={80}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={async () => {
            const id = ++generation.current;
            setBusy(true);
            setError(null);
            try {
              const list = (await studyRows(text))
                .map((row) => row[0]!)
                .filter(Boolean);
              if (id !== generation.current) return;
              const next = buildSeats(list, rows, columns);
              const aisles = [
                ...new Set(
                  (query.aisles ?? '')
                    .split(/[,，]/)
                    .filter((v) => v.trim())
                    .map(Number),
                ),
              ];
              if (
                aisles.some(
                  (value) =>
                    !Number.isInteger(value) || value < 1 || value >= columns,
                )
              )
                throw new Error('options');
              setNames(list);
              change(next);
              setLayout({ rows, columns, aisles });
              setSelected(null);
            } catch (cause) {
              if (id === generation.current)
                setError(
                  t(`studyCommon.${(cause as Error).message}`, {
                    defaultValue: t('studyCommon.importError'),
                  }),
                );
            } finally {
              if (id === generation.current) setBusy(false);
            }
          }}
        >
          {t('seatingChart.build')}
        </Button>
        <Button
          variant="outline"
          disabled={!seats.length}
          onClick={() => {
            try {
              change(shuffleSeats(seats, names));
              setError(null);
            } catch {
              setError(t('studyCommon.seats'));
            }
          }}
        >
          {t('seatingChart.shuffle')}
        </Button>
        <Button
          variant="outline"
          disabled={!seats.length}
          onClick={() => {
            try {
              setImages(
                seatingImages(
                  seats,
                  layout.rows,
                  layout.columns,
                  layout.aisles,
                  heading || t('seatingChart.front'),
                ),
              );
              setError(null);
            } catch {
              setError(t('studyCommon.generateError'));
            }
          }}
        >
          {t('studyCommon.generate')}
        </Button>
      </div>
      {seats.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {t('seatingChart.hint')}
          </p>
          <div className="overflow-x-auto rounded-lg border p-3">
            <p className="mb-4 text-center font-semibold">
              {heading || t('seatingChart.front')}
            </p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: layout.rows }, (_, row) => (
                <div key={row} className="flex justify-center gap-2">
                  {Array.from({ length: layout.columns }, (_, col) => {
                    const index = row * layout.columns + col;
                    const seat = seats[index]!;
                    return (
                      <div
                        key={col}
                        className={layout.aisles.includes(col) ? 'ml-6' : ''}
                      >
                        <Button
                          draggable={!seat.fixed && !seat.blocked}
                          onDragStart={() => setDragging(index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragging !== null) swap(dragging, index);
                            setDragging(null);
                          }}
                          onDragEnd={() => setDragging(null)}
                          onClick={() => setSelected(index)}
                          variant={selected === index ? 'default' : 'outline'}
                          className={`h-16 w-24 flex-col whitespace-normal break-all ${seat.blocked ? 'opacity-40' : ''}`}
                        >
                          <span className="text-xs">
                            {row + 1}-{col + 1}
                            {seat.fixed ? ' 🔒' : ''}
                          </span>
                          <span className="line-clamp-2">
                            {seat.blocked
                              ? '×'
                              : seat.name || t('seatingChart.empty')}
                          </span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {selected !== null && seats[selected] && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
              <span>
                {t('seatingChart.selected', {
                  row: Math.floor(selected / layout.columns) + 1,
                  column: (selected % layout.columns) + 1,
                })}
              </span>
              <ChoiceField
                label={t('seatingChart.assign')}
                value={
                  seats[selected]!.name === null
                    ? '__empty'
                    : `name:${seats[selected]!.name}`
                }
                options={[
                  { value: '__empty', label: t('seatingChart.empty') },
                  ...[
                    ...new Set([
                      ...(seats[selected]!.name
                        ? [seats[selected]!.name!]
                        : []),
                      ...remaining,
                    ]),
                  ].map((value) => ({ value: `name:${value}`, label: value })),
                ]}
                onChange={(value) => {
                  if (seats[selected]!.fixed || seats[selected]!.blocked)
                    return;
                  change(
                    seats.map((seat, i) =>
                      i === selected
                        ? {
                            ...seat,
                            name: value === '__empty' ? null : value.slice(5),
                          }
                        : seat,
                    ),
                  );
                }}
              />
              <Button
                variant="outline"
                disabled={seats[selected]!.blocked}
                onClick={() =>
                  change(
                    seats.map((seat, i) =>
                      i === selected ? { ...seat, fixed: !seat.fixed } : seat,
                    ),
                  )
                }
              >
                {t(
                  seats[selected]!.fixed
                    ? 'seatingChart.unlock'
                    : 'seatingChart.lock',
                )}
              </Button>
              <Button
                variant="outline"
                disabled={seats[selected]!.fixed}
                onClick={() =>
                  change(
                    seats.map((seat, i) =>
                      i === selected
                        ? { ...seat, blocked: !seat.blocked, name: null }
                        : seat,
                    ),
                  )
                }
              >
                {t(
                  seats[selected]!.blocked
                    ? 'seatingChart.unblock'
                    : 'seatingChart.block',
                )}
              </Button>
              <ChoiceField
                label={t('seatingChart.swap')}
                value="none"
                options={[
                  { value: 'none', label: t('seatingChart.chooseSeat') },
                  ...seats.flatMap((seat, index) =>
                    index !== selected && !seat.fixed && !seat.blocked
                      ? [
                          {
                            value: String(index),
                            label: `${Math.floor(index / layout.columns) + 1}-${(index % layout.columns) + 1} ${seat.name ?? ''}`,
                          },
                        ]
                      : [],
                  ),
                ]}
                onChange={(value) => {
                  if (value !== 'none') swap(selected, Number(value));
                }}
              />
            </div>
          )}
          <p className="text-sm">
            {t('seatingChart.unassigned')}：
            {remaining.join('、') || t('seatingChart.none')}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <StudyPreview images={images} filename="seating-chart-A4.pdf" />
    </div>
  );
}
