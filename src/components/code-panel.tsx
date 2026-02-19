import { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from './ui/button'
import Editor from '@monaco-editor/react'

export interface CodePanelProps {
  input: string
  output: string
  onInputChange: (v: string) => void
  inputPlaceholder?: string
  error?: string | null
  language?: string
  /** 输出面板使用不同语言（如 SCSS→CSS），默认与 language 相同 */
  outputLanguage?: string
}

export function CodePanel({
  input,
  output,
  onInputChange,
  inputPlaceholder: _inputPlaceholder,
  error,
  language = 'plaintext',
  outputLanguage,
}: CodePanelProps) {
  const resolvedOutputLanguage = outputLanguage ?? language
  const [copied, setCopied] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleCopy = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const theme = isDark ? 'vs-dark' : 'light'

  const baseOptions = {
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on' as const,
    wordWrap: 'on' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    renderLineHighlight: 'all' as const,
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            输入
          </label>
          <div className="rounded-md overflow-hidden border border-input">
            <Editor
              height="480px"
              language={language}
              value={input}
              onChange={(v) => onInputChange(v ?? '')}
              theme={theme}
              options={baseOptions}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              输出
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!output}
              className="h-6 px-2 text-xs gap-1"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
          <div className="rounded-md overflow-hidden border border-input">
            <Editor
              height="480px"
              language={resolvedOutputLanguage}
              value={output}
              theme={theme}
              options={{ ...baseOptions, readOnly: true }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
