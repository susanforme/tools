import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  calculateOffer,
  SHOPPING_UNITS,
  type ShoppingDimension,
  type ShoppingOffer,
  type ShoppingUnit,
} from '@/lib/shopping-music-tools';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/unit-price')({
  component: UnitPricePage,
});
const PARAMS = {
  currency: StringParam,
  mass: StringParam,
  volume: StringParam,
};
const NUMERIC_FIELDS = [
  'price',
  'amount',
  'packs',
  'free',
  'coupon',
  'shipping',
] as const;
const DIMENSIONS: ShoppingDimension[] = ['mass', 'volume', 'count'];
function newOffer(id: number): ShoppingOffer {
  return {
    id,
    name: '',
    price: '',
    amount: '',
    packs: '1',
    free: '0',
    coupon: '0',
    shipping: '0',
    unit: 'g',
  };
}

function UnitPricePage() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    currency: string;
    mass: string;
    volume: string;
  }>(PARAMS);
  const currency = ['CNY', 'USD', 'EUR'].includes(query.currency ?? '')
    ? query.currency!
    : 'CNY';
  const mass: ShoppingUnit =
    query.mass === 'g' || query.mass === 'jin' ? query.mass : 'kg';
  const volume: ShoppingUnit = query.volume === 'ml' ? 'ml' : 'l';
  const displayUnits: Record<ShoppingDimension, ShoppingUnit> = {
    mass,
    volume,
    count: 'piece',
  };
  const [offers, setOffers] = useState<ShoppingOffer[]>([
    newOffer(1),
    newOffer(2),
  ]);
  const nextId = useRef(3);
  const results = offers.flatMap((offer, index) => {
    const result = calculateOffer(offer);
    return result ? [{ ...result, offer, index }] : [];
  });
  const money = (amount: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  const update = (id: number, patch: Partial<ShoppingOffer>) =>
    setOffers((previous) =>
      previous.map((offer) =>
        offer.id === id ? { ...offer, ...patch } : offer,
      ),
    );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('unitPrice.title')}</h1>
      <div className="flex flex-wrap gap-4">
        {(
          [
            ['currency', currency, ['CNY', 'USD', 'EUR']],
            ['massUnit', mass, ['kg', 'jin', 'g']],
            ['volumeUnit', volume, ['l', 'ml']],
          ] as const
        ).map(([key, value, options]) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`price-${key}`}>{t(`unitPrice.${key}`)}</Label>
            <Select
              value={value}
              onValueChange={(selected) =>
                setQuery({
                  [key === 'massUnit'
                    ? 'mass'
                    : key === 'volumeUnit'
                      ? 'volume'
                      : key]: selected,
                })
              }
            >
              <SelectTrigger id={`price-${key}`} className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {key === 'currency' ? option : t(`unitPrice.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {t('unitPrice.priceRule')}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((offer, index) => (
          <section
            key={offer.id}
            className="space-y-4 rounded-xl border p-4"
            aria-label={t('unitPrice.product', { number: index + 1 })}
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label={t('unitPrice.name')}
                value={offer.name}
                maxLength={100}
                placeholder={t('unitPrice.product', { number: index + 1 })}
                onChange={(event) =>
                  update(offer.id, { name: event.target.value })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('unitPrice.remove', { number: index + 1 })}
                disabled={offers.length === 1}
                onClick={() =>
                  setOffers((previous) =>
                    previous.filter((item) => item.id !== offer.id),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {NUMERIC_FIELDS.map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`offer-${offer.id}-${field}`}>
                    {t(`unitPrice.${field}`)}
                  </Label>
                  <Input
                    id={`offer-${offer.id}-${field}`}
                    type="number"
                    min={field === 'packs' ? 1 : 0}
                    step={
                      field === 'packs' ||
                      field === 'free' ||
                      (field === 'amount' && offer.unit === 'piece')
                        ? 1
                        : field === 'amount'
                          ? 'any'
                          : 0.01
                    }
                    value={offer[field]}
                    onChange={(event) =>
                      update(offer.id, { [field]: event.target.value })
                    }
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor={`offer-${offer.id}-unit`}>
                  {t('unitPrice.unit')}
                </Label>
                <Select
                  value={offer.unit}
                  onValueChange={(unit) =>
                    update(offer.id, { unit: unit as ShoppingUnit })
                  }
                >
                  <SelectTrigger
                    id={`offer-${offer.id}-unit`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SHOPPING_UNITS) as ShoppingUnit[]).map(
                      (unit) => (
                        <SelectItem key={unit} value={unit}>
                          {t(`unitPrice.${unit}`)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {offer.price !== '' &&
              offer.amount !== '' &&
              !calculateOffer(offer) && (
                <p role="alert" className="text-sm text-destructive">
                  {t('unitPrice.invalid')}
                </p>
              )}
          </section>
        ))}
      </div>
      <Button
        variant="outline"
        disabled={offers.length >= 20}
        onClick={() => {
          const offer = newOffer(nextId.current++);
          setOffers((previous) => [...previous, offer]);
        }}
      >
        <Plus className="h-4 w-4" />
        {t('unitPrice.add')}
      </Button>
      <section className="space-y-4" aria-label={t('unitPrice.results')}>
        {!results.length && (
          <p className="text-sm text-muted-foreground">
            {t('unitPrice.empty')}
          </p>
        )}
        {DIMENSIONS.map((dimension) => {
          const group = results
            .filter((result) => result.dimension === dimension)
            .sort((a, b) => a.unitPrice - b.unitPrice);
          if (!group.length) return null;
          const unit = displayUnits[dimension];
          const factor = SHOPPING_UNITS[unit].factor;
          const best = group[0].unitPrice;
          return (
            <div key={dimension} className="space-y-3">
              <h2 className="font-semibold">{t(`unitPrice.${dimension}`)}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {group.map(({ offer, index, total, quantity, unitPrice }) => (
                  <div
                    key={offer.id}
                    className="space-y-2 rounded-lg border p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h3 className="font-medium">
                        {offer.name ||
                          t('unitPrice.product', { number: index + 1 })}
                      </h3>
                      {unitPrice === best && (
                        <span className="text-sm text-primary">
                          {t('unitPrice.best')}
                        </span>
                      )}
                    </div>
                    <p className="text-xl font-semibold tabular-nums">
                      {money(unitPrice * factor)} / {t(`unitPrice.${unit}`)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('unitPrice.total')}: {money(total)} ·{' '}
                      {t('unitPrice.quantity')}:{' '}
                      {new Intl.NumberFormat(i18n.language, {
                        maximumFractionDigits: 4,
                      }).format(quantity / factor)}{' '}
                      {t(`unitPrice.${unit}`)}
                    </p>
                    {unitPrice > best && (
                      <p className="text-sm">
                        {t('unitPrice.difference', {
                          unit: t(`unitPrice.${unit}`),
                        })}
                        : {money((unitPrice - best) * factor)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
