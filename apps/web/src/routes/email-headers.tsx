import { MonacoTextEditor } from '@/components/monaco-editor';
import { MimeEmailPanel } from '@/components/extra-tool-panels';
import { EmailPolicyPanel } from '@/components/protocol-tool-panels';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { parseEmailHeaders } from '@/lib/email-headers';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/email-headers')({
  component: EmailHeadersPage,
});

function EmailHeadersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<'headers' | 'mime' | 'policy'>(
    'tab',
    StringParam,
    'headers',
  );
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
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value as 'headers' | 'mime' | 'policy')
        }
      >
        <TabsList>
          <TabsTrigger value="headers">{t('emailHeaders.headers')}</TabsTrigger>
          <TabsTrigger value="mime">EML / MIME</TabsTrigger>
          <TabsTrigger value="policy">SPF / DMARC</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'mime' ? (
        <MimeEmailPanel />
      ) : tab === 'policy' ? (
        <EmailPolicyPanel />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
