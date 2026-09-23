import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { ChoiceField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  plantCount,
  validGarden,
  type Garden,
  type Planting,
} from '@/lib/batch4-organizer-tools';
import { localDay } from '@/lib/organizer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/garden-planner')({
  component: GardenPlannerPage,
});
const INITIAL: Garden = {
  beds: [{ id: 'bed1', name: '1', width: 240, height: 120 }],
  plants: [],
  care: [],
};
function GardenPlannerPage() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`batch4Organizers.${k}`);
  const store = useOrganizerStore(
    'tools.garden-planner.v1',
    INITIAL,
    validGarden,
  );
  const [selected, setSelected] = useQueryParam<string>(
    'bed',
    StringParam,
    'bed1',
  );
  const bed =
    store.data.beds.find((b) => b.id === selected) ?? store.data.beds[0];
  const [crop, setCrop] = useState('');
  const [sow, setSow] = useState(localDay());
  const [transplant, setTransplant] = useState('');
  const [note, setNote] = useState('');
  const [x, setX] = useState(0),
    [y, setY] = useState(0),
    [width, setWidth] = useState(60),
    [height, setHeight] = useState(60),
    [spacing, setSpacing] = useState(30);
  const [careDate, setCareDate] = useState(localDay());
  const [careNote, setCareNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plants = store.data.plants.filter((p) => p.bed === bed.id);
  const nfield = (key: string, value: number, set: (v: number) => void) => (
    <OrganizerInput
      key={key}
      label={tr(`garden.${key}`)}
      type="number"
      min={0}
      max={100000}
      value={value}
      onChange={(e) => set(Number(e.target.value))}
    />
  );
  function addPlant() {
    const p: Planting = {
      id: crypto.randomUUID(),
      bed: bed.id,
      crop,
      x,
      y,
      width,
      height,
      spacing,
      sow,
      transplant,
      note,
    };
    const next = { ...store.data, plants: [...store.data.plants, p] };
    if (!crop.trim() || !validGarden(next) || plantCount(p) < 1) {
      setError(tr('garden.invalid'));
      return;
    }
    store.setData(next);
    setError(null);
  }
  async function printLabels() {
    setBusy(true);
    setError(null);
    try {
      await document.fonts.ready;
      const { studySheet, printLines, sheetImages, exportStudyPdf } =
        await import('@/lib/study-print');
      const sheets = [];
      for (let i = 0; i < plants.length; i += 12) {
        const sheet = studySheet();
        plants.slice(i, i + 12).forEach((p, j) => {
          const px = 10 + (j % 2) * 100,
            py = 10 + Math.floor(j / 2) * 46;
          const c = sheet.context;
          c.strokeRect(px, py, 90, 40);
          const text = `${p.crop}\n${tr('garden.sow')}: ${p.sow}\n${tr('garden.transplant')}: ${p.transplant || '—'}\n${tr('garden.spacing')}: ${p.spacing} cm · ${plantCount(p)}`;
          printLines(c, text, 84, 3.5)
            .slice(0, 8)
            .forEach((line, k) => c.fillText(line, px + 3, py + 3 + k * 4.2));
        });
        sheets.push(sheet);
      }
      await exportStudyPdf(sheetImages(sheets), 'garden-labels.pdf');
    } catch {
      setError(tr('exportError'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OrganizerFrame title={tr('garden.title')} store={store}>
      <div className="flex flex-wrap items-end gap-3">
        <ChoiceField
          label={tr('garden.bed')}
          value={bed.id}
          options={store.data.beds.map((b) => ({ value: b.id, label: b.name }))}
          onChange={setSelected}
        />
        <Button
          variant="outline"
          disabled={store.data.beds.length >= 20}
          onClick={() => {
            const id = crypto.randomUUID();
            store.setData((d) => ({
              ...d,
              beds: [
                ...d.beds,
                {
                  id,
                  name: String(d.beds.length + 1),
                  width: 240,
                  height: 120,
                },
              ],
            }));
            setSelected(id);
          }}
        >
          {tr('garden.addBed')}
        </Button>
        <Button
          variant="outline"
          disabled={store.data.beds.length <= 1 || plants.length > 0}
          onClick={() => {
            store.setData((d) => ({
              ...d,
              beds: d.beds.filter((b) => b.id !== bed.id),
            }));
            setSelected(store.data.beds.find((b) => b.id !== bed.id)!.id);
          }}
        >
          {tr('delete')}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <OrganizerInput
          label={tr('name')}
          value={bed.name}
          onChange={(e) =>
            store.setData((d) => ({
              ...d,
              beds: d.beds.map((b) =>
                b.id === bed.id ? { ...b, name: e.target.value } : b,
              ),
            }))
          }
        />
        {(['width', 'height'] as const).map((key) => (
          <OrganizerInput
            key={key}
            label={tr(`garden.${key}`)}
            type="number"
            min={1}
            max={100000}
            value={bed[key]}
            onChange={(e) =>
              store.setData((d) => ({
                ...d,
                beds: d.beds.map((b) =>
                  b.id === bed.id ? { ...b, [key]: Number(e.target.value) } : b,
                ),
              }))
            }
          />
        ))}
      </div>
      <svg
        className="max-h-80 w-full rounded-lg border bg-muted/20"
        viewBox={`0 0 ${bed.width} ${bed.height}`}
        role="img"
        aria-label={tr('garden.layout')}
      >
        <rect
          width={bed.width}
          height={bed.height}
          fill="none"
          stroke="currentColor"
        />
        {plants.map((p, i) => (
          <g key={p.id}>
            <rect
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.height}
              fill={['#16a34a', '#2563eb', '#9333ea', '#ea580c'][i % 4]}
              fillOpacity=".3"
              stroke="currentColor"
            />
            <text
              x={p.x + 2}
              y={p.y + Math.min(10, p.height / 2)}
              fontSize={Math.max(3, Math.min(9, p.width / (p.crop.length + 2)))}
              fill="currentColor"
            >
              {p.crop} · {plantCount(p)}
            </text>
          </g>
        ))}
      </svg>
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">{tr('garden.batch')}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <OrganizerInput
            label={tr('garden.crop')}
            value={crop}
            maxLength={200}
            onChange={(e) => setCrop(e.target.value)}
          />
          {nfield('x', x, setX)}
          {nfield('y', y, setY)}
          {nfield('width', width, setWidth)}
          {nfield('height', height, setHeight)}
          {nfield('spacing', spacing, setSpacing)}
          <OrganizerInput
            label={tr('garden.sow')}
            type="date"
            value={sow}
            onChange={(e) => setSow(e.target.value)}
          />
          <OrganizerInput
            label={tr('garden.transplant')}
            type="date"
            value={transplant}
            onChange={(e) => setTransplant(e.target.value)}
          />
          <OrganizerInput
            label={tr('note')}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Button onClick={addPlant}>{tr('add')}</Button>
        <p className="text-sm text-muted-foreground">{tr('garden.hint')}</p>
      </section>
      <div className="space-y-2">
        {plants.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded border p-3"
          >
            <strong>
              {p.crop} × {plantCount(p)}
            </strong>
            <span>
              {p.sow} → {p.transplant || '—'}
            </span>
            <span>{p.note}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCrop(p.crop);
                setX(p.x);
                setY(p.y);
                setWidth(p.width);
                setHeight(p.height);
                setSpacing(p.spacing);
                setSow(p.sow);
                setTransplant(p.transplant);
                setNote(p.note);
              }}
            >
              {tr('duplicate')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                store.setData((d) => ({
                  ...d,
                  plants: d.plants.filter((item) => item.id !== p.id),
                }))
              }
            >
              {tr('delete')}
            </Button>
          </div>
        ))}
      </div>
      <Button
        disabled={!plants.length || busy}
        onClick={() => void printLabels()}
      >
        {tr('garden.print')}
      </Button>
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">{tr('garden.care')}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <OrganizerInput
            label={tr('date')}
            type="date"
            value={careDate}
            onChange={(e) => setCareDate(e.target.value)}
          />
          <OrganizerInput
            label={tr('garden.crop')}
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
          />
          <OrganizerInput
            label={tr('note')}
            value={careNote}
            maxLength={1000}
            onChange={(e) => setCareNote(e.target.value)}
          />
        </div>
        <Button
          onClick={() =>
            store.setData((d) => ({
              ...d,
              care: [
                ...d.care,
                {
                  id: crypto.randomUUID(),
                  date: careDate,
                  crop,
                  note: careNote,
                },
              ],
            }))
          }
        >
          {tr('add')}
        </Button>
        {store.data.care
          .slice()
          .reverse()
          .map((c) => (
            <p key={c.id} className="flex flex-wrap items-center gap-2">
              {c.date} · {c.crop} · {c.note}
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  store.setData((d) => ({
                    ...d,
                    care: d.care.filter((x) => x.id !== c.id),
                  }))
                }
              >
                {tr('delete')}
              </Button>
            </p>
          ))}
      </section>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </OrganizerFrame>
  );
}
