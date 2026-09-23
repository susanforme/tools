import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { ChoiceField } from '@/components/calculator-ui';
import { Button } from '@/components/ui/button';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  importLedgerCsv,
  ledgerReport,
  parseMoney,
  validLedger,
  type Ledger,
  type LedgerEntry,
} from '@/lib/batch4-organizer-tools';
import { localDay } from '@/lib/organizer-tools';
import { downloadBlob } from '@/lib/download';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/expense-ledger')({
  component: ExpenseLedgerPage,
});
const INITIAL: Ledger = { entries: [], budgets: [] };
function ExpenseLedgerPage() {
  const { t } = useTranslation();
  const tr = (k: string) => t(`batch4Organizers.${k}`);
  const store = useOrganizerStore(
    'tools.expense-ledger.v1',
    INITIAL,
    validLedger,
  );
  const [month, setMonth] = useQueryParam(
    'month',
    StringParam,
    localDay().slice(0, 7),
  );
  const [kind, setKind] = useQueryParam<LedgerEntry['kind']>(
    'kind',
    StringParam,
    'expense',
  );
  const [date, setDate] = useState(localDay());
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [to, setTo] = useState('');
  const [money, setMoney] = useState('');
  const [note, setNote] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetMoney, setBudgetMoney] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  useEffect(() => {
    version.current++;
    setBusy(false);
  }, [store.data]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  const report = ledgerReport(store.data, month);
  const shown = store.data.entries
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const fmt = (c: number) => (c / 100).toFixed(2);
  function add() {
    try {
      const entry: LedgerEntry = {
        id: crypto.randomUUID(),
        date,
        kind,
        category,
        account,
        to,
        cents: parseMoney(money),
        note,
      };
      if (!validLedger({ entries: [entry], budgets: [] })) throw Error();
      store.setData((d) => ({ ...d, entries: [...d.entries, entry] }));
      setError(null);
    } catch {
      setError(tr('invalid'));
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    const id = ++version.current;
    setBusy(true);
    setError(null);
    try {
      if (file.size > 500000) throw Error();
      const rows = await importLedgerCsv(await file.text());
      if (id !== version.current) return;
      store.setData((d) => ({ ...d, entries: [...d.entries, ...rows] }));
    } catch {
      if (id === version.current) setError(tr('csvError'));
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  async function exportCsv() {
    try {
      const { default: Papa } = await import('papaparse');
      downloadBlob(
        new Blob(
          [
            Papa.unparse(
              shown.map((e) => ({
                date: e.date,
                kind: e.kind,
                category: e.category,
                account: e.account,
                to: e.to,
                amount: fmt(e.cents),
                note: e.note,
              })),
              { escapeFormulae: true },
            ),
          ],
          { type: 'text/csv;charset=utf-8' },
        ),
        'ledger.csv',
      );
    } catch {
      setError(tr('exportError'));
    }
  }
  return (
    <OrganizerFrame title={tr('ledger.title')} store={store}>
      <div className="grid gap-3 md:grid-cols-4">
        <OrganizerInput
          label={tr('month')}
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <p>
          {tr('income')}: {fmt(report.income)}
        </p>
        <p>
          {tr('expense')}: {fmt(report.expense)}
        </p>
        <p>
          {tr('net')}: {fmt(report.income - report.expense)}
        </p>
      </div>
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">{tr('ledger.entry')}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <ChoiceField
            label={tr('kind')}
            value={kind}
            options={['income', 'expense', 'transfer'].map((value) => ({
              value,
              label: tr(value),
            }))}
            onChange={(v) => setKind(v as LedgerEntry['kind'])}
          />
          <OrganizerInput
            label={tr('date')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <OrganizerInput
            label={tr('account')}
            value={account}
            maxLength={200}
            onChange={(e) => setAccount(e.target.value)}
          />
          {kind === 'transfer' ? (
            <OrganizerInput
              label={tr('toAccount')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          ) : (
            <OrganizerInput
              label={tr('category')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          )}
          <OrganizerInput
            label={tr('amount')}
            inputMode="decimal"
            value={money}
            onChange={(e) => setMoney(e.target.value)}
          />
          <OrganizerInput
            label={tr('note')}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Button onClick={add}>{tr('add')}</Button>
      </section>
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">{tr('ledger.budgets')}</h2>
        <div className="flex flex-wrap items-end gap-3">
          <OrganizerInput
            label={tr('category')}
            value={budgetCategory}
            onChange={(e) => setBudgetCategory(e.target.value)}
          />
          <OrganizerInput
            label={tr('amount')}
            value={budgetMoney}
            onChange={(e) => setBudgetMoney(e.target.value)}
          />
          <Button
            onClick={() => {
              try {
                const cents = parseMoney(budgetMoney);
                if (!budgetCategory.trim()) throw Error();
                store.setData((d) => ({
                  ...d,
                  budgets: [
                    ...d.budgets.filter((b) => b.category !== budgetCategory),
                    { category: budgetCategory, cents },
                  ],
                }));
                setError(null);
              } catch {
                setError(tr('invalid'));
              }
            }}
          >
            {tr('save')}
          </Button>
        </div>
        {store.data.budgets.map((b) => (
          <div key={b.category} className="flex flex-wrap items-center gap-3">
            <span>
              {b.category}: {fmt(report.categories[b.category] ?? 0)} /{' '}
              {fmt(b.cents)} · {tr('remaining')}:{' '}
              {fmt(b.cents - (report.categories[b.category] ?? 0))}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                store.setData((d) => ({
                  ...d,
                  budgets: d.budgets.filter((x) => x.category !== b.category),
                }))
              }
            >
              {tr('delete')}
            </Button>
          </div>
        ))}
      </section>
      <section>
        <h2 className="font-semibold">{tr('ledger.balances')}</h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(report.balances).map(([name, cents]) => (
            <p key={name}>
              {name}: {fmt(cents)}
            </p>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap items-end gap-3">
        <OrganizerInput
          label={tr('importCsv')}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button variant="outline" onClick={() => void exportCsv()}>
          {tr('exportCsv')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            downloadBlob(
              new Blob(
                [
                  'date,kind,category,account,to,amount,note\n2026-09-01,expense,Food,Cash,,12.50,Lunch\n',
                ],
                { type: 'text/csv' },
              ),
              'ledger-template.csv',
            )
          }
        >
          {tr('template')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{tr('ledger.limits')}</p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <Table className="w-full text-sm">
          <TableHeader>
            <TableRow>
              {[
                'date',
                'kind',
                'category',
                'account',
                'amount',
                'note',
                'delete',
              ].map((k) => (
                <TableHead className="p-2 text-left" key={k}>
                  {tr(k)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((e) => (
              <TableRow key={e.id} className="border-t">
                <TableCell className="p-2 whitespace-nowrap">
                  {e.date}
                </TableCell>
                <TableCell>{tr(e.kind)}</TableCell>
                <TableCell>{e.category}</TableCell>
                <TableCell>
                  {e.account}
                  {e.kind === 'transfer' ? ` → ${e.to}` : ''}
                </TableCell>
                <TableCell>{fmt(e.cents)}</TableCell>
                <TableCell className="max-w-64 break-words">{e.note}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      store.setData((d) => ({
                        ...d,
                        entries: d.entries.filter((x) => x.id !== e.id),
                      }))
                    }
                  >
                    {tr('delete')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </OrganizerFrame>
  );
}
