import { Button } from '@/components/ui/button';
import { KubernetesQuantityPanel } from '@/components/tool-expansion-panels';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParams } from '@/hooks/useQueryParams';
import {
  convertUnit,
  DEFAULT_UNITS,
  UNIT_CATEGORIES,
  type UnitCategory,
} from '@/lib/unit-converter';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeftRight, Ruler } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/unit-converter')({
  component: UnitConverterPage,
});

const CATEGORIES = [
  'length',
  'area',
  'mass',
  'volume',
  'speed',
  'data',
  'kubernetes',
] as const;

type PageCategory = (typeof CATEGORIES)[number];

function isCategory(value: string | undefined): value is PageCategory {
  return CATEGORIES.some((category) => category === value);
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const absolute = Math.abs(value);
  if (absolute >= 1e12 || absolute < 1e-6) return value.toExponential(8);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 10,
    useGrouping: false,
  }).format(value);
}

function UnitConverterPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    category: string;
    from: string;
    to: string;
  }>({
    category: StringParam,
    from: StringParam,
    to: StringParam,
  });
  const [input, setInput] = useState('1');
  const category = isCategory(query.category) ? query.category : 'length';
  const unitCategory: UnitCategory =
    category === 'kubernetes' ? 'length' : category;
  const units = UNIT_CATEGORIES[unitCategory];
  const defaults = DEFAULT_UNITS[unitCategory];
  const from = units.some((unit) => unit.id === query.from)
    ? query.from!
    : defaults[0];
  const to = units.some((unit) => unit.id === query.to)
    ? query.to!
    : defaults[1];
  const value = Number(input);
  const result = Number.isFinite(value)
    ? convertUnit(value, unitCategory, from, to)
    : Number.NaN;

  const changeCategory = (value: string) => {
    if (!isCategory(value)) return;
    if (value === 'kubernetes') {
      setQuery({ category: value });
      return;
    }
    const [nextFrom, nextTo] = DEFAULT_UNITS[value];
    setQuery({ category: value, from: nextFrom, to: nextTo });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Ruler className="h-6 w-6 text-teal-500" />
          {t('unitConverter.title')}
        </h1>
      </div>

      <Tabs value={category} onValueChange={changeCategory}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
          {CATEGORIES.map((item) => (
            <TabsTrigger key={item} value={item}>
              {t(`unitConverter.categories.${item}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {category === 'kubernetes' ? (
        <KubernetesQuantityPanel />
      ) : (
        <>
          <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
            <UnitCard
              label={t('unitConverter.from')}
              value={input}
              unit={from}
              units={units}
              onValueChange={setInput}
              onUnitChange={(next) => setQuery({ from: next })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="self-center justify-self-center"
              onClick={() => setQuery({ from: to, to: from })}
              aria-label={t('unitConverter.swap')}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <UnitCard
              label={t('unitConverter.to')}
              value={formatValue(result)}
              unit={to}
              units={units}
              onUnitChange={(next) => setQuery({ to: next })}
              readOnly
            />
          </div>

          {category === 'data' && (
            <p className="text-xs text-muted-foreground">
              {t('unitConverter.dataHint')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function UnitCard({
  label,
  value,
  unit,
  units,
  onValueChange,
  onUnitChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  unit: string;
  units: readonly { id: string; symbol: string }[];
  onValueChange?: (value: string) => void;
  onUnitChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Input
          type={readOnly ? 'text' : 'number'}
          step="any"
          value={value}
          readOnly={readOnly}
          onChange={(event) => onValueChange?.(event.target.value)}
          className="h-12 font-mono text-xl tabular-nums"
        />
        <Select value={unit} onValueChange={onUnitChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
