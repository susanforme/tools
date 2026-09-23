import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StringParam,
  NumberParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { bindTemplate } from '@/lib/document-workspace-core';
import { studyRows, studySheet, printLines } from '@/lib/study-print';
import { downloadBytes } from '@/lib/download';
import { PracticalText, useLatestJob } from './practical-ui';
import { ChoiceField, NumberField } from './calculator-ui';
import { Button } from './ui/button';
import { DocumentError } from './document-workspace-ui';
export function BatchDocuments() {
  const { t } = useTranslation();
  const [q, setQ] = useQueryParams<{
    template: string;
    start: number;
    format: string;
  }>({ template: StringParam, start: NumberParam, format: StringParam });
  const kind = q.template ?? 'certificate',
    start = q.start ?? 1,
    format = q.format ?? 'pdf';
  const [source, setSource] = useState(
    'name,item,amount,date\nAlice,Design,1200,2026-09-23\nBob,Development,2500,2026-09-24',
  );
  const [custom, setCustom] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('DOC-');
  const template =
    custom ??
    t(`documentWorkspaces.templates.${kind}`, {
      defaultValue: t('documentWorkspaces.templates.certificate'),
    });
  const key = JSON.stringify([source, template, prefix, start, format]);
  const job = useLatestJob<{
    bytes: Uint8Array;
    preview: string;
    filename: string;
  }>(key);
  const generate = () =>
    void job.run(async () => {
      const rows = await studyRows(source);
      if (
        rows.length < 2 ||
        rows.length > 101 ||
        rows.some((row) => row.length !== rows[0].length) ||
        !Number.isInteger(start) ||
        start < 0 ||
        start > 99999999
      )
        throw new Error('batch');
      const { PDFDocument } = await import('pdf-lib');
      const combined = await PDFDocument.create();
      const files: Record<string, Uint8Array> = {};
      let preview = '';
      let pages = 0;
      for (let n = 1; n < rows.length; n++) {
        const text = bindTemplate(
          template,
          rows[0],
          rows[n],
          `${prefix}${String(start + n - 1).padStart(4, '0')}`,
        );
        if (text.length > 50000) throw new Error('size');
        if (n === 1) preview = text;
        const pdf = format === 'zip' ? await PDFDocument.create() : combined;
        let sheet = studySheet();
        let y = 22;
        const save = async () => {
          if (++pages > 200) throw new Error('pages');
          const image = await pdf.embedPng(sheet.canvas.toDataURL('image/png'));
          const page = pdf.addPage([595.28, 841.89]);
          page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
          sheet.canvas.width = sheet.canvas.height = 0;
        };
        for (const line of printLines(sheet.context, text, 168, 5)) {
          if (y > 272) {
            await save();
            sheet = studySheet();
            y = 22;
          }
          sheet.context.font = '5px sans-serif';
          sheet.context.fillText(line, 21, y);
          y += 8;
        }
        await save();
        if (format === 'zip')
          files[`${String(n).padStart(3, '0')}.pdf`] = await pdf.save();
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (format === 'zip') {
        const { zipSync } = await import('fflate');
        return { bytes: zipSync(files), preview, filename: 'documents.zip' };
      }
      return {
        bytes: await combined.save(),
        preview,
        filename: 'documents.pdf',
      };
    });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('documentWorkspaces.batchHint')}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <ChoiceField
          label={t('documentWorkspaces.template')}
          value={kind}
          options={['certificate', 'notice', 'quote'].map((value) => ({
            value,
            label: t(`documentWorkspaces.${value}`),
          }))}
          onChange={(template) => {
            setQ({ template });
            setCustom(null);
          }}
        />
        <NumberField
          label={t('documentWorkspaces.start')}
          value={start}
          min={0}
          max={99999999}
          step={1}
          onChange={(start) => setQ({ start })}
        />
        <ChoiceField
          label={t('documentWorkspaces.format')}
          value={format}
          options={[
            { value: 'pdf', label: 'PDF' },
            { value: 'zip', label: 'ZIP' },
          ]}
          onChange={(format) => setQ({ format })}
        />
      </div>
      <PracticalText
        label={t('documentWorkspaces.prefix')}
        value={prefix}
        onChange={setPrefix}
        maxLength={50}
      />
      <PracticalText
        label="CSV"
        value={source}
        onChange={setSource}
        multiline
        maxLength={500000}
      />
      <PracticalText
        label={t('documentWorkspaces.templateBody')}
        value={template}
        onChange={setCustom}
        multiline
        maxLength={12000}
      />
      <Button disabled={job.busy} onClick={generate}>
        {t(
          job.busy ? 'documentWorkspaces.processing' : 'documentWorkspaces.generate',
        )}
      </Button>
      <DocumentError error={job.error} />
      {job.result && (
        <>
          <pre className="whitespace-pre-wrap rounded border p-4">
            {job.result.preview}
          </pre>
          <Button
            onClick={() =>
              downloadBytes(job.result!.bytes, job.result!.filename)
            }
          >
            {t('documentWorkspaces.download')}
          </Button>
        </>
      )}
    </div>
  );
}
