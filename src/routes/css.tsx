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

type TabType = 'format' | 'minify' | 'scss';

export const Route = createFileRoute('/css')({
  component: CssPage,
});

/** 简易 CSS 压缩：移除注释与多余空白 */
function minifyCssString(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除注释
    .replace(/\s+/g, ' ') // 合并空白
    .replace(/\s*([{}:;,>~+])\s*/g, '$1') // 移除特殊符号周围的空白
    .replace(/;}/g, '}') // 移除末尾分号
    .trim();
}

const DEFAULT_CSS = `.container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background-color: #f9f9f9;
}

.title {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}`;

const DEFAULT_SCSS = `$primary: #3b82f6;
$spacing: 8px;

.container {
  display: flex;
  gap: $spacing * 2;
  padding: $spacing;

  .title {
    font-size: 24px;
    color: $primary;
    &:hover { opacity: 0.8; }
  }
}`;

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

function CssPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'format');
  const fmt = useTool(DEFAULT_CSS);
  const min = useTool(DEFAULT_CSS);
  const scss = useTool(DEFAULT_SCSS);

  const formatCss = async () => {
    fmt.setError(null);
    fmt.setLoading(true);
    try {
      const prettier = await import('prettier/standalone');
      const parserPostcss = await import('prettier/plugins/postcss');
      const result = await prettier.format(fmt.input, {
        parser: 'css',
        plugins: [parserPostcss],
        printWidth: 80,
        tabWidth: 2,
      });
      fmt.setOutput(result);
    } catch (e) {
      fmt.setError(t('css.formatError', { msg: (e as Error).message }));
    } finally {
      fmt.setLoading(false);
    }
  };

  const minifyCss = () => {
    min.setError(null);
    try {
      if (!min.input.trim()) return;
      min.setOutput(minifyCssString(min.input));
    } catch (e) {
      min.setError(t('css.minifyError', { msg: (e as Error).message }));
    }
  };

  const compileScssToCss = async () => {
    scss.setError(null);
    scss.setLoading(true);
    try {
      const { compileStringAsync } = await import('sass');
      const result = await compileStringAsync(scss.input, {
        style: 'expanded',
      });
      scss.setOutput(result.css);
    } catch (e) {
      scss.setError(t('css.scssError', { msg: (e as Error).message }));
    } finally {
      scss.setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('css.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('css.desc')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="format">{t('css.tabFormat')}</TabsTrigger>
          <TabsTrigger value="minify">{t('css.tabMinify')}</TabsTrigger>
          <TabsTrigger value="scss">{t('css.tabScss')}</TabsTrigger>
        </TabsList>

        <TabsContent value="format" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={formatCss}
              disabled={fmt.loading || !fmt.input.trim()}
            >
              {fmt.loading ? t('css.processing') : t('css.format')}
            </Button>
            <Button size="sm" variant="ghost" onClick={fmt.clear}>
              {t('css.clear')}
            </Button>
          </div>
          <CodePanel
            input={fmt.input}
            output={fmt.output}
            onInputChange={fmt.setInput}
            inputPlaceholder={`.container{display:flex;gap:8px;}`}
            error={fmt.error}
            language="css"
          />
        </TabsContent>

        <TabsContent value="minify" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={minifyCss} disabled={!min.input.trim()}>
              {t('css.minify')}
            </Button>
            <Button size="sm" variant="ghost" onClick={min.clear}>
              {t('css.clear')}
            </Button>
          </div>
          <CodePanel
            input={min.input}
            output={min.output}
            onInputChange={min.setInput}
            inputPlaceholder={`.container {\n  display: flex;\n  gap: 8px;\n}`}
            error={min.error}
            language="css"
          />
        </TabsContent>

        <TabsContent value="scss" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={compileScssToCss}
              disabled={scss.loading || !scss.input.trim()}
            >
              {scss.loading ? t('css.compiling') : t('css.compile')}
            </Button>
            <Button size="sm" variant="ghost" onClick={scss.clear}>
              {t('css.clear')}
            </Button>
          </div>
          <CodePanel
            input={scss.input}
            output={scss.output}
            onInputChange={scss.setInput}
            inputPlaceholder={`$primary: #3b82f6;\n\n.container {\n  color: $primary;\n  &:hover { opacity: 0.8; }\n}`}
            error={scss.error}
            language="scss"
            outputLanguage="css"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
