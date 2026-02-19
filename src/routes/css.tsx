import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CodePanel } from '../components/code-panel'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export const Route = createFileRoute('/css')({
  component: CssPage,
})

/** 简易 CSS 压缩：移除注释与多余空白 */
function minifyCssString(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除注释
    .replace(/\s+/g, ' ') // 合并空白
    .replace(/\s*([{}:;,>~+])\s*/g, '$1') // 移除特殊符号周围的空白
    .replace(/;}/g, '}') // 移除末尾分号
    .trim()
}

function useTool() {
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

function CssPage() {
  const fmt = useTool()
  const min = useTool()
  const scss = useTool()

  const formatCss = async () => {
    fmt.setError(null)
    fmt.setLoading(true)
    try {
      const prettier = await import('prettier/standalone')
      const parserPostcss = await import('prettier/plugins/postcss')
      const result = await prettier.format(fmt.input, {
        parser: 'css',
        plugins: [parserPostcss],
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

  const minifyCss = () => {
    min.setError(null)
    try {
      if (!min.input.trim()) return
      min.setOutput(minifyCssString(min.input))
    } catch (e) {
      min.setError(`压缩失败：${(e as Error).message}`)
    }
  }

  const compileScssToCss = async () => {
    scss.setError(null)
    scss.setLoading(true)
    try {
      const sass = await import('sass')
      const result = sass.compileString(scss.input, {
        style: 'expanded',
      })
      scss.setOutput(result.css)
    } catch (e) {
      scss.setError(`SCSS 编译失败：${(e as Error).message}`)
    } finally {
      scss.setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">CSS / SCSS 工具</h1>
        <p className="text-muted-foreground text-sm mt-1">
          CSS 格式化、压缩，SCSS 编译为 CSS
        </p>
      </div>

      <Tabs defaultValue="format">
        <TabsList>
          <TabsTrigger value="format">格式化</TabsTrigger>
          <TabsTrigger value="minify">压缩</TabsTrigger>
          <TabsTrigger value="scss">SCSS → CSS</TabsTrigger>
        </TabsList>

        <TabsContent value="format" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={formatCss} disabled={fmt.loading || !fmt.input.trim()}>
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
            inputPlaceholder={`.container{display:flex;gap:8px;}`}
            error={fmt.error}
          />
        </TabsContent>

        <TabsContent value="minify" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={minifyCss} disabled={!min.input.trim()}>
              压缩
            </Button>
            <Button size="sm" variant="ghost" onClick={min.clear}>
              清空
            </Button>
          </div>
          <CodePanel
            input={min.input}
            output={min.output}
            onInputChange={min.setInput}
            inputPlaceholder={`.container {\n  display: flex;\n  gap: 8px;\n}`}
            error={min.error}
          />
        </TabsContent>

        <TabsContent value="scss" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={compileScssToCss}
              disabled={scss.loading || !scss.input.trim()}
            >
              {scss.loading ? '编译中...' : '编译 SCSS'}
            </Button>
            <Button size="sm" variant="ghost" onClick={scss.clear}>
              清空
            </Button>
          </div>
          <CodePanel
            input={scss.input}
            output={scss.output}
            onInputChange={scss.setInput}
            inputPlaceholder={`$primary: #3b82f6;\n\n.container {\n  color: $primary;\n  &:hover { opacity: 0.8; }\n}`}
            error={scss.error}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
