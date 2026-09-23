import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import {
  CONTACT_FIELDS,
  exportContactsCsv,
  exportVcard,
  mergeContacts,
  parseContactsCsv,
  parseVcard,
  validateContacts,
  type Contact,
} from '@/lib/productivity-data';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { ChoiceField } from '@/components/calculator-ui';
import {
  ProductivityError,
  ProductivityImport,
  saveProductivityText,
} from '@/components/productivity-ui';
import {
  ExportText,
  PracticalText,
  useLatestJob,
} from '@/components/practical-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export const Route = createFileRoute('/contacts-tool')({
  component: ContactsTool,
});
const INITIAL: Contact[] = [];
function ContactsTool() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'contacts-tool-v1',
    INITIAL,
    validateContacts,
  );
  const [query, setQuery] = useQueryParams<{
    q: string;
    field: string;
    page: number;
  }>({ q: StringParam, field: StringParam, page: NumberParam });
  const [selected, setSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState('');
  const [draft, setDraft] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const csv = useLatestJob<string>(JSON.stringify(store.data));
  const field = CONTACT_FIELDS.includes(
    query.field as (typeof CONTACT_FIELDS)[number],
  )
    ? (query.field as (typeof CONTACT_FIELDS)[number])
    : 'company';
  const data = store.data;
  const filtered = data.filter((c) =>
    CONTACT_FIELDS.some((key) =>
      c[key].toLowerCase().includes((query.q ?? '').toLowerCase()),
    ),
  );
  const page = Math.max(
    0,
    Math.min(
      Math.floor(query.page ?? 0) || 0,
      Math.ceil(filtered.length / 50) - 1,
    ),
  );
  const shown = filtered.slice(page * 50, page * 50 + 50);
  const picked = selected.filter((id) => data.some((c) => c.id === id));
  const save = (next: Contact[]) => {
    if (!validateContacts(next)) {
      setError('invalid');
      return false;
    }
    if (store.setData(next)) {
      setError(null);
      return true;
    }
    return false;
  };
  return (
    <OrganizerFrame
      title={t('productivity.tools.contacts-tool.title')}
      store={store}
    >
      <p className="text-sm text-muted-foreground">{t('productivity.limit')}</p>
      <ProductivityImport<Contact[]>
        accept=".vcf,.vcard,.csv,text/vcard,text/csv"
        parse={(text, file) =>
          /\.(vcf|vcard)$/i.test(file.name)
            ? parseVcard(text)
            : parseContactsCsv(text)
        }
        onImport={(contacts) => {
          if (
            !store.setData((previous) => {
              const next = [...previous, ...contacts];
              if (!validateContacts(next)) throw new Error('invalid');
              return next;
            })
          )
            throw new Error('invalid');
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              name: '',
              email: '',
              phone: '',
              company: '',
              notes: '',
            })
          }
          disabled={data.length >= 2000}
        >
          {t('productivity.add')}
        </Button>
        <Button
          variant="outline"
          disabled={!data.length}
          onClick={() => {
            try {
              save(mergeContacts(data));
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
        >
          {t('productivity.mergeDuplicates')}
        </Button>
        <Button
          variant="outline"
          disabled={!data.length}
          onClick={() => {
            try {
              saveProductivityText(
                exportVcard(data),
                'contacts.vcf',
                'text/vcard',
              );
              setError(null);
            } catch (cause) {
              setError((cause as Error).message);
            }
          }}
        >
          {t('productivity.vcf')}
        </Button>
        <Button
          variant="outline"
          disabled={!data.length || csv.busy}
          onClick={() => void csv.run(() => exportContactsCsv(data))}
        >
          {t(csv.busy ? 'productivity.working' : 'productivity.csv')}
        </Button>
      </div>
      {csv.result !== null && (
        <ExportText
          value={csv.result}
          name="contacts.csv"
          type="text/csv;charset=utf-8"
        />
      )}
      <ProductivityError error={csv.error} />
      <p className="text-sm text-muted-foreground">
        {t('productivity.duplicateRule')}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('productivity.unsupportedVcard')} {t('productivity.csvColumns')}
      </p>
      {draft && (
        <section className="space-y-3 rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            {CONTACT_FIELDS.map((key) => (
              <PracticalText
                key={key}
                multiline={['email', 'phone', 'notes'].includes(key)}
                label={t(
                  `productivity.${key === 'name' ? 'contactName' : key}`,
                )}
                value={draft[key]}
                maxLength={10000}
                onChange={(value) => setDraft({ ...draft, [key]: value })}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (!CONTACT_FIELDS.some((key) => draft[key].trim())) {
                  setError('invalid');
                  return;
                }
                if (
                  save(
                    data.some((c) => c.id === draft.id)
                      ? data.map((c) => (c.id === draft.id ? draft : c))
                      : [...data, draft],
                  )
                )
                  setDraft(null);
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
      <OrganizerInput
        label={t('productivity.search')}
        value={query.q ?? ''}
        maxLength={200}
        onChange={(e) => setQuery({ q: e.target.value, page: 0 })}
      />
      <section className="space-y-3 rounded-lg border p-4">
        <p>{t('productivity.selected', { count: picked.length })}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <ChoiceField
            label={t('productivity.field')}
            value={field}
            options={CONTACT_FIELDS.map((value) => ({
              value,
              label: t(
                `productivity.${value === 'name' ? 'contactName' : value}`,
              ),
            }))}
            onChange={(field) => setQuery({ field })}
          />
          <OrganizerInput
            label={t('productivity.fieldValue')}
            value={batch}
            maxLength={10000}
            onChange={(e) => setBatch(e.target.value)}
          />
          <Button
            className="self-end"
            disabled={!picked.length}
            onClick={() =>
              save(
                data.map((c) =>
                  picked.includes(c.id) ? { ...c, [field]: batch } : c,
                ),
              )
            }
          >
            {t('productivity.apply')}
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!picked.length}
          onClick={() => {
            if (save(data.filter((c) => !picked.includes(c.id))))
              setSelected([]);
          }}
        >
          {t('productivity.remove')}
        </Button>
      </section>
      <label className="flex items-center gap-2">
        <Checkbox
          checked={
            shown.length > 0 && shown.every((c) => selected.includes(c.id))
          }
          onCheckedChange={(checked) =>
            setSelected(
              checked === true
                ? [...new Set([...selected, ...shown.map((c) => c.id)])]
                : selected.filter((id) => !shown.some((c) => c.id === id)),
            )
          }
        />
        {t('productivity.all')} ({shown.length})
      </label>
      <div className="space-y-3">
        {shown.map((contact) => (
          <article
            key={contact.id}
            className="flex items-start gap-3 rounded-lg border p-4"
          >
            <Checkbox
              aria-label={`${t('productivity.select')} ${contact.name}`}
              checked={selected.includes(contact.id)}
              onCheckedChange={(v) =>
                setSelected(
                  v === true
                    ? [...selected, contact.id]
                    : selected.filter((id) => id !== contact.id),
                )
              }
            />
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="break-words font-semibold">
                {contact.name || contact.email || contact.phone}
              </h2>
              {CONTACT_FIELDS.filter(
                (key) => key !== 'name' && contact[key],
              ).map((key) => (
                <p key={key} className="break-all whitespace-pre-wrap text-sm">
                  <span className="text-muted-foreground">
                    {t(`productivity.${key}`)}:{' '}
                  </span>
                  {contact[key]}
                </p>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft({ ...contact })}
            >
              {t('productivity.edit')}
            </Button>
          </article>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => setQuery({ page: page - 1 })}
        >
          ←
        </Button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(filtered.length / 50))} (
          {filtered.length})
        </span>
        <Button
          variant="outline"
          disabled={(page + 1) * 50 >= filtered.length}
          onClick={() => setQuery({ page: page + 1 })}
        >
          →
        </Button>
      </div>
      <ProductivityError error={error} />
    </OrganizerFrame>
  );
}
