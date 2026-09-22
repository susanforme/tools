import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { validKnitting, type KnittingProject } from '@/lib/organizer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/knitting-counter')({
  component: KnittingCounterPage,
});
const INITIAL: KnittingProject[] = [];
function KnittingCounterPage() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'tools.knitting-counter.v1',
    INITIAL,
    validKnitting,
  );
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [markerRow, setMarkerRow] = useState(1);
  const [markerNote, setMarkerNote] = useState('');
  const project =
    store.data.find((item) => item.id === selected) ?? store.data[0];
  const update = (value: KnittingProject) =>
    store.setData((previous) =>
      previous.map((item) => (item.id === value.id ? value : item)),
    );
  const move = (row: number) =>
    project &&
    update({
      ...project,
      row,
      history: [...project.history.slice(-99), project.row],
    });
  const next = project?.markers
    .filter((marker) => marker.row > project.row)
    .sort((a, b) => a.row - b.row)[0];
  return (
    <OrganizerFrame title={t('knittingCounter.title')} store={store}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          const id = crypto.randomUUID();
          if (
            store.setData([
              ...store.data,
              {
                id,
                name: name.trim(),
                row: 0,
                cycle: 4,
                history: [],
                markers: [],
              },
            ])
          ) {
            setSelected(id);
            setName('');
          }
        }}
      >
        <OrganizerInput
          label={t('knittingCounter.project')}
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
        <Button disabled={!name.trim() || store.data.length >= 50}>
          {t('organizer.create')}
        </Button>
      </form>
      {project && (
        <>
          <div className="flex flex-wrap gap-3">
            <Select value={project.id} onValueChange={setSelected}>
              <SelectTrigger
                aria-label={t('knittingCounter.project')}
                className="w-64"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {store.data.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={store.data.length >= 50}
              onClick={() => {
                const id = crypto.randomUUID();
                if (
                  store.setData([
                    ...store.data,
                    {
                      ...project,
                      id,
                      name: `${project.name.slice(0, 100)} ${t('organizer.copy')}`,
                      row: 0,
                      history: [],
                    },
                  ])
                )
                  setSelected(id);
              }}
            >
              {t('organizer.copy')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                store.setData(
                  store.data.filter((item) => item.id !== project.id),
                )
              }
            >
              {t('organizer.delete')}
            </Button>
          </div>
          <div className="space-y-5 rounded-xl border p-6 text-center">
            <div aria-live="polite" aria-atomic="true">
              <p className="text-sm text-muted-foreground">
                {t('knittingCounter.total')}
              </p>
              <p className="text-7xl font-semibold tabular-nums">
                {project.row}
              </p>
              <p className="mt-2">
                {t('knittingCounter.patternRow')}:{' '}
                {project.row ? ((project.row - 1) % project.cycle) + 1 : 0} /{' '}
                {project.cycle}
              </p>
              {project.markers
                .filter((marker) => marker.row === project.row)
                .map((marker) => (
                  <p
                    key={marker.id}
                    className="mt-3 font-semibold text-primary"
                  >
                    {marker.note}
                  </p>
                ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                size="lg"
                disabled={project.row === 0}
                onClick={() => move(project.row - 1)}
              >
                −1
              </Button>
              <Button
                size="lg"
                disabled={project.row >= 100000}
                onClick={() => move(project.row + 1)}
              >
                +1 {t('knittingCounter.row')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={!project.history.length}
                onClick={() =>
                  update({
                    ...project,
                    row: project.history.at(-1)!,
                    history: project.history.slice(0, -1),
                  })
                }
              >
                {t('knittingCounter.undo')}
              </Button>
            </div>
            {next && (
              <p className="text-sm text-muted-foreground">
                {t('knittingCounter.next', { row: next.row })}: {next.note}
              </p>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <OrganizerInput
              label={t('knittingCounter.total')}
              type="number"
              min={0}
              max={100000}
              value={project.row}
              onChange={(event) => move(Number(event.target.value))}
            />
            <OrganizerInput
              label={t('knittingCounter.cycle')}
              type="number"
              min={1}
              max={10000}
              value={project.cycle}
              onChange={(event) =>
                update({ ...project, cycle: Number(event.target.value) })
              }
            />
          </div>
          <h2 className="font-semibold">{t('knittingCounter.markers')}</h2>
          <form
            className="grid items-end gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!markerNote.trim()) return;
              if (
                update({
                  ...project,
                  markers: [
                    ...project.markers,
                    {
                      id: crypto.randomUUID(),
                      row: markerRow,
                      note: markerNote.trim(),
                    },
                  ],
                })
              )
                setMarkerNote('');
            }}
          >
            <OrganizerInput
              label={t('knittingCounter.row')}
              type="number"
              min={1}
              max={100000}
              value={markerRow}
              onChange={(event) => setMarkerRow(Number(event.target.value))}
            />
            <OrganizerInput
              label={t('knittingCounter.note')}
              value={markerNote}
              maxLength={120}
              placeholder={t('knittingCounter.placeholder')}
              onChange={(event) => setMarkerNote(event.target.value)}
            />
            <Button
              disabled={!markerNote.trim() || project.markers.length >= 200}
            >
              {t('organizer.add')}
            </Button>
          </form>
          <div className="space-y-2">
            {project.markers
              .slice()
              .sort((a, b) => a.row - b.row)
              .map((marker) => (
                <div
                  key={marker.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span>
                    {marker.row} · {marker.note}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update({
                        ...project,
                        markers: project.markers.filter(
                          (item) => item.id !== marker.id,
                        ),
                      })
                    }
                  >
                    {t('organizer.delete')}
                  </Button>
                </div>
              ))}
          </div>
        </>
      )}
    </OrganizerFrame>
  );
}
