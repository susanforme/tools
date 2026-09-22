import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { downloadBlob } from '@/lib/download';
import {
  addDays,
  calendarFile,
  CURRENCIES,
  localDay,
  nextRenewal,
  subscriptionAnnual,
  validSubscriptions,
  type Subscription,
} from '@/lib/organizer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/subscription-tracker')({
  component: SubscriptionTrackerPage,
});
const INITIAL: Subscription[] = [];
function SubscriptionTrackerPage() {
  const { t, i18n } = useTranslation();
  const store = useOrganizerStore(
    'tools.subscription-tracker.v1',
    INITIAL,
    validSubscriptions,
  );
  const empty = (): Subscription => ({
    id: '',
    name: '',
    amount: 0,
    currency: 'CNY',
    interval: 1,
    period: 'month',
    renewal: localDay(),
    active: true,
  });
  const [draft, setDraft] = useState<Subscription>(empty);
  const [formError, setFormError] = useState(false);
  const [exportError, setExportError] = useState(false);
  const today = localDay();
  const totals = new Map<string, number>();
  store.data
    .filter((item) => item.active)
    .forEach((item) =>
      totals.set(
        item.currency,
        (totals.get(item.currency) ?? 0) + subscriptionAnnual(item),
      ),
    );
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
    }).format(amount);
  const rows = store.data
    .map((item) => ({ ...item, next: nextRenewal(item, today) }))
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) || a.next.localeCompare(b.next),
    );
  const patch = (value: Partial<Subscription>) =>
    setDraft((previous) => ({ ...previous, ...value }));
  const exportIcs = () => {
    try {
      downloadBlob(
        new Blob(
          [
            calendarFile(
              rows
                .filter((item) => item.active)
                .map((item) => ({
                  title: `${item.name} · ${money(item.amount, item.currency)}`,
                  start: new Date(`${item.next}T09:00:00`),
                  end: new Date(`${item.next}T09:30:00`),
                })),
              true,
            ),
          ],
          { type: 'text/calendar;charset=utf-8' },
        ),
        'subscription-renewals.ics',
      );
      setExportError(false);
    } catch {
      setExportError(true);
    }
  };
  return (
    <OrganizerFrame title={t('subscriptionTracker.title')} store={store}>
      <form
        className="grid items-end gap-3 rounded-lg border p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const item = {
            ...draft,
            id: draft.id || crypto.randomUUID(),
            name: draft.name.trim(),
          };
          if (!validSubscriptions([item])) {
            setFormError(true);
            return;
          }
          if (
            store.setData((previous) =>
              previous.some((current) => current.id === draft.id)
                ? previous.map((current) =>
                    current.id === draft.id ? item : current,
                  )
                : [...previous, item],
            )
          ) {
            setDraft(empty());
            setFormError(false);
          }
        }}
      >
        <OrganizerInput
          label={t('organizer.name')}
          value={draft.name}
          maxLength={120}
          onChange={(event) => patch({ name: event.target.value })}
        />
        <OrganizerInput
          label={t('subscriptionTracker.amount')}
          type="number"
          min={0}
          step="0.01"
          value={draft.amount}
          onChange={(event) => patch({ amount: Number(event.target.value) })}
        />
        <div className="space-y-2">
          <Label>{t('subscriptionTracker.currency')}</Label>
          <Select
            value={draft.currency}
            onValueChange={(currency) => patch({ currency })}
          >
            <SelectTrigger
              aria-label={t('subscriptionTracker.currency')}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <OrganizerInput
          label={t('subscriptionTracker.renewal')}
          type="date"
          value={draft.renewal}
          onChange={(event) => patch({ renewal: event.target.value })}
        />
        <OrganizerInput
          label={t('subscriptionTracker.interval')}
          type="number"
          min={1}
          max={120}
          value={draft.interval}
          onChange={(event) => patch({ interval: Number(event.target.value) })}
        />
        <div className="space-y-2">
          <Label>{t('subscriptionTracker.period')}</Label>
          <Select
            value={draft.period}
            onValueChange={(period) =>
              patch({ period: period as Subscription['period'] })
            }
          >
            <SelectTrigger
              aria-label={t('subscriptionTracker.period')}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['month', 'year', 'week'] as const).map((period) => (
                <SelectItem key={period} value={period}>
                  {t(`subscriptionTracker.${period}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={
            !draft.name.trim() || (!draft.id && store.data.length >= 200)
          }
        >
          {t(draft.id ? 'organizer.save' : 'organizer.add')}
        </Button>
        {draft.id && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft(empty())}
          >
            {t('organizer.cancel')}
          </Button>
        )}
      </form>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {t('organizer.invalid')}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {[...totals].map(([currency, annual]) => (
          <div key={currency} className="space-y-2 rounded-lg border p-4">
            <h2 className="font-semibold">{currency}</h2>
            <p>
              {t('subscriptionTracker.monthly')}: {money(annual / 12, currency)}
            </p>
            <p>
              {t('subscriptionTracker.annual')}: {money(annual, currency)}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!rows.some((item) => item.active)}
          onClick={exportIcs}
        >
          {t('subscriptionTracker.ics')}
        </Button>
        <p className="text-sm text-muted-foreground">
          {t('subscriptionTracker.monthEnd')}
        </p>
      </div>
      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {t('organizer.exportFailed')}
        </p>
      )}
      <div className="space-y-3">
        {rows.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
          >
            <div className="space-y-1">
              <h2 className="font-semibold">{item.name}</h2>
              <p>
                {money(item.amount, item.currency)} / {item.interval}{' '}
                {t(`subscriptionTracker.${item.period}`)}
              </p>
              <p className="text-sm">
                {t('subscriptionTracker.next')}: {item.next}{' '}
                {item.active && item.next <= addDays(today, 30) && (
                  <span className="text-primary">
                    {' '}
                    · {t('subscriptionTracker.soon')}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Label className="flex gap-2">
                <Checkbox
                  checked={item.active}
                  disabled={draft.id === item.id}
                  onCheckedChange={(checked) =>
                    store.setData((previous) =>
                      previous.map((current) =>
                        current.id === item.id
                          ? { ...current, active: checked === true }
                          : current,
                      ),
                    )
                  }
                />
                {t('subscriptionTracker.active')}
              </Label>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(item);
                  setFormError(false);
                }}
              >
                {t('organizer.edit')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    store.setData(
                      store.data.filter((current) => current.id !== item.id),
                    ) &&
                    draft.id === item.id
                  )
                    setDraft(empty());
                }}
              >
                {t('organizer.delete')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </OrganizerFrame>
  );
}
