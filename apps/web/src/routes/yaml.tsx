import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/yaml')({ component: YamlPage });

const SAMPLE_YAML = `name: my-app
version: 1.0.0
description: A sample application

server:
  host: localhost
  port: 3000
  debug: true

database:
  host: db.example.com
  port: 5432
  name: mydb
  credentials:
    user: admin
    password: secret

features:
  - authentication
  - authorization
  - logging`;

function YamlPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<'yaml' | 'toml'>(
    'tab',
    StringParam,
    'yaml',
  );
  const [input, setInput] = useState(SAMPLE_YAML);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const format = async () => {
    setError(null);
    try {
      const yaml = await import('js-yaml');
      const parsed = yaml.load(input);
      setOutput(yaml.dump(parsed, { indent: 2, lineWidth: -1, noRefs: true }));
    } catch (e) {
      setError(t('yaml.formatError', { msg: (e as Error).message }));
    }
  };

  const minify = async () => {
    setError(null);
    try {
      const yaml = await import('js-yaml');
      const parsed = yaml.load(input);
      // 用 JSON 序列化为紧凑形式
      setOutput(JSON.stringify(parsed));
    } catch (e) {
      setError(t('yaml.minifyError', { msg: (e as Error).message }));
    }
  };

  const toJson = async () => {
    setError(null);
    try {
      const yaml = await import('js-yaml');
      const parsed = yaml.load(input);
      setOutput(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setError(t('yaml.toJsonError', { msg: (e as Error).message }));
    }
  };

  const validate = async () => {
    setError(null);
    try {
      const yaml = await import('js-yaml');
      yaml.load(input);
      setOutput(t('yaml.valid'));
    } catch (e) {
      setError(t('yaml.validateError', { msg: (e as Error).message }));
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('yaml.title')}</h1>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'yaml' | 'toml')}
      >
        <TabsList>
          <TabsTrigger value="yaml">YAML</TabsTrigger>
          <TabsTrigger value="toml">TOML</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'toml' ? (
        <TomlPanel />
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={format}>
              {t('yaml.format')}
            </Button>
            <Button size="sm" variant="outline" onClick={validate}>
              {t('yaml.validate')}
            </Button>
            <Button size="sm" variant="outline" onClick={minify}>
              {t('yaml.minify')}
            </Button>
            <Button size="sm" variant="outline" onClick={toJson}>
              {t('yaml.toJson')}
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              {t('yaml.clear')}
            </Button>
          </div>
          <CodePanel
            input={input}
            output={output}
            onInputChange={setInput}
            error={error}
            language="yaml"
            outputLanguage="json"
          />
        </>
      )}
    </div>
  );
}

type TomlDirection = 'toml-json' | 'json-toml' | 'toml-yaml' | 'yaml-toml';

function TomlPanel() {
  const { t } = useTranslation();
  const [direction, setDirection] = useQueryParam<TomlDirection>(
    'direction',
    StringParam,
    'toml-json',
  );
  const [input, setInput] = useState(
    'title = "TOML Example"\n\n[owner]\nname = "Tom"',
  );
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const convert = async () => {
    setError(null);
    try {
      const toml = await import('smol-toml');
      const yaml = await import('js-yaml');
      const parsed = direction.startsWith('toml')
        ? toml.parse(input)
        : direction.startsWith('json')
          ? JSON.parse(input)
          : yaml.load(input);
      setOutput(
        direction.endsWith('toml')
          ? toml.stringify(parsed as Record<string, unknown>)
          : direction.endsWith('yaml')
            ? yaml.dump(parsed, { noRefs: true })
            : JSON.stringify(parsed, null, 2),
      );
    } catch (cause) {
      setOutput('');
      setError(t('yaml.tomlFailed', { msg: (cause as Error).message }));
    }
  };
  const inputLanguage = direction.startsWith('toml')
    ? 'ini'
    : direction.startsWith('json')
      ? 'json'
      : 'yaml';
  const outputLanguage = direction.endsWith('toml')
    ? 'ini'
    : direction.endsWith('json')
      ? 'json'
      : 'yaml';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['toml-json', 'json-toml', 'toml-yaml', 'yaml-toml'] as const).map(
          (item) => (
            <Button
              key={item}
              size="sm"
              variant={direction === item ? 'default' : 'outline'}
              onClick={() => setDirection(item)}
            >
              {item.replace('-', ' → ').toUpperCase()}
            </Button>
          ),
        )}
      </div>
      <Button onClick={() => void convert()}>{t('yaml.convert')}</Button>
      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        error={error}
        language={inputLanguage}
        outputLanguage={outputLanguage}
      />
    </div>
  );
}
