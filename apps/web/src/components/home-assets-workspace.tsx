import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from './organizer-store';
import { Button } from './ui/button';
import { LifeError } from './life-workspace-ui';
import {
  validAssets,
  assetIcs,
  type Asset,
  type Attachment,
} from '@/lib/life-workspace-data';
import { localDay } from '@/lib/organizer-tools';
import { downloadBlob } from '@/lib/download';
const INITIAL: Asset[] = [];
export function AssetWarrantyPanel() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`lifeWorkspace.${k}`);
  const store = useOrganizerStore('asset-warranties-v1', INITIAL, validAssets);
  const [draft, setDraft] = useState<Asset | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [repairDate, setRepairDate] = useState(localDay()),
    [repairNote, setRepairNote] = useState(''),
    [repairCost, setRepairCost] = useState(0);
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  const edit = (a: Asset | null) => {
    version.current++;
    setBusy(false);
    setDraft(a);
    setRepairDate(localDay());
    setRepairNote('');
    setRepairCost(0);
    setError(null);
  };
  async function attach(file: File | undefined) {
    if (!file || !draft) return;
    const ticket = ++version.current;
    setBusy(true);
    setError(null);
    try {
      if (
        file.size > 256000 ||
        !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)
      )
        throw Error('attachment');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const good =
        file.type === 'application/pdf'
          ? new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
          : file.type === 'image/jpeg'
            ? bytes[0] === 255 && bytes[1] === 216
            : bytes[0] === 137 &&
              bytes[1] === 80 &&
              bytes[2] === 78 &&
              bytes[3] === 71;
      if (!good) throw Error('attachment');
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const attachment: Attachment = {
        name: file.name.slice(0, 200),
        type: file.type,
        data: `data:${file.type};base64,${btoa(binary)}`,
      };
      if (ticket === version.current)
        setDraft((d) => (d ? { ...d, attachment } : d));
    } catch {
      if (ticket === version.current) setError('attachment');
    } finally {
      if (ticket === version.current) setBusy(false);
    }
  }
  const download = (a: Attachment) => {
    try {
      const data = Uint8Array.from(atob(a.data.split(',')[1]), (c) =>
        c.charCodeAt(0),
      );
      downloadBlob(new Blob([data], { type: a.type }), a.name);
    } catch {
      setError('attachment');
    }
  };
  return (
    <OrganizerFrame title={tr('assets.title')} store={store}>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={store.data.length >= 100}
          onClick={() =>
            edit({
              id: crypto.randomUUID(),
              name: '',
              purchased: localDay(),
              warranty: '',
              borrower: '',
              loaned: '',
              due: '',
              returned: '',
              repairs: [],
              attachment: null,
            })
          }
        >
          {tr('add')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            try {
              downloadBlob(
                new Blob([assetIcs(store.data)], { type: 'text/calendar' }),
                'warranty-and-loans.ics',
              );
            } catch {
              setError('exportError');
            }
          }}
        >
          {tr('ics')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{tr('assets.hint')}</p>
      {draft && (
        <section className="space-y-4 rounded border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {(['name', 'borrower'] as const).map((k) => (
              <OrganizerInput
                key={k}
                label={tr(k === 'name' ? k : `assets.${k}`)}
                value={draft[k]}
                maxLength={120}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            ))}
            {(
              ['purchased', 'warranty', 'loaned', 'due', 'returned'] as const
            ).map((k) => (
              <OrganizerInput
                key={k}
                label={tr(`assets.${k}`)}
                type="date"
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            ))}
          </div>
          <div className="space-y-2">
            <OrganizerInput
              label={tr('assets.attachment')}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              disabled={busy}
              onChange={(e) => {
                void attach(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {draft.attachment && (
              <p className="break-all">
                {draft.attachment.name}{' '}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    version.current++;
                    setBusy(false);
                    setDraft({ ...draft, attachment: null });
                  }}
                >
                  {tr('delete')}
                </Button>
              </p>
            )}
          </div>
          <h2 className="font-semibold">{tr('assets.repairs')}</h2>
          <div className="grid items-end gap-3 md:grid-cols-4">
            <OrganizerInput
              label={tr('date')}
              type="date"
              value={repairDate}
              onChange={(e) => setRepairDate(e.target.value)}
            />
            <OrganizerInput
              label={tr('note')}
              value={repairNote}
              maxLength={1000}
              onChange={(e) => setRepairNote(e.target.value)}
            />
            <OrganizerInput
              label={tr('assets.cost')}
              type="number"
              min={0}
              step="0.01"
              value={repairCost}
              onChange={(e) => setRepairCost(Number(e.target.value))}
            />
            <Button
              variant="outline"
              onClick={() => {
                const next = {
                  ...draft,
                  repairs: [
                    ...draft.repairs,
                    { date: repairDate, note: repairNote, cost: repairCost },
                  ],
                };
                if (!validAssets([next])) {
                  setError('invalid');
                  return;
                }
                setDraft(next);
                setRepairNote('');
                setError(null);
              }}
            >
              {tr('add')}
            </Button>
          </div>
          {draft.repairs.map((r, i) => (
            <p key={i}>
              {r.date} · {r.note} · {r.cost.toFixed(2)}{' '}
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft({
                    ...draft,
                    repairs: draft.repairs.filter((_, j) => j !== i),
                  })
                }
              >
                {tr('delete')}
              </Button>
            </p>
          ))}
          <Button
            disabled={busy}
            onClick={() => {
              const next = store.data.some((a) => a.id === draft.id)
                ? store.data.map((a) => (a.id === draft.id ? draft : a))
                : [...store.data, draft];
              if (!validAssets(next)) {
                setError('invalid');
                return;
              }
              if (store.setData(next)) edit(null);
            }}
          >
            {tr('save')}
          </Button>
          <Button variant="ghost" onClick={() => edit(null)}>
            {tr('cancel')}
          </Button>
        </section>
      )}
      <LifeError error={error} />
      {store.data.map((a) => (
        <article
          key={a.id}
          className="min-w-0 space-y-2 break-words rounded border p-4"
        >
          <h2 className="font-semibold">{a.name}</h2>
          <p>
            {tr('assets.purchased')}: {a.purchased} · {tr('assets.warranty')}:{' '}
            {a.warranty || '—'}
            {a.warranty && a.warranty < localDay() ? ` · ${tr('expired')}` : ''}
          </p>
          {a.borrower && (
            <p>
              {a.borrower} · {a.loaned || '—'} → {a.due || '—'} ·{' '}
              {a.returned
                ? `${tr('assets.returned')}: ${a.returned}`
                : tr('assets.outstanding')}
              {!a.returned && a.due && a.due < localDay()
                ? ` · ${tr('overdue')}`
                : ''}
            </p>
          )}
          <details>
            <summary>
              {tr('assets.repairs')} ({a.repairs.length})
            </summary>
            {a.repairs.map((r, i) => (
              <p key={i} className="break-words">
                {r.date} · {r.note} · {r.cost.toFixed(2)}
              </p>
            ))}
          </details>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => edit(a)}>
              {tr('edit')}
            </Button>
            {a.attachment && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => download(a.attachment!)}
              >
                {tr('assets.download')}
              </Button>
            )}
            {a.borrower && !a.returned && (
              <Button
                size="sm"
                onClick={() =>
                  store.setData((d) =>
                    d.map((x) =>
                      x.id === a.id ? { ...x, returned: localDay() } : x,
                    ),
                  )
                }
              >
                {tr('assets.return')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                store.setData((d) => d.filter((x) => x.id !== a.id));
                if (draft?.id === a.id) edit(null);
              }}
            >
              {tr('delete')}
            </Button>
          </div>
        </article>
      ))}
    </OrganizerFrame>
  );
}
