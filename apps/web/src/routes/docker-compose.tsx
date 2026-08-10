import { CodePanel } from '@/components/code-panel';
import { NginxMatcherPanel } from '@/components/modern-web-tool-panels';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { inspectCompose, type ComposeIssue } from '@/lib/advanced-tools';
import { dockerRunToCompose } from '@/lib/developer-tools';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/docker-compose')({
  component: DockerComposePage,
});
const RUN_SAMPLE =
  'docker run --name web --restart unless-stopped -p 8080:80 -e NODE_ENV=production -v ./data:/data nginx:alpine';
const COMPOSE_SAMPLE = `services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n    environment:\n      API_URL: \${API_URL}`;

function DockerComposePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<'convert' | 'validate' | 'nginx'>(
    'tab',
    StringParam,
    'convert',
  );
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('dockerCompose.title')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value as 'convert' | 'validate' | 'nginx')
        }
      >
        <TabsList>
          <TabsTrigger value="convert">
            {t('dockerCompose.tabConvert')}
          </TabsTrigger>
          <TabsTrigger value="validate">
            {t('dockerCompose.tabValidate')}
          </TabsTrigger>
          <TabsTrigger value="nginx">Nginx Location</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'convert' ? (
        <ConvertPanel />
      ) : tab === 'validate' ? (
        <ValidatePanel />
      ) : (
        <NginxMatcherPanel />
      )}
    </div>
  );
}

function ConvertPanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(RUN_SAMPLE);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const convert = () => {
    setError(null);
    try {
      setOutput(dockerRunToCompose(input));
    } catch (cause) {
      setOutput('');
      setError(t('dockerCompose.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={convert}>{t('dockerCompose.convert')}</Button>
        <Button
          variant="outline"
          onClick={() => {
            setInput('');
            setOutput('');
            setError(null);
          }}
        >
          {t('dockerCompose.clear')}
        </Button>
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        error={error}
        language="shell"
        outputLanguage="yaml"
      />
    </div>
  );
}

function ValidatePanel() {
  const { t } = useTranslation();
  const [input, setInput] = useState(COMPOSE_SAMPLE);
  const [env, setEnv] = useState('API_URL=https://example.com');
  const [issues, setIssues] = useState<ComposeIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const validate = async () => {
    setError(null);
    try {
      const yaml = await import('js-yaml');
      setIssues(inspectCompose(yaml.load(input), input, env));
    } catch (cause) {
      setIssues(null);
      setError(t('dockerCompose.failed', { msg: (cause as Error).message }));
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-96 font-mono text-xs"
        />
        <Textarea
          value={env}
          onChange={(event) => setEnv(event.target.value)}
          className="min-h-32 font-mono text-xs"
          placeholder=".env"
        />
      </div>
      <Button onClick={() => void validate()}>
        {t('dockerCompose.validate')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {issues &&
        (issues.length ? (
          <div className="space-y-2">
            {issues.map((issue, index) => (
              <div
                key={`${issue.code}-${index}`}
                className={`rounded-md border px-3 py-2 text-sm ${issue.level === 'error' ? 'border-destructive/30 text-destructive' : ''}`}
              >
                <code>{issue.code}</code>
                {issue.detail ? ` · ${issue.detail}` : ''}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-emerald-600">{t('dockerCompose.valid')}</p>
        ))}
    </div>
  );
}
