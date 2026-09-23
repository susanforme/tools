import { ChoiceField, NumberField } from './calculator-ui';
import { PracticalText, useLatestJob, ExportText } from './practical-ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  fillPdf,
  importFormData,
  inspectPdfAdvanced,
  writePdfBookmarks,
  type FormValue,
} from '@/lib/pdf-advanced';
import { downloadBytes } from '@/lib/download';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export function PdfAdvancedPanel({ mode }: { mode: 'forms' | 'bookmarks' }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null),
    [revision, setRevision] = useState(0);
  const job = useLatestJob<{
    bytes: Uint8Array;
    data: Awaited<ReturnType<typeof inspectPdfAdvanced>>;
  }>(String(revision));
  return (
    <div className="space-y-4">
      <Label htmlFor="advanced-pdf-file">{t('calculatorUtilities.pdfFile')}</Label>
      <Input
        id="advanced-pdf-file"
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setRevision((n) => n + 1);
        }}
      />
      <Button
        disabled={!file || job.busy}
        onClick={() =>
          void job.run(async () => {
            if (!file || file.size > 20 * 1024 * 1024)
              throw new Error('fileLimit');
            const bytes = new Uint8Array(await file.arrayBuffer());
            return { bytes, data: await inspectPdfAdvanced(bytes) };
          })
        }
      >
        {t(job.busy ? 'calculatorUtilities.working' : 'calculatorUtilities.read')}
      </Button>
      {job.error && (
        <p role="alert" className="text-destructive">
          {t('calculatorUtilities.error', {
            message: t(`calculatorUtilities.${job.error}`, { defaultValue: job.error }),
          })}
        </p>
      )}
      {job.result && (
        <PdfDocumentEditor
          key={`${revision}:${mode}`}
          mode={mode}
          bytes={job.result.bytes}
          data={job.result.data}
        />
      )}
    </div>
  );
}
function PdfDocumentEditor({
  mode,
  bytes,
  data,
}: {
  mode: 'forms' | 'bookmarks';
  bytes: Uint8Array;
  data: Awaited<ReturnType<typeof inspectPdfAdvanced>>;
}) {
  const { t } = useTranslation();
  const label = (key: string) => t(`calculatorUtilities.${key}`);
  const [fields, setFields] = useState(data.fields),
    [marks, setMarks] = useState(data.bookmarks),
    [font, setFont] = useState<File | null>(null),
    [json, setJson] = useState(''),
    [error, setError] = useState<string | null>(null);
  const [fontRevision, setFontRevision] = useState(0);
  const [flatten, setFlatten] = useQueryParam<string>(
    'flatten',
    StringParam,
    '0',
  );
  const job = useLatestJob<Uint8Array>(
    JSON.stringify({ fields, marks, flatten, font: fontRevision }),
  );
  const change = (index: number, value: FormValue) =>
    setFields((fields) =>
      fields.map((field, i) => (i === index ? { ...field, value } : field)),
    );
  const outputJson = JSON.stringify(
    fields.map(({ name, value }) => ({ name, value })),
    null,
    2,
  );
  return (
    <div className="space-y-4">
      <p className="text-sm">{t('calculatorUtilities.pages', { count: data.pages })}</p>
      {mode === 'forms' ? (
        <>
          {!fields.length && <p>{label('noFields')}</p>}
          {fields.map((field, i) => (
            <fieldset
              key={field.name}
              disabled={field.readonly}
              className="space-y-2 rounded-lg border p-3"
            >
              <legend className="max-w-full break-all text-sm">
                {field.name}
                {field.readonly ? ` (${label('readonly')})` : ''}
              </legend>
              {field.kind === 'checkbox' ? (
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(checked) => change(i, checked === true)}
                  />
                  {field.name}
                </label>
              ) : field.kind === 'radio' ? (
                <ChoiceField
                  label={label('fieldValue')}
                  value={String(field.value) || '__empty__'}
                  options={[
                    { value: '__empty__', label: '—' },
                    ...field.options.map((value) => ({ value, label: value })),
                  ]}
                  onChange={(value) =>
                    change(i, value === '__empty__' ? '' : value)
                  }
                />
              ) : Array.isArray(field.value) ? (
                <div className="space-y-2">
                  {field.options.map((option) => (
                    <label key={option} className="flex items-center gap-2">
                      <Checkbox
                        checked={(field.value as string[]).includes(option)}
                        onCheckedChange={(checked) =>
                          change(
                            i,
                            checked === true
                              ? !field.multiple
                                ? [option]
                                : [...(field.value as string[]), option]
                              : (field.value as string[]).filter(
                                  (v) => v !== option,
                                ),
                          )
                        }
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <PracticalText
                  label={label('fieldValue')}
                  multiline
                  value={String(field.value)}
                  onChange={(value) => change(i, value)}
                />
              )}
            </fieldset>
          ))}
          <Label htmlFor="pdf-form-font">{label('fontFile')}</Label>
          <Input
            id="pdf-form-font"
            type="file"
            accept=".ttf,.otf"
            onChange={(e) => {
              setFont(e.target.files?.[0] ?? null);
              setFontRevision((n) => n + 1);
            }}
          />
          <label className="flex items-center gap-2">
            <Checkbox
              checked={flatten === '1'}
              onCheckedChange={(checked) =>
                setFlatten(checked === true ? '1' : '0')
              }
            />
            {label('flatten')}
          </label>
          <PracticalText
            label={label('json')}
            multiline
            value={json}
            onChange={setJson}
          />
          <Button
            variant="outline"
            onClick={() => {
              try {
                setFields(importFormData(json, fields));
                setError(null);
              } catch (cause) {
                setError((cause as Error).message);
              }
            }}
          >
            {label('importJson')}
          </Button>
          <ExportText
            name="form-data.json"
            value={outputJson}
            type="application/json"
          />
        </>
      ) : (
        <>
          {!marks.length && <p>{label('noBookmarks')}</p>}
          {marks.map((mark, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-lg border p-3 md:grid-cols-4"
            >
              <PracticalText
                label={label('title')}
                value={mark.title}
                onChange={(title) =>
                  setMarks(marks.map((m, n) => (n === i ? { ...m, title } : m)))
                }
              />
              {mark.page === null ? (
                <div className="space-y-2">
                  <Label htmlFor={`bookmark-page-${i}`}>{label('page')}</Label>
                  <Input
                    id={`bookmark-page-${i}`}
                    type="number"
                    min={1}
                    max={data.pages}
                    placeholder={label('originalTarget')}
                    onChange={(e) => {
                      if (e.target.value)
                        setMarks(
                          marks.map((m, n) =>
                            n === i
                              ? { ...m, page: Number(e.target.value) }
                              : m,
                          ),
                        );
                    }}
                  />
                </div>
              ) : (
                <NumberField
                  label={label('page')}
                  value={mark.page}
                  min={1}
                  max={data.pages}
                  step={1}
                  onChange={(page) =>
                    setMarks(
                      marks.map((m, n) => (n === i ? { ...m, page } : m)),
                    )
                  }
                />
              )}
              <NumberField
                label={label('level')}
                value={mark.level}
                min={1}
                max={16}
                step={1}
                onChange={(level) =>
                  setMarks(marks.map((m, n) => (n === i ? { ...m, level } : m)))
                }
              />
              <Button
                className="self-end"
                variant="outline"
                onClick={() => setMarks(marks.filter((_, n) => n !== i))}
              >
                {label('remove')}
              </Button>
            </div>
          ))}
          <Button
            disabled={marks.length >= 500}
            variant="outline"
            onClick={() =>
              setMarks([...marks, { id: '', title: '', page: 1, level: 1 }])
            }
          >
            {label('add')}
          </Button>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={job.busy}
          onClick={() =>
            void job.run(async () => {
              if (mode === 'bookmarks') return writePdfBookmarks(bytes, marks);
              if (font && font.size > 20 * 1024 * 1024)
                throw new Error('fileLimit');
              return fillPdf(
                bytes,
                fields,
                flatten === '1',
                font ? new Uint8Array(await font.arrayBuffer()) : undefined,
              );
            })
          }
        >
          {label(job.busy ? 'working' : 'savePdf')}
        </Button>
        {job.result && (
          <Button
            variant="outline"
            onClick={() =>
              downloadBytes(job.result!, `${mode}.pdf`, 'application/pdf')
            }
          >
            {label('export')}
          </Button>
        )}
      </div>
      {(error || job.error) && (
        <p role="alert" className="text-destructive">
          {t('calculatorUtilities.error', {
            message: t(`calculatorUtilities.${error ?? job.error}`, {
              defaultValue: error ?? job.error ?? '',
            }),
          })}
        </p>
      )}
    </div>
  );
}
