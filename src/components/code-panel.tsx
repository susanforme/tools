import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'

export interface CodePanelProps {
  input: string
  output: string
  onInputChange: (v: string) => void
  inputPlaceholder?: string
  error?: string | null
}

export function CodePanel({
  input,
  output,
  onInputChange,
  inputPlaceholder,
  error,
}: CodePanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          <Textarea
            className="min-h-[480px] font-mono text-sm resize-y"
            placeholder={inputPlaceholder ?? '在此粘贴内容...'}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            spellCheck={false}
          />
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
          <Textarea
            className="min-h-[480px] font-mono text-sm resize-y bg-muted/30"
            readOnly
            value={output}
            placeholder="处理结果将在此显示..."
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
