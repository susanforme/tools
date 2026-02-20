import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/js')({ component: JsPage });

type TabType = 'format' | 'minify' | 'obfuscate';

function useTool(initialInput = '') {
  const [input, setInput] = useState(initialInput);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };
  return {
    input,
    setInput,
    output,
    setOutput,
    error,
    setError,
    loading,
    setLoading,
    clear,
  };
}

const SAMPLE_JS = `function greet(name) {
  const message = "Hello, " + name + "!";
  console.log(message);
  return message;
}

const users = ["Alice", "Bob", "Charlie"];
users.forEach(user => greet(user));`;

function JsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'format');
  const fmt = useTool(SAMPLE_JS);
  const min = useTool(SAMPLE_JS);
  const obf = useTool(SAMPLE_JS);

  const formatJs = async () => {
    fmt.setError(null);
    fmt.setLoading(true);
    try {
      const prettier = await import('prettier/standalone');
      const parserBabel = await import('prettier/plugins/babel');
      const parserEstree = await import('prettier/plugins/estree');
      const result = await prettier.format(fmt.input, {
        parser: 'babel',
        plugins: [parserBabel, parserEstree],
        printWidth: 80,
        tabWidth: 2,
        semi: true,
        singleQuote: true,
      });
      fmt.setOutput(result);
    } catch (e) {
      fmt.setError(t('js.formatError', { msg: (e as Error).message }));
    } finally {
      fmt.setLoading(false);
    }
  };

  const minifyJs = async () => {
    min.setError(null);
    min.setLoading(true);
    try {
      const terser = await import('terser');
      const result = await terser.minify(min.input, {
        compress: true,
        mangle: false,
      });
      min.setOutput(result.code ?? '');
    } catch (e) {
      min.setError(t('js.minifyError', { msg: (e as Error).message }));
    } finally {
      min.setLoading(false);
    }
  };

  const obfuscateJs = async () => {
    obf.setError(null);
    obf.setLoading(true);
    try {
      const terser = await import('terser');
      const result = await terser.minify(obf.input, {
        compress: {
          dead_code: true,
          drop_debugger: true,
          conditionals: true,
          evaluate: true,
          booleans: true,
          loops: true,
          unused: true,
          hoist_funs: true,
          keep_fargs: false,
          hoist_vars: true,
          if_return: true,
        },
        mangle: {
          toplevel: true,
          eval: true,
          properties: false,
        },
        output: {
          beautify: false,
        },
      });
      obf.setOutput(result.code ?? '');
    } catch (e) {
      obf.setError(t('js.obfuscateError', { msg: (e as Error).message }));
    } finally {
      obf.setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('js.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('js.desc')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="format">{t('js.tabFormat')}</TabsTrigger>
          <TabsTrigger value="minify">{t('js.tabMinify')}</TabsTrigger>
          <TabsTrigger value="obfuscate">{t('js.tabObfuscate')}</TabsTrigger>
        </TabsList>

        <TabsContent value="format" className="space-y-3 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={formatJs} disabled={fmt.loading}>
              {fmt.loading ? t('js.processing') : t('js.format')}
            </Button>
            <Button size="sm" variant="outline" onClick={fmt.clear}>
              {t('js.clear')}
            </Button>
          </div>
          <CodePanel
            input={fmt.input}
            output={fmt.output}
            onInputChange={fmt.setInput}
            error={fmt.error}
            language="javascript"
          />
        </TabsContent>

        <TabsContent value="minify" className="space-y-3 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={minifyJs} disabled={min.loading}>
              {min.loading ? t('js.processing') : t('js.minify')}
            </Button>
            <Button size="sm" variant="outline" onClick={min.clear}>
              {t('js.clear')}
            </Button>
          </div>
          <CodePanel
            input={min.input}
            output={min.output}
            onInputChange={min.setInput}
            error={min.error}
            language="javascript"
          />
        </TabsContent>

        <TabsContent value="obfuscate" className="space-y-3 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={obfuscateJs} disabled={obf.loading}>
              {obf.loading ? t('js.processing') : t('js.obfuscate')}
            </Button>
            <Button size="sm" variant="outline" onClick={obf.clear}>
              {t('js.clear')}
            </Button>
          </div>
          <CodePanel
            input={obf.input}
            output={obf.output}
            onInputChange={obf.setInput}
            error={obf.error}
            language="javascript"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
