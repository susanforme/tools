import { LifeWorkspace } from '@/components/life-workspace-ui';
import { AssetWarrantyPanel } from '@/components/home-assets-workspace';
import {
  OrganizerFrame,
  OrganizerInput,
  useOrganizerStore,
} from '@/components/organizer-store';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import {
  addDays,
  csvFile,
  finite,
  localDay,
  validInventory,
  type InventoryItem,
} from '@/lib/organizer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/home-inventory')({
  component: ExpandedPage,
});
const INITIAL: InventoryItem[] = [];
const EMPTY: InventoryItem = {
  id: '',
  name: '',
  quantity: 1,
  location: '',
  packaging: '',
  expiry: '',
  minimum: 1,
};
function HomeInventoryPage() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'tools.home-inventory.v1',
    INITIAL,
    validInventory,
  );
  const [tab, setTab] = useQueryParam<string>('tab', StringParam, 'stock');
  const [draft, setDraft] = useState(EMPTY);
  const [amount, setAmount] = useState(1);
  const [formError, setFormError] = useState(false);
  const today = localDay();
  const shopping = store.data.filter((item) => item.quantity <= item.minimum);
  const rows = (tab === 'shopping' ? shopping : store.data)
    .slice()
    .sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
  const patch = (changes: Partial<InventoryItem>) =>
    setDraft((previous) => ({ ...previous, ...changes }));
  const validAmount = finite(amount, 0.001, 100000);
  const exportShopping = () =>
    downloadBlob(
      new Blob(
        [
          csvFile([
            [
              t('organizer.name'),
              t('homeInventory.location'),
              t('homeInventory.buy'),
            ],
            ...shopping.map((item) => [
              item.name,
              item.location,
              Math.max(1, item.minimum - item.quantity),
            ]),
          ]),
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
      'shopping-list.csv',
    );
  return (
    <OrganizerFrame title={t('homeInventory.title')} store={store}>
      <form
        className="grid items-end gap-3 rounded-lg border p-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const item = {
            ...draft,
            id: draft.id || crypto.randomUUID(),
            name: draft.name.trim(),
            location: draft.location.trim(),
          };
          if (!validInventory([item])) {
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
            setDraft(EMPTY);
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
          label={t('homeInventory.location')}
          value={draft.location}
          maxLength={120}
          onChange={(event) => patch({ location: event.target.value })}
        />
        <OrganizerInput
          label={t('homeInventory.packaging')}
          value={draft.packaging}
          maxLength={120}
          onChange={(event) => patch({ packaging: event.target.value })}
        />
        <OrganizerInput
          label={t('homeInventory.expiry')}
          type="date"
          value={draft.expiry}
          onChange={(event) => patch({ expiry: event.target.value })}
        />
        <OrganizerInput
          label={t('organizer.quantity')}
          type="number"
          min={0}
          step="any"
          value={draft.quantity}
          onChange={(event) => patch({ quantity: Number(event.target.value) })}
        />
        <OrganizerInput
          label={t('homeInventory.minimum')}
          type="number"
          min={0}
          step="any"
          value={draft.minimum}
          onChange={(event) => patch({ minimum: Number(event.target.value) })}
        />
        <Button
          disabled={
            !draft.name.trim() ||
            !draft.location.trim() ||
            (!draft.id && store.data.length >= 500)
          }
        >
          {t(draft.id ? 'organizer.save' : 'organizer.add')}
        </Button>
        {draft.id && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft(EMPTY)}
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
      <Tabs
        value={tab === 'shopping' ? 'shopping' : 'stock'}
        onValueChange={setTab}
      >
        <TabsList>
          <TabsTrigger value="stock">{t('homeInventory.stock')}</TabsTrigger>
          <TabsTrigger value="shopping">
            {t('homeInventory.shopping')} ({shopping.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-end gap-3">
        <OrganizerInput
          label={t('homeInventory.adjustment')}
          className="w-40"
          type="number"
          min={0.001}
          max={100000}
          step="any"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <Button
          variant="outline"
          disabled={!shopping.length}
          onClick={exportShopping}
        >
          {t('homeInventory.exportShopping')}
        </Button>
      </div>
      <div className="space-y-3">
        {rows.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
          >
            <div className="space-y-1">
              <h2 className="font-semibold">
                {item.name} · {item.quantity}
              </h2>
              <p className="text-sm text-muted-foreground">
                {item.location} {item.packaging && `· ${item.packaging}`}
              </p>
              {item.expiry && (
                <p
                  className={`text-sm ${item.expiry < today ? 'text-destructive' : item.expiry <= addDays(today, 30) ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {t('homeInventory.expiry')}: {item.expiry} ·{' '}
                  {t(
                    item.expiry < today
                      ? 'homeInventory.expired'
                      : item.expiry <= addDays(today, 30)
                        ? 'homeInventory.soon'
                        : 'homeInventory.valid',
                  )}
                </p>
              )}
              {tab === 'shopping' && (
                <p className="text-sm">
                  {t('homeInventory.buy')}:{' '}
                  {Math.max(1, item.minimum - item.quantity)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={
                  !validAmount || item.quantity < amount || draft.id === item.id
                }
                onClick={() =>
                  store.setData((previous) =>
                    previous.map((current) =>
                      current.id === item.id
                        ? {
                            ...current,
                            quantity:
                              Math.round((current.quantity - amount) * 1e6) /
                              1e6,
                          }
                        : current,
                    ),
                  )
                }
              >
                {t('homeInventory.consume')}
              </Button>
              <Button
                variant="outline"
                disabled={
                  !validAmount ||
                  item.quantity + amount > 100000 ||
                  draft.id === item.id
                }
                onClick={() =>
                  store.setData((previous) =>
                    previous.map((current) =>
                      current.id === item.id
                        ? {
                            ...current,
                            quantity:
                              Math.round((current.quantity + amount) * 1e6) /
                              1e6,
                          }
                        : current,
                    ),
                  )
                }
              >
                {t('homeInventory.restock')}
              </Button>
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
                    setDraft(EMPTY);
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

function ExpandedPage() {
  return (
    <LifeWorkspace
      label="lifeWorkspace.assets.title"
      panel={<AssetWarrantyPanel />}
    >
      <HomeInventoryPage />
    </LifeWorkspace>
  );
}
