import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  convertTemperature,
  isValidTemperature,
  type TemperatureUnit,
} from '@/lib/life-calculators';
import { createFileRoute } from '@tanstack/react-router';
import { Thermometer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/temperature')({
  component: TemperaturePage,
});

const UNITS = [
  ['celsius', '°C'],
  ['fahrenheit', '°F'],
  ['kelvin', 'K'],
] as const;

function TemperaturePage() {
  const { t } = useTranslation();
  const [unitQuery, setUnit] = useQueryParam<TemperatureUnit>(
    'unit',
    StringParam,
    'celsius',
  );
  const unit = UNITS.some(([value]) => value === unitQuery)
    ? unitQuery
    : 'celsius';
  const [input, setInput] = useState('0');
  const value = Number(input);
  const valid = Number.isFinite(value) && isValidTemperature(value, unit);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Thermometer className="h-6 w-6 text-orange-500" />
          {t('temperature.title')}
        </h1>
      </div>

      <Card>
        <CardContent className="grid gap-4 py-6 sm:grid-cols-[1fr_180px]">
          <Input
            type="number"
            step="any"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <Select
            value={unit}
            onValueChange={(value) => setUnit(value as TemperatureUnit)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map(([value, symbol]) => (
                <SelectItem key={value} value={value}>
                  {t(`temperature.units.${value}`)} ({symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!valid && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('temperature.invalid')}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {UNITS.map(([target, symbol]) => (
          <Card key={target}>
            <CardContent className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t(`temperature.units.${target}`)}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {valid
                  ? convertTemperature(value, unit, target).toFixed(2)
                  : '—'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{symbol}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
