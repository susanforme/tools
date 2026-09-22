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
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  packingTotals,
  validPacking,
  type PackingItem,
  type PackingTrip,
} from '@/lib/organizer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export const Route = createFileRoute('/packing-list')({
  component: PackingListPage,
});
const INITIAL: PackingTrip[] = [];
const TEMPLATES: Record<string, Array<[string, string, number, number]>> = {
  business: [
    ['documents', 'essentials', 1, 100],
    ['laptop', 'electronics', 1, 1500],
    ['charger', 'electronics', 1, 250],
    ['clothes', 'clothing', 3, 300],
  ],
  travel: [
    ['documents', 'essentials', 1, 100],
    ['clothes', 'clothing', 5, 300],
    ['toiletries', 'essentials', 1, 400],
    ['charger', 'electronics', 1, 250],
  ],
  camping: [
    ['tent', 'camp', 1, 2200],
    ['sleepingBag', 'camp', 1, 1200],
    ['light', 'camp', 1, 180],
    ['water', 'food', 2, 1000],
  ],
};
function PackingListPage() {
  const { t } = useTranslation();
  const store = useOrganizerStore(
    'tools.packing-list.v1',
    INITIAL,
    validPacking,
  );
  const [selected, setSelected] = useState('');
  const trip = store.data.find((item) => item.id === selected) ?? store.data[0];
  const [template, setTemplate] = useQueryParam<string>(
    'template',
    StringParam,
    'travel',
  );
  const [name, setName] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [bag, setBag] = useState('');
  const update = (items: PackingItem[]) =>
    trip &&
    store.setData((previous) =>
      previous.map((item) => (item.id === trip.id ? { ...item, items } : item)),
    );
  const patch = (id: string, changes: Partial<PackingItem>) =>
    trip &&
    update(
      trip.items.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    );
  const totals = trip ? packingTotals(trip.items) : [];
  const create = () => {
    const id = crypto.randomUUID();
    const choice = TEMPLATES[template] ?? TEMPLATES.travel;
    const items = choice.map(([key, group, quantity, grams]) => ({
      id: crypto.randomUUID(),
      name: t(`packingList.${key}`),
      category: t(`packingList.${group}`),
      bag: t('packingList.mainBag'),
      quantity,
      grams,
      checked: false,
    }));
    if (
      store.setData([
        ...store.data,
        {
          id,
          name:
            name.trim() ||
            t(`packingList.${template in TEMPLATES ? template : 'travel'}`),
          items,
        },
      ])
    ) {
      setSelected(id);
      setName('');
    }
  };
  return (
    <OrganizerFrame title={t('packingList.title')} store={store}>
      <div className="grid items-end gap-3 md:grid-cols-3">
        <OrganizerInput
          label={t('packingList.tripName')}
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="space-y-2">
          <Label>{t('packingList.template')}</Label>
          <Select
            value={template in TEMPLATES ? template : 'travel'}
            onValueChange={setTemplate}
          >
            <SelectTrigger
              aria-label={t('packingList.template')}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(TEMPLATES).map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`packingList.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={store.data.length >= 30} onClick={create}>
          {t('organizer.create')}
        </Button>
      </div>
      {trip && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Select value={trip.id} onValueChange={setSelected}>
              <SelectTrigger
                aria-label={t('packingList.tripName')}
                className="w-64"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {store.data.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={store.data.length >= 30}
              onClick={() => {
                const id = crypto.randomUUID();
                if (
                  store.setData([
                    ...store.data,
                    {
                      ...trip,
                      id,
                      name: `${trip.name.slice(0, 100)} ${t('organizer.copy')}`,
                      items: trip.items.map((item) => ({
                        ...item,
                        id: crypto.randomUUID(),
                        checked: false,
                      })),
                    },
                  ])
                )
                  setSelected(id);
              }}
            >
              {t('packingList.reuse')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                update(trip.items.map((item) => ({ ...item, checked: false })))
              }
            >
              {t('packingList.uncheck')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                store.setData(store.data.filter((item) => item.id !== trip.id))
              }
            >
              {t('organizer.delete')}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {totals.map((total) => (
              <div key={total.bag} className="rounded-lg border p-4">
                <strong>{total.bag}</strong>
                <p>
                  {total.checked}/{total.count} {t('packingList.packed')} ·{' '}
                  {(total.grams / 1000).toFixed(2)} kg
                </p>
              </div>
            ))}
          </div>
          <form
            className="grid items-end gap-3 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!itemName.trim()) return;
              if (
                update([
                  ...trip.items,
                  {
                    id: crypto.randomUUID(),
                    name: itemName.trim(),
                    category: category.trim() || t('packingList.essentials'),
                    bag: bag.trim() || t('packingList.mainBag'),
                    quantity: 1,
                    grams: 0,
                    checked: false,
                  },
                ])
              )
                setItemName('');
            }}
          >
            <OrganizerInput
              label={t('organizer.name')}
              value={itemName}
              maxLength={120}
              onChange={(event) => setItemName(event.target.value)}
            />
            <OrganizerInput
              label={t('packingList.category')}
              value={category}
              maxLength={120}
              onChange={(event) => setCategory(event.target.value)}
            />
            <OrganizerInput
              label={t('packingList.bag')}
              value={bag}
              maxLength={120}
              onChange={(event) => setBag(event.target.value)}
            />
            <Button disabled={!itemName.trim() || trip.items.length >= 500}>
              {t('organizer.add')}
            </Button>
          </form>
          {[...new Set(trip.items.map((item) => item.category))].map(
            (group) => (
              <section key={group} className="space-y-3">
                <h2 className="font-semibold">{group}</h2>
                {trip.items
                  .filter((item) => item.category === group)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-7"
                    >
                      <Label className="flex h-9 gap-2">
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={(checked) =>
                            patch(item.id, { checked: checked === true })
                          }
                        />
                        {t('packingList.packed')}
                      </Label>
                      <OrganizerInput
                        label={t('organizer.name')}
                        value={item.name}
                        maxLength={120}
                        onChange={(event) =>
                          patch(item.id, { name: event.target.value })
                        }
                      />
                      <OrganizerInput
                        label={t('packingList.category')}
                        defaultValue={item.category}
                        onBlur={(event) =>
                          patch(item.id, { category: event.target.value })
                        }
                      />
                      <OrganizerInput
                        label={t('packingList.bag')}
                        value={item.bag}
                        onChange={(event) =>
                          patch(item.id, { bag: event.target.value })
                        }
                      />
                      <OrganizerInput
                        label={t('organizer.quantity')}
                        type="number"
                        min={1}
                        max={10000}
                        value={item.quantity}
                        onChange={(event) =>
                          patch(item.id, {
                            quantity: Number(event.target.value),
                          })
                        }
                      />
                      <OrganizerInput
                        label={t('packingList.grams')}
                        type="number"
                        min={0}
                        value={item.grams}
                        onChange={(event) =>
                          patch(item.id, { grams: Number(event.target.value) })
                        }
                      />
                      <Button
                        variant="ghost"
                        onClick={() =>
                          update(
                            trip.items.filter((entry) => entry.id !== item.id),
                          )
                        }
                      >
                        {t('organizer.delete')}
                      </Button>
                    </div>
                  ))}
              </section>
            ),
          )}
        </>
      )}
    </OrganizerFrame>
  );
}
