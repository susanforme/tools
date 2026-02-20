import { HistoryPanel } from '@/components/history-panel';
import { useToolHistory } from '@/hooks/useToolHistory';
import { useToolPreference } from '@/hooks/useToolPreference';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
export const Route = createFileRoute('/json')({
  component: JsonPage,
});

const DEFAULT_JSON = `{
  "name": "Alice",
  "age": 30,
  "skills": ["TypeScript", "React"],
  "address": { "city": "Shanghai", "zip": "200000" }
}`;

type OnSuccessCallback = (input: string, output: string) => void;

function JsonPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState(DEFAULT_JSON);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const {
    pref: [preference, setPreference],
    ready,
  } = useToolPreference({
    indent: '2',
  });

  const { indent } = preference;

  const { add } = useToolHistory();
  if (!ready) {
    return null;
  }

  const parse = () => {
    try {
      return JSON.parse(input);
    } catch (e) {
      setError(t('json.parseError', { msg: (e as Error).message }));
      setOutput('');
      return null;
    }
  };

  const format = (callback: OnSuccessCallback) => {
    setError(null);
    const parsed = parse();
    if (parsed === null && input.trim() !== 'null') return;
    try {
      const indentValue = indent === 'tab' ? '\t' : Number(indent);
      const output = JSON.stringify(parsed, null, indentValue);
      setOutput(output);
      callback(input, output);
    } catch (e) {
      setError(t('json.formatError', { msg: (e as Error).message }));
    }
  };

  const minify = (callback: OnSuccessCallback) => {
    setError(null);
    const parsed = parse();
    if (parsed === null && input.trim() !== 'null') return;
    try {
      const output = JSON.stringify(parsed);
      setOutput(output);
      callback(input, output);
    } catch (e) {
      setError(t('json.minifyError', { msg: (e as Error).message }));
    }
  };

  const validate = () => {
    setError(null);
    try {
      JSON.parse(input);
      setOutput(t('json.valid'));
    } catch (e) {
      setError(t('json.validateError', { msg: (e as Error).message }));
      setOutput('');
    }
  };

  const wrappedFn = (fn: (callback: OnSuccessCallback) => void) => {
    return () => {
      fn((input, output) => {
        add({
          input,
          output,
          preference: preference,
        });
      });
    };
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('json.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('json.desc')}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('json.indent')}
          </span>
          <Select
            value={indent}
            onValueChange={(v) => {
              setPreference({ indent: v as any });
            }}
          >
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">{t('json.spaces', { n: 2 })}</SelectItem>
              <SelectItem value="4">{t('json.spaces', { n: 4 })}</SelectItem>
              <SelectItem value="tab">{t('json.tab')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <Button size="sm" onClick={wrappedFn(format)}>
          {t('json.format')}
        </Button>
        <Button size="sm" variant="secondary" onClick={wrappedFn(minify)}>
          {t('json.minify')}
        </Button>
        <Button size="sm" variant="outline" onClick={validate}>
          {t('json.validate')}
        </Button>
        <Button size="sm" variant="ghost" onClick={clear}>
          {t('json.clear')}
        </Button>
      </div>

      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        inputPlaceholder={'{ "key": "value" }'}
        error={error}
        language="json"
      />
      <HistoryPanel
        onRestore={(item) => {
          const { inputText, outputText, preference } = item;
          setInput(inputText || '');
          setOutput(outputText || '');
          setPreference(preference);
          //
        }}
      ></HistoryPanel>
    </div>
  );
}
