import { MonacoTextEditor } from '@/components/monaco-editor';
import { Button } from '@/components/ui/button';
import { parseEmailHeaders } from '@/lib/email-headers';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/email-headers')({
  component: EmailHeadersPage,
});

function EmailHeadersPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  function run() {
    try {
      setOutput(JSON.stringify(parseEmailHeaders(input), null, 2));
      setError(null);
    } catch (cause) {
      setError(t('emailHeaders.failed', { msg: (cause as Error).message }));
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('emailHeaders.title')}</h1>
      {error && <div className="text-sm text-destructive">{error}</div>}
      <Button onClick={run}>{t('emailHeaders.parse')}</Button>
      <div className="grid gap-4 lg:grid-cols-2">
        <MonacoTextEditor
          label={t('emailHeaders.input')}
          height="620px"
          value={input}
          onChange={setInput}
        />
        <MonacoTextEditor
          readOnly
          label={t('emailHeaders.result')}
          language="json"
          height="620px"
          value={output}
        />
      </div>
    </div>
  );
}
