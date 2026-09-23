import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import { useBoundedWorker } from '@/hooks/use-bounded-worker';
import {
  validFamily,
  exportGedcom,
  importGedcom,
  type FamilyTree,
  type FamilyMember,
  type familyKinship,
} from '@/lib/family-tree-model';
import { downloadBlob } from '@/lib/download';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from './organizer-store';
import { ChoiceField } from './calculator-ui';
import { Button } from './ui/button';
import { LifeError } from './life-workspace-ui';
const INITIAL: FamilyTree = { members: [], links: [] };
const createWorker = () =>
  new Worker(
    new URL('../workers/family-tree-kinship.worker.ts', import.meta.url),
    { type: 'module' },
  );
export function FamilyTreePanel() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`lifeWorkspace.${k}`);
  const store = useOrganizerStore('family-tree-v1', INITIAL, validFamily);
  const [draft, setDraft] = useState<FamilyMember | null>(null),
    [error, setError] = useState<string | null>(null),
    [pending, setPending] = useState<ReturnType<typeof importGedcom> | null>(
      null,
    );
  const [q, setQ] = useQueryParams<{
    from: string;
    to: string;
    relation: string;
  }>({ from: StringParam, to: StringParam, relation: StringParam });
  const from = store.data.members.some((m) => m.id === q.from)
      ? q.from!
      : (store.data.members[0]?.id ?? ''),
    to = store.data.members.some((m) => m.id === q.to)
      ? q.to!
      : (store.data.members[1]?.id ?? ''),
    relation = q.relation === 'partner' ? 'partner' : 'parent';
  const version = useRef(0);
  const task = useBoundedWorker<
    { tree: FamilyTree; from: string; to: string },
    Awaited<ReturnType<typeof familyKinship>>
  >(createWorker);
  useEffect(() => {
    task.clear();
    version.current++;
    setPending(null);
  }, [store.data, from, to, task.clear]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  const levelCache = new Map<string, number>();
  function level(id: string): number {
    const cached = levelCache.get(id);
    if (cached !== undefined) return cached;
    const parents = store.data.links.filter(
      (l) => l.kind === 'parent' && l.to === id,
    );
    const value = parents.length
      ? 1 + Math.max(...parents.map((l) => level(l.from)))
      : 0;
    levelCache.set(id, value);
    return value;
  }
  const columns = new Map<number, number>();
  const positions = new Map(
    store.data.members.map((m) => {
      const y = level(m.id),
        x = columns.get(y) ?? 0;
      columns.set(y, x + 1);
      return [m.id, { x: 20 + x * 170, y: 20 + y * 100 }];
    }),
  );
  const width = Math.max(
      400,
      ...[...columns.values()].map((n) => n * 170 + 20),
    ),
    height = Math.max(160, ...[...positions.values()].map((p) => p.y + 80));
  const options = store.data.members.map((m) => ({
    value: m.id,
    label: m.name,
  }));
  return (
    <OrganizerFrame title={tr('family.title')} store={store}>
      <p className="text-sm text-muted-foreground">{tr('family.hint')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Button
          disabled={store.data.members.length >= 200}
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              name: '',
              sex: 'U',
              birth: '',
              death: '',
            })
          }
        >
          {tr('add')}
        </Button>
        <Button
          variant="outline"
          disabled={!store.data.members.length}
          onClick={() => {
            try {
              downloadBlob(
                new Blob([exportGedcom(store.data)], {
                  type: 'text/plain;charset=utf-8',
                }),
                'family.ged',
              );
            } catch {
              setError('exportError');
            }
          }}
        >
          {tr('family.export')}
        </Button>
        <OrganizerInput
          label={tr('family.import')}
          type="file"
          accept=".ged,text/plain"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const ticket = ++version.current;
            setError(null);
            setPending(null);
            try {
              if (file.size > 1000000) throw Error('limit');
              const text = new TextDecoder('utf-8', { fatal: true }).decode(
                await file.arrayBuffer(),
              );
              const result = importGedcom(text);
              if (ticket === version.current) setPending(result);
            } catch (cause) {
              if (ticket === version.current)
                setError((cause as Error).message);
            }
          }}
        />
      </div>
      {pending && (
        <section className="space-y-2 rounded border p-3">
          <p>
            {tr('family.importPreview')}: {pending.tree.members.length} ·{' '}
            {tr('family.omitted')}: {pending.omitted}
          </p>
          <Button
            onClick={() => {
              if (store.setData(pending.tree)) {
                setPending(null);
                setDraft(null);
              }
            }}
          >
            {tr('family.replace')}
          </Button>
          <Button variant="ghost" onClick={() => setPending(null)}>
            {tr('cancel')}
          </Button>
        </section>
      )}
      {draft && (
        <section className="min-w-0 space-y-3 break-words rounded border p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <OrganizerInput
              label={tr('name')}
              value={draft.name}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <ChoiceField
              label={tr('family.sex')}
              value={draft.sex}
              options={['M', 'F', 'U'].map((value) => ({
                value,
                label: tr(`family.${value}`),
              }))}
              onChange={(sex) =>
                setDraft({ ...draft, sex: sex as FamilyMember['sex'] })
              }
            />
            {(['birth', 'death'] as const).map((k) => (
              <OrganizerInput
                key={k}
                label={tr(`family.${k}`)}
                placeholder="YYYY-MM-DD"
                value={draft[k]}
                maxLength={100}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            ))}
          </div>
          <Button
            onClick={() => {
              const next = {
                ...store.data,
                members: store.data.members.some((m) => m.id === draft.id)
                  ? store.data.members.map((m) =>
                      m.id === draft.id ? draft : m,
                    )
                  : [...store.data.members, draft],
              };
              if (!validFamily(next)) {
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
      {store.data.members.length > 0 && (
        <>
          <div className="grid items-end gap-3 md:grid-cols-4">
            <ChoiceField
              label={tr('family.from')}
              value={from}
              options={options}
              onChange={(from) => setQ({ from })}
            />
            <ChoiceField
              label={tr('family.to')}
              value={to || from}
              options={options}
              onChange={(to) => setQ({ to })}
            />
            <ChoiceField
              label={tr('family.relation')}
              value={relation}
              options={['parent', 'partner'].map((value) => ({
                value,
                label: tr(`family.${value}`),
              }))}
              onChange={(relation) => setQ({ relation })}
            />
            <Button
              onClick={() => {
                const next = {
                  ...store.data,
                  links: [
                    ...store.data.links,
                    {
                      id: crypto.randomUUID(),
                      from,
                      to: to || from,
                      kind: relation,
                    },
                  ],
                };
                if (!validFamily(next)) {
                  setError('familyInvalid');
                  return;
                }
                if (store.setData(next)) setError(null);
              }}
            >
              {tr('family.link')}
            </Button>
          </div>
          <Button
            disabled={!to || task.busy}
            variant="outline"
            onClick={() => task.run({ tree: store.data, from, to })}
          >
            {tr('family.query')}
          </Button>
          {task.result && (
            <section className="rounded border p-3" aria-live="polite">
              {task.result.path ? (
                <>
                  <p>
                    {task.result.path.ids
                      .map(
                        (id) =>
                          store.data.members.find((m) => m.id === id)?.name,
                      )
                      .join(' → ')}
                  </p>
                  <p>
                    {task.result.titles.length
                      ? task.result.titles.join(' / ')
                      : tr('family.unknown')}
                  </p>
                </>
              ) : (
                tr('family.unrelated')
              )}
            </section>
          )}
          <div className="overflow-x-auto rounded border">
            <svg
              role="img"
              aria-label={tr('family.graph')}
              width={width}
              height={height}
            >
              {store.data.links.map((l) => {
                const a = positions.get(l.from)!,
                  b = positions.get(l.to)!;
                return (
                  <line
                    key={l.id}
                    x1={a.x + 65}
                    y1={a.y + 25}
                    x2={b.x + 65}
                    y2={b.y + 25}
                    stroke={l.kind === 'parent' ? '#16a34a' : '#ea580c'}
                    strokeWidth="2"
                    strokeDasharray={l.kind === 'partner' ? '6 4' : undefined}
                  />
                );
              })}
              {store.data.members.map((m) => {
                const p = positions.get(m.id)!;
                return (
                  <g key={m.id}>
                    <rect
                      x={p.x}
                      y={p.y}
                      width="140"
                      height="50"
                      rx="6"
                      className="fill-background stroke-border"
                    />
                    <text
                      x={p.x + 8}
                      y={p.y + 21}
                      fontSize="13"
                      className="fill-foreground"
                    >
                      {m.name.slice(0, 10)}
                    </text>
                    <text
                      x={p.x + 8}
                      y={p.y + 40}
                      fontSize="10"
                      className="fill-muted-foreground"
                    >
                      {m.birth.slice(0, 18)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}
      {store.data.members.map((m) => (
        <article
          key={m.id}
          className="flex min-w-0 flex-wrap items-center gap-3 break-words rounded border p-3"
        >
          <strong>{m.name}</strong>
          <span>
            {tr(`family.${m.sex}`)} · {m.birth || '—'} – {m.death || '—'}
          </span>
          <Button variant="outline" size="sm" onClick={() => setDraft(m)}>
            {tr('edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              store.setData((d) => ({
                members: d.members.filter((p) => p.id !== m.id),
                links: d.links.filter((l) => l.from !== m.id && l.to !== m.id),
              }));
              if (draft?.id === m.id) setDraft(null);
            }}
          >
            {tr('delete')}
          </Button>
        </article>
      ))}
      {store.data.links.map((l) => (
        <div key={l.id} className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            {store.data.members.find((m) => m.id === l.from)?.name} →{' '}
            {store.data.members.find((m) => m.id === l.to)?.name} ·{' '}
            {tr(`family.${l.kind}`)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              store.setData((d) => ({
                ...d,
                links: d.links.filter((x) => x.id !== l.id),
              }))
            }
          >
            {tr('delete')}
          </Button>
        </div>
      ))}
      <LifeError error={error ?? task.error} />
    </OrganizerFrame>
  );
}
