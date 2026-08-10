import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { convertHttpSnippet } from '@/lib/curl-converter';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoTextEditor } from '../components/monaco-editor';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

export const Route = createFileRoute('/curl-converter')({
  component: CurlConverterPage,
});

type Target = 'fetch' | 'axios' | 'curl';

const SAMPLE_CURL = `curl -X POST 'https://api.example.com/v1/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer token' \\
  --data-raw '{"name":"Breeze","active":true}'`;

function CurlConverterPage() {
  const { t } = useTranslation();
  const [target, setTarget] = useQueryParam<Target>(
    'target',
    StringParam,
    'fetch',
  );
  const [input, setInput] = useState(SAMPLE_CURL);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const convert = () => {
    setError(null);
    try {
      setOutput(convertHttpSnippet(input, target));
    } catch (cause) {
      setOutput('');
      setError(
        t('curlConverter.failed', { msg: (cause as Error).message }),
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('curlConverter.title')}</h1>
      </div>
      <Tabs
        value={target}
        onValueChange={(value) => setTarget(value as Target)}
      >
        <TabsList>
          <TabsTrigger value="fetch">{t('curlConverter.fetch')}</TabsTrigger>
          <TabsTrigger value="axios">{t('curlConverter.axios')}</TabsTrigger>
          <TabsTrigger value="curl">{t('curlConverter.curl')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={convert}>
          {t('curlConverter.convert')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setInput(SAMPLE_CURL);
            setOutput('');
            setError(null);
          }}
        >
          {t('curlConverter.sample')}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={t('curlConverter.input')}
          language="shell"
          height="420px"
          value={input}
          onChange={setInput}
        />
        <MonacoTextEditor
          readOnly
          label={t('curlConverter.output')}
          language="javascript"
          height="420px"
          value={output}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
