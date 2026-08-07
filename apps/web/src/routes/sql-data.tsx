import { generateSqlInserts, parseCreateTable } from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoTextEditor } from '../components/monaco-editor';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export const Route = createFileRoute('/sql-data')({ component: SqlDataPage });

const SAMPLE = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  active BOOLEAN,
  created_at DATETIME
);`;

function SqlDataPage() {
  const { t } = useTranslation();
  const [sql, setSql] = useState(SAMPLE);
  const [count, setCount] = useState(10);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    try {
      const { table, columns } = parseCreateTable(sql);
      const { faker } = await import('@faker-js/faker');
      const rows = Array.from(
        { length: Math.min(500, Math.max(1, count)) },
        (_, index) =>
          Object.fromEntries(
            columns.map(({ name, type }) => {
              const lower = name.toLowerCase();
              const value =
                lower === 'id' || lower.endsWith('_id')
                  ? index + 1
                  : lower.includes('email')
                    ? faker.internet.email()
                    : lower.includes('name')
                      ? faker.person.fullName()
                      : lower.includes('phone')
                        ? faker.phone.number()
                        : lower.includes('date') || lower.includes('time')
                          ? faker.date.recent().toISOString()
                          : /INT|DECIMAL|NUMERIC|REAL|FLOAT|DOUBLE/.test(type)
                            ? faker.number.int({ min: 1, max: 1000 })
                            : /BOOL/.test(type)
                              ? faker.datatype.boolean()
                              : faker.lorem.word();
              return [name, value];
            }),
          ),
      );
      setOutput(generateSqlInserts(table, columns, rows));
    } catch (cause) {
      setError(t('sqlData.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('sqlData.title')}</h1>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={500}
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          className="w-32"
        />
        <Button onClick={generate}>{t('sqlData.generate')}</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={t('panel.input')}
          language="sql"
          height="520px"
          value={sql}
          onChange={setSql}
        />
        <MonacoTextEditor
          readOnly
          label={t('panel.output')}
          language="sql"
          height="520px"
          value={output}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
