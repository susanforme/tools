import { DocumentSection } from '@/components/batch4-document-ui';
import { BatchDocuments } from '@/components/batch4-document-batch';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  documentTotals,
  validateDocument,
  type DocumentData,
  type DocumentLine,
} from '@/lib/productivity-data';
import {
  printLines,
  sheetImages,
  studySheet,
  type StudySheet,
} from '@/lib/study-print';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { ChoiceField } from '@/components/calculator-ui';
import { ProductivityError } from '@/components/productivity-ui';
import { PracticalText } from '@/components/practical-ui';
import { StudyPreview } from '@/components/study-tools-ui';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/document-maker')({
  component: () => (
    <DocumentSection
      original="productivity.tools.document-maker.title"
      name="batchTitle"
      base={<DocumentMaker />}
      extra={<BatchDocuments />}
    />
  ),
});
const INITIAL: DocumentData = {
  number: '',
  date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10),
  issuer: '',
  recipient: '',
  note: '',
  lines: [],
};
const CURRENCIES = ['CNY', 'USD', 'EUR', 'GBP', 'JPY', 'HKD'] as const;
function DocumentMaker() {
  const { t, i18n } = useTranslation();
  const store = useOrganizerStore(
    'document-maker-v1',
    INITIAL,
    validateDocument,
  );
  const [query, setQuery] = useQueryParams<{
    type: string;
    currency: string;
    tax: string;
  }>({ type: StringParam, currency: StringParam, tax: StringParam });
  const kind = ['quote', 'receipt', 'packing'].includes(query.type ?? '')
    ? query.type!
    : 'quote';
  const currency = CURRENCIES.includes(
    query.currency as (typeof CURRENCIES)[number],
  )
    ? query.currency!
    : 'CNY';
  const tax = query.tax ?? '0';
  const data = store.data;
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    key: string;
    images: string[];
  } | null>(null);
  const key = JSON.stringify([data, kind, currency, tax, i18n.language]);
  const set = (next: Partial<DocumentData>) =>
    store.setData({ ...data, ...next });
  const patchLine = (id: string, patch: Partial<DocumentLine>) =>
    set({
      lines: data.lines.map((line) =>
        line.id === id ? { ...line, ...patch } : line,
      ),
    });
  const money = (cents: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  let totals: ReturnType<typeof documentTotals> | null = null;
  try {
    totals = documentTotals(
      kind === 'packing'
        ? data.lines.map((line) => ({ ...line, price: '0' }))
        : data.lines,
      kind === 'packing' ? '0' : tax,
    );
  } catch {
    /* 用户尚未填完数字时，隐藏计算结果。 */
  }
  const generate = () => {
    try {
      if (
        !data.number.trim() ||
        !data.lines.length ||
        data.lines.some((line) => !line.name.trim())
      )
        throw new Error('invalid');
      const sums = documentTotals(
        kind === 'packing'
          ? data.lines.map((line) => ({ ...line, price: '0' }))
          : data.lines,
        kind === 'packing' ? '0' : tax,
      );
      const sheets: StudySheet[] = [];
      let sheet = studySheet();
      sheets.push(sheet);
      let y = 16;
      const newPage = () => {
        sheet = studySheet();
        sheets.push(sheet);
        y = 16;
      };
      const text = (value: string, size = 4.2) => {
        const lines = printLines(sheet.context, value, 178, size);
        for (const line of lines) {
          if (y + size * 1.5 > 280) newPage();
          sheet.context.font = `${size}px sans-serif`;
          sheet.context.fillText(line, 16, y);
          y += size * 1.5;
        }
      };
      text(t(`productivity.${kind}`), 8);
      text(`${t('productivity.documentNumber')}: ${data.number}`);
      text(`${t('productivity.date')}: ${data.date}`);
      text(`${t('productivity.issuer')}: ${data.issuer}`);
      text(`${t('productivity.recipient')}: ${data.recipient}`);
      y += 5;
      const header = () => {
        sheet.context.fillStyle = '#e5e7eb';
        sheet.context.fillRect(16, y, 178, 9);
        sheet.context.fillStyle = '#111827';
        sheet.context.font = '3.5px sans-serif';
        sheet.context.fillText(t('productivity.item'), 18, y + 2);
        sheet.context.fillText(t('productivity.quantity'), 106, y + 2);
        sheet.context.fillText(
          t(kind === 'packing' ? 'productivity.unit' : 'productivity.price'),
          135,
          y + 2,
        );
        if (kind !== 'packing')
          sheet.context.fillText(t('productivity.amount'), 166, y + 2);
        y += 11;
      };
      header();
      data.lines.forEach((line, index) => {
        const columns = [
          printLines(sheet.context, line.name, 83, 3.5),
          printLines(sheet.context, line.quantity, 25, 3.5),
          printLines(
            sheet.context,
            kind === 'packing' ? line.unit : money(Number(line.price) * 100),
            28,
            3.5,
          ),
          kind === 'packing'
            ? []
            : printLines(sheet.context, money(sums.lines[index]), 28, 3.5),
        ];
        const rowLines = Math.max(...columns.map((c) => c.length));
        for (let row = 0; row < rowLines; row++) {
          if (y + 6 > 275) {
            newPage();
            header();
          }
          sheet.context.font = '3.5px sans-serif';
          columns.forEach((lines, col) => {
            if (lines[row])
              sheet.context.fillText(lines[row], [18, 106, 135, 166][col], y);
          });
          y += 5.5;
        }
        sheet.context.beginPath();
        sheet.context.moveTo(16, y);
        sheet.context.lineTo(194, y);
        sheet.context.stroke();
        y += 3;
      });
      y += 4;
      if (kind !== 'packing') {
        text(`${t('productivity.subtotal')}: ${money(sums.subtotal)}`);
        text(`${t('productivity.taxAmount')} (${tax}%): ${money(sums.tax)}`);
        text(`${t('productivity.total')}: ${money(sums.total)}`, 5.5);
      } else
        text(
          `${t('productivity.total')}: ${data.lines.length} ${t('productivity.item')}`,
        );
      if (data.note) {
        y += 4;
        text(`${t('productivity.note')}: ${data.note}`);
      }
      sheets.forEach(({ context }, index) => {
        context.font = '3px sans-serif';
        context.fillText(`${index + 1} / ${sheets.length}`, 185, 288);
      });
      setPreview({ key, images: sheetImages(sheets) });
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <OrganizerFrame
      title={t('productivity.tools.document-maker.title')}
      store={store}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('productivity.documentType')}
          value={kind}
          options={['quote', 'receipt', 'packing'].map((value) => ({
            value,
            label: t(`productivity.${value}`),
          }))}
          onChange={(type) => setQuery({ type })}
        />
        <OrganizerInput
          label={t('productivity.documentNumber')}
          value={data.number}
          maxLength={200}
          onChange={(e) => set({ number: e.target.value })}
        />
        <OrganizerInput
          label={t('productivity.date')}
          type="date"
          value={data.date}
          min="1900-01-01"
          max="2200-12-31"
          onChange={(e) => {
            if (e.target.value) set({ date: e.target.value });
          }}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <PracticalText
          multiline
          label={t('productivity.issuer')}
          value={data.issuer}
          maxLength={2000}
          onChange={(issuer) => set({ issuer })}
        />
        <PracticalText
          multiline
          label={t('productivity.recipient')}
          value={data.recipient}
          maxLength={2000}
          onChange={(recipient) => set({ recipient })}
        />
      </div>
      {kind !== 'packing' && (
        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceField
            label={t('productivity.currency')}
            value={currency}
            options={CURRENCIES.map((value) => ({ value, label: value }))}
            onChange={(currency) => setQuery({ currency })}
          />
          <OrganizerInput
            label={t('productivity.tax')}
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={tax}
            onChange={(e) => setQuery({ tax: e.target.value })}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {t('productivity.documentLimit')}
      </p>
      <div className="space-y-3">
        {data.lines.map((line, index) => (
          <section key={line.id} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 md:grid-cols-4">
              <OrganizerInput
                label={`${index + 1}. ${t('productivity.item')}`}
                value={line.name}
                maxLength={300}
                onChange={(e) => patchLine(line.id, { name: e.target.value })}
              />
              <OrganizerInput
                label={t('productivity.quantity')}
                type="number"
                min="0"
                max="9999999.99"
                step="0.01"
                value={line.quantity}
                onChange={(e) =>
                  patchLine(line.id, { quantity: e.target.value })
                }
              />
              <OrganizerInput
                label={t('productivity.unit')}
                value={line.unit}
                maxLength={30}
                onChange={(e) => patchLine(line.id, { unit: e.target.value })}
              />
              {kind !== 'packing' && (
                <OrganizerInput
                  label={t('productivity.price')}
                  type="number"
                  min="0"
                  max="9999999.99"
                  step="0.01"
                  value={line.price}
                  onChange={(e) =>
                    patchLine(line.id, { price: e.target.value })
                  }
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              {kind !== 'packing' && totals && (
                <p className="font-mono">{money(totals.lines[index])}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  set({ lines: data.lines.filter((x) => x.id !== line.id) })
                }
              >
                {t('productivity.remove')}
              </Button>
            </div>
          </section>
        ))}
      </div>
      <Button
        variant="outline"
        disabled={data.lines.length >= 100}
        onClick={() =>
          set({
            lines: [
              ...data.lines,
              {
                id: crypto.randomUUID(),
                name: '',
                quantity: '1',
                price: '0',
                unit: '',
              },
            ],
          })
        }
      >
        {t('productivity.add')} {t('productivity.item')}
      </Button>
      {totals && kind !== 'packing' && (
        <div className="rounded-lg border p-4 text-right">
          <p>
            {t('productivity.subtotal')}: {money(totals.subtotal)}
          </p>
          <p>
            {t('productivity.taxAmount')}: {money(totals.tax)}
          </p>
          <p className="text-xl font-semibold">
            {t('productivity.total')}: {money(totals.total)}
          </p>
        </div>
      )}
      <PracticalText
        multiline
        label={t('productivity.note')}
        value={data.note}
        maxLength={3000}
        onChange={(note) => set({ note })}
      />
      <Button onClick={generate}>{t('productivity.generatePdf')}</Button>
      <ProductivityError error={error} />
      {preview?.key === key && (
        <StudyPreview
          images={preview.images}
          filename={`${kind}-${data.number.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'document'}.pdf`}
        />
      )}
    </OrganizerFrame>
  );
}
