import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodePanel } from '../components/code-panel'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export const Route = createFileRoute('/markdown')({ component: MarkdownPage })

const SAMPLE_MD = `# Hello, Markdown!

A lightweight markup language for **formatting** text.

## Features

- Easy to write
- Easy to read
- Converts to HTML

## Code Example

\`\`\`javascript
const greet = (name) => \`Hello, \${name}!\`
console.log(greet('World'))
\`\`\`

> "Markdown is a text-to-HTML conversion tool." — John Gruber

[Learn more](https://daringfireball.net/projects/markdown/)`

function MarkdownPage() {
  const { t } = useTranslation()
  const [input, setInput] = useState(SAMPLE_MD)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [html, setHtml] = useState('')

  const beautify = async () => {
    setError(null)
    setLoading(true)
    try {
      const prettier = await import('prettier/standalone')
      const parserMarkdown = await import('prettier/plugins/markdown')
      const result = await prettier.format(input, {
        parser: 'markdown',
        plugins: [parserMarkdown],
        proseWrap: 'always',
        printWidth: 80,
      })
      setOutput(result)
    } catch (e) {
      setError(t('markdown.beautifyError', { msg: (e as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const preview = async () => {
    setError(null)
    setLoading(true)
    try {
      const { marked } = await import('marked')
      const result = await marked(input, { async: false })
      setHtml(result as string)
    } catch (e) {
      setError(t('markdown.previewError', { msg: (e as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => { setInput(''); setOutput(''); setHtml(''); setError(null) }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('markdown.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('markdown.desc')}</p>
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">{t('markdown.tabEdit')}</TabsTrigger>
          <TabsTrigger value="preview" onClick={preview}>{t('markdown.tabPreview')}</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-3 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={beautify} disabled={loading}>
              {loading ? t('markdown.processing') : t('markdown.beautify')}
            </Button>
            <Button size="sm" variant="outline" onClick={clear}>{t('markdown.clear')}</Button>
          </div>
          <CodePanel input={input} output={output} onInputChange={setInput} error={error} language="markdown" />
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Button size="sm" onClick={preview} disabled={loading}>
              {loading ? t('markdown.processing') : t('markdown.refresh')}
            </Button>
            <Button size="sm" variant="outline" onClick={clear}>{t('markdown.clear')}</Button>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mb-3">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
                {t('markdown.source')}
              </div>
              <textarea
                className="w-full h-[500px] p-3 font-mono text-sm bg-background resize-none focus:outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
                {t('markdown.preview')}
              </div>
              <div
                className="p-4 h-[500px] overflow-auto prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
