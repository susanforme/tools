import { useTheme } from '@/hooks/use-theme';
import { MermaidPanel } from '@/components/community-tool-panels';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { markdownToToc, renderMarkdown } from '@/lib/markdown';
import Editor from '@monaco-editor/react';
import { createFileRoute } from '@tanstack/react-router';
import { Eraser, WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import '../lib/monaco';

export const Route = createFileRoute('/markdown')({ component: MarkdownPage });

const SAMPLE_MD = `# Markdown 实时预览

使用 **Marked** 在浏览器中渲染 GitHub Flavored Markdown。

## 常用语法

- [x] 实时预览
- [x] 表格与任务列表
- [ ] 写下你的内容

| 工具 | 用途 |
| --- | --- |
| Monaco | Markdown 编辑 |
| Marked | Markdown 渲染 |

~~~typescript
const greeting: string = 'Hello, Markdown!';
console.log(greeting);
~~~

> 内容只在本地浏览器中处理。`;

type MarkdownView = 'split' | 'edit' | 'preview';
type MarkdownTool = 'markdown' | 'mermaid' | 'toc';

function MarkdownPage() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [input, setInput] = useState(SAMPLE_MD);
  const [loading, setLoading] = useState(false);
  const [beautifyError, setBeautifyError] = useState<string | null>(null);
  const [view, setView] = useQueryParam<MarkdownView>(
    'view',
    StringParam,
    'split',
  );
  const [tool, setTool] = useQueryParam<MarkdownTool>(
    'tool',
    StringParam,
    'markdown',
  );

  const preview = useMemo(() => {
    try {
      return { html: renderMarkdown(input), error: null };
    } catch (cause) {
      return { html: '', error: (cause as Error).message };
    }
  }, [input]);

  const beautify = async () => {
    setBeautifyError(null);
    setLoading(true);
    try {
      const prettier = await import('prettier/standalone');
      const parserMarkdown = await import('prettier/plugins/markdown');
      setInput(
        await prettier.format(input, {
          parser: 'markdown',
          plugins: [parserMarkdown],
          proseWrap: 'always',
          printWidth: 80,
        }),
      );
    } catch (cause) {
      setBeautifyError(
        t('markdown.beautifyError', { msg: (cause as Error).message }),
      );
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setInput('');
    setBeautifyError(null);
  };

  const activeView: MarkdownView =
    view === 'edit' || view === 'preview' ? view : 'split';

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">{t('markdown.title')}</h1>
      </div>

      <Tabs
        value={tool}
        onValueChange={(value) => setTool(value as MarkdownTool)}
      >
        <TabsList>
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="mermaid">Mermaid</TabsTrigger>
          <TabsTrigger value="toc">{t('markdown.toc')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tool === 'mermaid' ? (
        <MermaidPanel />
      ) : tool === 'toc' ? (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
            <div className="border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              {t('markdown.source')}
            </div>
            <Editor
              height="620px"
              language="markdown"
              value={input}
              onChange={(value) => setInput(value ?? '')}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </section>
          <Textarea
            readOnly
            value={markdownToToc(input)}
            className="min-h-[620px] resize-none font-mono text-sm"
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={activeView}
              onValueChange={(value) => setView(value as MarkdownView)}
            >
              <TabsList>
                <TabsTrigger value="split">
                  {t('markdown.tabSplit')}
                </TabsTrigger>
                <TabsTrigger value="edit">{t('markdown.tabEdit')}</TabsTrigger>
                <TabsTrigger value="preview">
                  {t('markdown.tabPreview')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void beautify()}
              disabled={loading || !input}
            >
              <WandSparkles />
              {loading ? t('markdown.processing') : t('markdown.beautify')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clear}
              disabled={!input}
            >
              <Eraser />
              {t('markdown.clear')}
            </Button>
          </div>

          {(beautifyError || preview.error) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {beautifyError ??
                t('markdown.previewError', { msg: preview.error ?? '' })}
            </div>
          )}

          <div
            className={
              activeView === 'split'
                ? 'grid min-w-0 gap-4 md:grid-cols-2'
                : 'grid min-w-0 grid-cols-1'
            }
          >
            {activeView !== 'preview' && (
              <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
                <div className="border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  {t('markdown.source')}
                </div>
                <Editor
                  height="620px"
                  language="markdown"
                  value={input}
                  onChange={(value) => setInput(value ?? '')}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbersMinChars: 3,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    padding: { top: 14, bottom: 14 },
                  }}
                />
              </section>
            )}

            {activeView !== 'edit' && (
              <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
                <div className="border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                  {t('markdown.preview')}
                </div>
                <article
                  className="h-[620px] overflow-auto p-6 break-words text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_h1]:mb-4 [&_h1]:border-b [&_h1]:pb-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_hr]:my-6 [&_hr]:border-border [&_img]:max-w-full [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_pre]:my-4 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
