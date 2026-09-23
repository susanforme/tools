import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  FIELD_TYPES,
  exportFormHtml,
  formAnswers,
  validateForm,
  visibleFields,
  type FormAnswers,
  type FormDesign,
  type FormField,
} from '@/lib/productivity-data';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { ChoiceField } from '@/components/calculator-ui';
import {
  MoveButtons,
  ProductivityError,
  saveProductivityText,
} from '@/components/productivity-ui';
import { PracticalText } from '@/components/practical-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export const Route = createFileRoute('/form-builder')({
  component: FormBuilder,
});
const INITIAL: FormDesign = { title: '', fields: [] };
function FormBuilder() {
  const { t, i18n } = useTranslation();
  const store = useOrganizerStore('form-builder-v1', INITIAL, validateForm);
  const [mode, setMode] = useQueryParam<string>('mode', StringParam, 'design');
  const [draft, setDraft] = useState<FormField | null>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [error, setError] = useState<string | null>(null);
  const design = store.data;
  const save = (next: FormDesign) => {
    if (!validateForm(next)) {
      setError('formLimit');
      return false;
    }
    if (store.setData(next)) {
      setError(null);
      return true;
    }
    return false;
  };
  const move = (from: number, to: number) => {
    const fields = [...design.fields];
    const [field] = fields.splice(from, 1);
    fields.splice(to, 0, field);
    save({ ...design, fields });
  };
  const draftIndex = draft
    ? design.fields.findIndex((f) => f.id === draft.id)
    : -1;
  const preceding = design.fields.slice(
    0,
    draftIndex < 0 ? undefined : draftIndex,
  );
  const exportAnswers = () => {
    try {
      const values = formAnswers(design, answers);
      saveProductivityText(
        JSON.stringify({ title: design.title, answers: values }, null, 2),
        'answers.json',
        'application/json',
      );
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <OrganizerFrame
      title={t('productivity.tools.form-builder.title')}
      store={store}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <OrganizerInput
          label={t('productivity.title')}
          value={design.title}
          maxLength={200}
          onChange={(e) => save({ ...design, title: e.target.value })}
        />
        <ChoiceField
          label={t('productivity.mode', {
            defaultValue: t('productivity.preview'),
          })}
          value={mode === 'preview' ? 'preview' : 'design'}
          options={['design', 'preview'].map((value) => ({
            value,
            label: t(`productivity.${value}`),
          }))}
          onChange={setMode}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {t('productivity.formLimit')}
      </p>
      {mode !== 'preview' ? (
        <>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={design.fields.length >= 50}
              onClick={() =>
                setDraft({
                  id: 'f_' + crypto.randomUUID(),
                  label: '',
                  type: 'text',
                  required: false,
                  options: [],
                  condition: '',
                  equals: '',
                })
              }
            >
              {t('productivity.add')} {t('productivity.field')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('productivity.reorder')}
            </span>
          </div>
          {draft && (
            <section className="space-y-4 rounded-lg border p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <OrganizerInput
                  label={t('productivity.name')}
                  value={draft.label}
                  maxLength={200}
                  onChange={(e) =>
                    setDraft({ ...draft, label: e.target.value })
                  }
                />
                <ChoiceField
                  label={t('productivity.fieldType')}
                  value={draft.type}
                  options={FIELD_TYPES.map((value) => ({
                    value,
                    label: t(`productivity.${value}`),
                  }))}
                  onChange={(value) =>
                    setDraft({ ...draft, type: value as FormField['type'] })
                  }
                />
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={draft.required}
                    onCheckedChange={(v) =>
                      setDraft({ ...draft, required: v === true })
                    }
                  />
                  {t('productivity.required')}
                </label>
              </div>
              {draft.type === 'dropdown' && (
                <PracticalText
                  multiline
                  label={t('productivity.options')}
                  value={draft.options.join('\n')}
                  maxLength={10000}
                  onChange={(v) =>
                    setDraft({ ...draft, options: v.split('\n') })
                  }
                />
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <ChoiceField
                  label={t('productivity.condition')}
                  value={draft.condition || '__always'}
                  options={[
                    { value: '__always', label: t('productivity.always') },
                    ...preceding.map((f) => ({ value: f.id, label: f.label })),
                  ]}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      condition: v === '__always' ? '' : v,
                      equals:
                        preceding.find((f) => f.id === v)?.type === 'checkbox'
                          ? 'true'
                          : '',
                    })
                  }
                />
                {draft.condition &&
                  (preceding.find((f) => f.id === draft.condition)?.type ===
                  'checkbox' ? (
                    <ChoiceField
                      label={t('productivity.equals')}
                      value={draft.equals || 'true'}
                      options={['true', 'false'].map((value) => ({
                        value,
                        label: t(`productivity.${value}`),
                      }))}
                      onChange={(equals) => setDraft({ ...draft, equals })}
                    />
                  ) : (
                    <OrganizerInput
                      label={t('productivity.equals')}
                      value={draft.equals}
                      maxLength={200}
                      onChange={(e) =>
                        setDraft({ ...draft, equals: e.target.value })
                      }
                    />
                  ))}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const next = {
                      ...design,
                      fields:
                        draftIndex < 0
                          ? [...design.fields, draft]
                          : design.fields.map((f) =>
                              f.id === draft.id ? draft : f,
                            ),
                    };
                    if (save(next)) setDraft(null);
                  }}
                >
                  {t('productivity.save')}
                </Button>
                <Button variant="outline" onClick={() => setDraft(null)}>
                  {t('productivity.cancel')}
                </Button>
              </div>
            </section>
          )}
          <div className="space-y-3">
            {design.fields.map((field, index) => (
              <article
                key={field.id}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData('text/plain', field.id)
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = design.fields.findIndex(
                    (f) => f.id === e.dataTransfer.getData('text/plain'),
                  );
                  if (from >= 0 && from !== index) move(from, index);
                }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0">
                  <h2 className="break-words font-medium">
                    {index + 1}. {field.label}
                    {field.required ? ' *' : ''}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t(`productivity.${field.type}`)}
                    {field.condition
                      ? ` · ${design.fields.find((f) => f.id === field.condition)?.label} = ${field.equals}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MoveButtons
                    index={index}
                    length={design.fields.length}
                    move={(to) => move(index, to)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft({ ...field })}
                  >
                    {t('productivity.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      save({
                        ...design,
                        fields: design.fields
                          .filter((f) => f.id !== field.id)
                          .map((f) =>
                            f.condition === field.id
                              ? { ...f, condition: '', equals: '' }
                              : f,
                          ),
                      });
                      if (draft?.id === field.id) setDraft(null);
                    }}
                  >
                    {t('productivity.remove')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <form
          className="space-y-5 rounded-lg border p-5"
          onSubmit={(e) => {
            e.preventDefault();
            exportAnswers();
          }}
        >
          <h2 className="text-xl font-semibold">{design.title}</h2>
          {visibleFields(design.fields, answers).map((field) => (
            <fieldset className="space-y-2" key={field.id}>
              <legend>
                {field.label}
                {field.required ? ' *' : ''}
              </legend>
              {field.type === 'textarea' ? (
                <Textarea
                  aria-label={field.label}
                  required={field.required}
                  maxLength={10000}
                  value={answers[field.id] ?? ''}
                  onChange={(e) =>
                    setAnswers({ ...answers, [field.id]: e.target.value })
                  }
                />
              ) : field.type === 'dropdown' ? (
                <ChoiceField
                  label={t('productivity.answer')}
                  value={
                    answers[field.id] &&
                    field.options.includes(answers[field.id])
                      ? String(field.options.indexOf(answers[field.id]))
                      : '__empty'
                  }
                  options={[
                    { value: '__empty', label: t('productivity.select') },
                    ...field.options.map((value, index) => ({
                      value: String(index),
                      label: value,
                    })),
                  ]}
                  onChange={(v) =>
                    setAnswers({
                      ...answers,
                      [field.id]:
                        v === '__empty' ? '' : field.options[Number(v)],
                    })
                  }
                />
              ) : field.type === 'checkbox' ? (
                <Checkbox
                  aria-label={field.label}
                  checked={answers[field.id] === 'true'}
                  onCheckedChange={(v) =>
                    setAnswers({ ...answers, [field.id]: String(v === true) })
                  }
                />
              ) : (
                <Input
                  aria-label={field.label}
                  type={field.type}
                  required={field.required}
                  maxLength={10000}
                  min={field.type === 'date' ? '1900-01-01' : undefined}
                  max={field.type === 'date' ? '2200-12-31' : undefined}
                  step={field.type === 'number' ? 'any' : undefined}
                  value={answers[field.id] ?? ''}
                  onChange={(e) =>
                    setAnswers({ ...answers, [field.id]: e.target.value })
                  }
                />
              )}
            </fieldset>
          ))}
          <Button type="submit">{t('productivity.submit')}</Button>
        </form>
      )}
      <Button
        variant="outline"
        disabled={!design.fields.length}
        onClick={() => {
          try {
            saveProductivityText(
              exportFormHtml(
                design,
                t('productivity.submit'),
                t('productivity.requiredError'),
                i18n.language,
              ),
              'form.html',
              'text/html',
            );
            setError(null);
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      >
        {t('productivity.exportHtml')}
      </Button>
      <ProductivityError error={error} />
    </OrganizerFrame>
  );
}
