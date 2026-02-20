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

export const Route = createFileRoute('/html')({
  component: HtmlPage,
});

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>示例页面</title>
</head>
<body>
  <h1>Hello, World!</h1>
  <p>这是一段示例 HTML。</p>
</body>
</html>`;

function useHtmlTool(initialInput = '') {
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

type TabType = 'format' | 'minify';

function HtmlPage() {
  const { t } = useTranslation();
  const fmt = useHtmlTool(DEFAULT_HTML);
  const min = useHtmlTool(DEFAULT_HTML);
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'format');

  const formatHtml = async () => {
    fmt.setError(null);
    fmt.setLoading(true);
    try {
      const prettier = await import('prettier/standalone');
      const parserHtml = await import('prettier/plugins/html');
      const result = await prettier.format(fmt.input, {
        parser: 'html',
        plugins: [parserHtml],
        printWidth: 80,
        tabWidth: 2,
      });
      fmt.setOutput(result);
    } catch (e) {
      fmt.setError(t('html.formatError', { msg: (e as Error).message }));
    } finally {
      fmt.setLoading(false);
    }
  };

  const minifyHtml = async () => {
    min.setError(null);
    min.setLoading(true);
    try {
      const { minify } = await import('html-minifier-terser');
      const result = await minify(min.input, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true,
      });
      min.setOutput(result);
    } catch (e) {
      min.setError(t('html.minifyError', { msg: (e as Error).message }));
    } finally {
      min.setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('html.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('html.desc')}</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabType);
        }}
      >
        <TabsList>
          <TabsTrigger value="format">{t('html.tabFormat')}</TabsTrigger>
          <TabsTrigger value="minify">{t('html.tabMinify')}</TabsTrigger>
        </TabsList>

        <TabsContent value="format" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={formatHtml}
              disabled={fmt.loading || !fmt.input.trim()}
            >
              {fmt.loading ? t('html.processing') : t('html.format')}
            </Button>
            <Button size="sm" variant="ghost" onClick={fmt.clear}>
              {t('html.clear')}
            </Button>
          </div>
          <CodePanel
            input={fmt.input}
            output={fmt.output}
            onInputChange={fmt.setInput}
            inputPlaceholder="<html><head></head><body>...</body></html>"
            error={fmt.error}
            language="html"
          />
        </TabsContent>

        <TabsContent value="minify" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={minifyHtml}
              disabled={min.loading || !min.input.trim()}
            >
              {min.loading ? t('html.processing') : t('html.minify')}
            </Button>
            <Button size="sm" variant="ghost" onClick={min.clear}>
              {t('html.clear')}
            </Button>
          </div>
          <CodePanel
            input={min.input}
            output={min.output}
            onInputChange={min.setInput}
            inputPlaceholder="<html><head></head><body>...</body></html>"
            error={min.error}
            language="html"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
