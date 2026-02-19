import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CodePanel } from '../components/code-panel'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export const Route = createFileRoute('/html')({
  component: HtmlPage,
})

function useHtmlTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const clear = () => {
    setInput('')
    setOutput('')
    setError(null)
  }

  return { input, setInput, output, setOutput, error, setError, loading, setLoading, clear }
}

function HtmlPage() {
  const fmt = useHtmlTool()
  const min = useHtmlTool()

  const formatHtml = async () => {
    fmt.setError(null)
    fmt.setLoading(true)
    try {
      const prettier = await import('prettier/standalone')
      const parserHtml = await import('prettier/plugins/html')
      const result = await prettier.format(fmt.input, {
        parser: 'html',
        plugins: [parserHtml],
        printWidth: 80,
        tabWidth: 2,
      })
      fmt.setOutput(result)
    } catch (e) {
      fmt.setError(`格式化失败：${(e as Error).message}`)
    } finally {
      fmt.setLoading(false)
    }
  }

  const minifyHtml = async () => {
    min.setError(null)
    min.setLoading(true)
    try {
      const { minify } = await import('html-minifier-terser')
      const result = await minify(min.input, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true,
      })
      min.setOutput(result)
    } catch (e) {
      min.setError(`压缩失败：${(e as Error).message}`)
    } finally {
      min.setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">HTML 工具</h1>
        <p className="text-muted-foreground text-sm mt-1">HTML 代码格式化与压缩</p>
      </div>

      <Tabs defaultValue="format">
        <TabsList>
          <TabsTrigger value="format">格式化</TabsTrigger>
          <TabsTrigger value="minify">压缩</TabsTrigger>
        </TabsList>

        <TabsContent value="format" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={formatHtml} disabled={fmt.loading || !fmt.input.trim()}>
              {fmt.loading ? '处理中...' : '格式化'}
            </Button>
            <Button size="sm" variant="ghost" onClick={fmt.clear}>
              清空
            </Button>
          </div>
          <CodePanel
            input={fmt.input}
            output={fmt.output}
            onInputChange={fmt.setInput}
            inputPlaceholder="<html><head></head><body>...</body></html>"
            error={fmt.error}
          />
        </TabsContent>

        <TabsContent value="minify" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={minifyHtml} disabled={min.loading || !min.input.trim()}>
              {min.loading ? '处理中...' : '压缩'}
            </Button>
            <Button size="sm" variant="ghost" onClick={min.clear}>
              清空
            </Button>
          </div>
          <CodePanel
            input={min.input}
            output={min.output}
            onInputChange={min.setInput}
            inputPlaceholder="<html><head></head><body>...</body></html>"
            error={min.error}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
