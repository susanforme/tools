import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoTextEditor } from '../components/monaco-editor';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export const Route = createFileRoute('/mock-data')({ component: MockDataPage });

function MockDataPage() {
  const { t } = useTranslation();
  const [count, setCount] = useState(10);
  const [seed, setSeed] = useState(42);
  const [locale, setLocale] = useQueryParam<'zh' | 'en'>(
    'locale',
    StringParam,
    'zh',
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    try {
      const { fakerEN, fakerZH_CN } = await import('@faker-js/faker');
      const faker = locale === 'zh' ? fakerZH_CN : fakerEN;
      faker.seed(seed);
      const rows = Array.from(
        { length: Math.min(1000, Math.max(1, count)) },
        () => ({
          id: faker.string.uuid(),
          name: faker.person.fullName(),
          address: `${faker.location.city()} ${faker.location.streetAddress()}`,
          phone: faker.phone.number(),
          date: faker.date.recent().toISOString(),
        }),
      );
      setOutput(JSON.stringify(rows, null, 2));
    } catch (cause) {
      setError(t('mockData.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('mockData.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-[160px_160px_180px_auto]">
        <Input
          type="number"
          min={1}
          max={1000}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
        />
        <Input
          type="number"
          value={seed}
          onChange={(event) => setSeed(Number(event.target.value))}
        />
        <Select
          value={locale}
          onValueChange={(value) => setLocale(value as 'zh' | 'en')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">{t('mockData.zh')}</SelectItem>
            <SelectItem value="en">{t('mockData.en')}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={generate}>{t('mockData.generate')}</Button>
      </div>
      <MonacoTextEditor
        readOnly
        label={t('panel.output')}
        language="json"
        height="540px"
        value={output}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
