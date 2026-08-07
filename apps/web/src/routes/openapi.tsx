import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  extractOpenApiEndpoints,
  extractOpenApiSchemas,
  openApiRequestExample,
  type OpenApiEndpoint,
} from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoTextEditor } from '../components/monaco-editor';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/openapi')({ component: OpenApiPage });

type Mode = 'endpoints' | 'schemas';

const SAMPLE = `openapi: 3.0.3
info:
  title: Sample API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /users/{id}:
    get:
      summary: Get user
      parameters:
        - in: path
          name: id
          required: true
          schema: { type: integer, example: 1 }
      responses:
        '200': { description: OK }
components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }`;

function OpenApiPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'endpoints');
  const [input, setInput] = useState(SAMPLE);
  const [document, setDocument] = useState<unknown>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endpoints = useMemo(
    () => extractOpenApiEndpoints(document),
    [document],
  );
  const selected =
    endpoints.find(({ id }) => id === selectedId) ?? endpoints[0];

  const parse = async () => {
    setError(null);
    try {
      const next: unknown = input.trim().startsWith('{')
        ? JSON.parse(input)
        : (await import('js-yaml')).load(input);
      const nextEndpoints = extractOpenApiEndpoints(next);
      setDocument(next);
      setSelectedId(nextEndpoints[0]?.id ?? '');
    } catch (cause) {
      setError(t('openapi.failed', { msg: (cause as Error).message }));
    }
  };

  const output =
    mode === 'schemas'
      ? JSON.stringify(extractOpenApiSchemas(document), null, 2)
      : selected
        ? openApiRequestExample(document, selected)
        : '';

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('openapi.title')}</h1>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="endpoints">{t('openapi.endpoints')}</TabsTrigger>
          <TabsTrigger value="schemas">{t('openapi.schemas')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <MonacoTextEditor
            label={t('panel.input')}
            language={input.trim().startsWith('{') ? 'json' : 'yaml'}
            height="520px"
            value={input}
            onChange={setInput}
          />
          <Button onClick={parse}>{t('openapi.parse')}</Button>
        </div>
        <div className="space-y-2">
          {mode === 'endpoints' && endpoints.length > 0 && (
            <Select value={selected?.id} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {endpoints.map((endpoint: OpenApiEndpoint) => (
                  <SelectItem key={endpoint.id} value={endpoint.id}>
                    {endpoint.id}
                    {endpoint.summary ? ` · ${endpoint.summary}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <MonacoTextEditor
            readOnly
            label={t('panel.output')}
            language={mode === 'schemas' ? 'json' : 'shell'}
            height="520px"
            value={output}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
