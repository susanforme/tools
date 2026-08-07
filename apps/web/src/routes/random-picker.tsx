import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/random-picker')({
  component: RandomPickerPage,
});

type Mode = 'group' | 'draw' | 'wheel';

function shuffled(values: string[]): string[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

function RandomPickerPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'group');
  const [input, setInput] = useState('');
  const [count, setCount] = useState(2);
  const [result, setResult] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    const values = input
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!values.length) {
      setError(t('randomPicker.empty'));
      return;
    }
    setError(null);
    const mixed = shuffled(values);
    if (mode === 'group') {
      const groups = Array.from(
        { length: Math.min(Math.max(1, count), values.length) },
        () => [] as string[],
      );
      mixed.forEach((value, index) =>
        groups[index % groups.length].push(value),
      );
      setResult(
        groups.map(
          (group, index) =>
            `${t('randomPicker.groupLabel', { index: index + 1 })}: ${group.join('、')}`,
        ),
      );
      return;
    }
    setResult(mixed.slice(0, mode === 'wheel' ? 1 : Math.max(1, count)));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('randomPicker.title')}</h1>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="group">{t('randomPicker.group')}</TabsTrigger>
          <TabsTrigger value="draw">{t('randomPicker.draw')}</TabsTrigger>
          <TabsTrigger value="wheel">{t('randomPicker.wheel')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 md:grid-cols-[1fr_15rem]">
        <div className="space-y-1.5">
          <Label>{t('randomPicker.items')}</Label>
          <Textarea
            className="min-h-64"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
        <div className="space-y-4">
          {mode !== 'wheel' && (
            <div className="space-y-1.5">
              <Label>
                {t(
                  mode === 'group'
                    ? 'randomPicker.groupCount'
                    : 'randomPicker.drawCount',
                )}
              </Label>
              <Input
                type="number"
                min={1}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </div>
          )}
          <Button className="w-full" onClick={run}>
            {t('randomPicker.run')}
          </Button>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
      </div>
      {!!result.length && (
        <div
          className={
            mode === 'wheel'
              ? 'mx-auto grid aspect-square w-full max-w-72 place-items-center rounded-full border-8 border-primary/30 bg-primary/5 p-8 text-center'
              : 'grid gap-3 sm:grid-cols-2'
          }
        >
          {result.map((value, index) => (
            <div
              key={`${index}-${value}`}
              className={
                mode === 'wheel'
                  ? 'text-2xl font-bold'
                  : 'rounded-xl border p-4 font-medium'
              }
            >
              {value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
