import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CodePanel } from '../components/code-panel'
import { Button } from '../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Separator } from '../components/ui/separator'

export const Route = createFileRoute('/json')({
  component: JsonPage,
})

const DEFAULT_JSON = `{
  "name": "Alice",
  "age": 30,
  "skills": ["TypeScript", "React"],
  "address": { "city": "Shanghai", "zip": "200000" }
}`

function JsonPage() {
  const [input, setInput] = useState(DEFAULT_JSON)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [indent, setIndent] = useState('2')

  const parse = () => {
    try {
      return JSON.parse(input)
    } catch (e) {
      setError(`JSON 解析错误：${(e as Error).message}`)
      setOutput('')
      return null
    }
  }

  const format = () => {
    setError(null)
    const parsed = parse()
    if (parsed === null && input.trim() !== 'null') return
    try {
      const indentValue = indent === 'tab' ? '\t' : Number(indent)
      setOutput(JSON.stringify(parsed, null, indentValue))
    } catch (e) {
      setError(`格式化失败：${(e as Error).message}`)
    }
  }

  const minify = () => {
    setError(null)
    const parsed = parse()
    if (parsed === null && input.trim() !== 'null') return
    try {
      setOutput(JSON.stringify(parsed))
    } catch (e) {
      setError(`压缩失败：${(e as Error).message}`)
    }
  }

  const validate = () => {
    setError(null)
    try {
      JSON.parse(input)
      setOutput('✓  JSON 格式有效')
    } catch (e) {
      setError(`JSON 格式无效：${(e as Error).message}`)
      setOutput('')
    }
  }

  const clear = () => {
    setInput('')
    setOutput('')
    setError(null)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">JSON 工具</h1>
        <p className="text-muted-foreground text-sm mt-1">JSON 格式化、压缩与语法验证</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">缩进：</span>
          <Select value={indent} onValueChange={setIndent}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 空格</SelectItem>
              <SelectItem value="4">4 空格</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <Button size="sm" onClick={format}>
          格式化
        </Button>
        <Button size="sm" variant="secondary" onClick={minify}>
          压缩
        </Button>
        <Button size="sm" variant="outline" onClick={validate}>
          验证
        </Button>
        <Button size="sm" variant="ghost" onClick={clear}>
          清空
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
    </div>
  )
}
