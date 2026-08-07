import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { inferJsonSchema, jsonSchemaToTypeScript } from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import type { AnySchema } from 'ajv';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoTextEditor } from '../components/monaco-editor';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/json-schema')({
  component: JsonSchemaPage,
});

type Mode = 'infer' | 'validate' | 'types';

const SAMPLE_JSON = JSON.stringify(
  { id: 1, name: 'Breeze', active: true, tags: ['tools'] },
  null,
  2,
);

function JsonSchemaPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'infer');
  const [data, setData] = useState(SAMPLE_JSON);
  const [schema, setSchema] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    try {
      if (mode === 'infer') {
        const next = JSON.stringify(inferJsonSchema(JSON.parse(data)), null, 2);
        setSchema(next);
        setOutput(next);
        return;
      }
      const parsedSchema: unknown = JSON.parse(schema);
      if (mode === 'types') {
        setOutput(jsonSchemaToTypeScript(parsedSchema));
        return;
      }
      const Ajv2020 = (await import('ajv/dist/2020')).default;
      const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
        parsedSchema as AnySchema,
      );
      const valid = validate(JSON.parse(data));
      setOutput(
        valid
          ? t('jsonSchema.valid')
          : JSON.stringify(validate.errors ?? [], null, 2),
      );
    } catch (cause) {
      setError(t('jsonSchema.failed', { msg: (cause as Error).message }));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('jsonSchema.title')}</h1>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="infer">{t('jsonSchema.infer')}</TabsTrigger>
          <TabsTrigger value="validate">{t('jsonSchema.validate')}</TabsTrigger>
          <TabsTrigger value="types">{t('jsonSchema.types')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {mode !== 'types' && (
            <MonacoTextEditor
              label={t('jsonSchema.data')}
              language="json"
              height="300px"
              value={data}
              onChange={setData}
            />
          )}
          {mode !== 'infer' && (
            <MonacoTextEditor
              label={t('jsonSchema.schema')}
              language="json"
              height="300px"
              value={schema}
              onChange={setSchema}
            />
          )}
          <Button onClick={run}>{t('jsonSchema.run')}</Button>
        </div>
        <MonacoTextEditor
          readOnly
          label={t('jsonSchema.result')}
          language={mode === 'types' ? 'typescript' : 'json'}
          height="630px"
          value={output}
        />
      </div>
      {output === t('jsonSchema.valid') && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          {output}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
