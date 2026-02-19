import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodePanel } from '../components/code-panel'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/xml')({ component: XmlPage })

/** 纯 JS XML 格式化실 */
function formatXml(xml: string, indent = 2): string {
  const INDENT = ' '.repeat(indent)
  let formatted = ''
  let level = 0

  // 规范化：去掉标签间多余空白
  const normalized = xml
    .replace(/>\s*</g, '><')
    .replace(/^\s+|\s+$/g, '')

  const tokens = normalized.split(/(<[^>]+>)/)

  for (const token of tokens) {
    const trimmed = token.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('</')) {
      // 闭合标签
      level = Math.max(0, level - 1)
      formatted += INDENT.repeat(level) + trimmed + '\n'
    } else if (
      trimmed.startsWith('<?') ||
      trimmed.startsWith('<!') ||
      trimmed.endsWith('/>') ||
      (trimmed.startsWith('<') && !trimmed.includes('</'))
    ) {
      // 自闭合 / 声明 / 开放标签
      formatted += INDENT.repeat(level) + trimmed + '\n'
      if (
        trimmed.startsWith('<') &&
        !trimmed.startsWith('<?') &&
        !trimmed.startsWith('<!') &&
        !trimmed.endsWith('/>')
      ) {
        level++
      }
    } else {
      // 文本节点
      formatted += INDENT.repeat(level) + trimmed + '\n'
    }
  }

  return formatted.trimEnd()
}

/** 简易 XML 验证 */
function validateXml(xml: string): string | null {
  const trimmed = xml.trim()
  if (!trimmed) return 'XML 内容为空'
  // 检查根元素存在
  const hasRoot = /<[a-zA-Z]/.test(trimmed)
  if (!hasRoot) return '找不到 XML 根元素'
  // 检查标签匹配（简易检查）
  const openTags: string[] = []
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9:_.-]*)(?:\s[^>]*)?(\/?)>/g
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(trimmed)) !== null) {
    const [fullTag, tagName, selfClose] = match
    if (fullTag.startsWith('</')) {
      const last = openTags.pop()
      if (last !== tagName) return `标签不匹配：期望 </${last}>，得到 </${tagName}>`
    } else if (selfClose !== '/') {
      openTags.push(tagName)
    }
  }
  if (openTags.length > 0) return `未闭合标签：${openTags.map((t) => `<${t}>`).join(', ')}`
  return null
}

function minifyXml(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
}

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bookstore>
  <book category="cooking">
    <title lang="en">Everyday Italian</title>
    <author>Giada De Laurentiis</author>
    <year>2005</year>
    <price>30.00</price>
  </book>
  <book category="web">
    <title lang="en">Learning XML</title>
    <author>Erik T. Ray</author>
    <year>2003</year>
    <price>39.95</price>
  </book>
</bookstore>`

function XmlPage() {
  const { t } = useTranslation()
  const [input, setInput] = useState(SAMPLE_XML)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const format = () => {
    setError(null)
    try {
      setOutput(formatXml(input))
    } catch (e) {
      setError(t('xml.formatError', { msg: (e as Error).message }))
    }
  }

  const validate = () => {
    setError(null)
    const err = validateXml(input)
    if (err) {
      setError(t('xml.validateError', { msg: err }))
      setOutput('')
    } else {
      setOutput(t('xml.valid'))
    }
  }

  const minify = () => {
    setError(null)
    try {
      setOutput(minifyXml(input))
    } catch (e) {
      setError(t('xml.minifyError', { msg: (e as Error).message }))
    }
  }

  const clear = () => { setInput(''); setOutput(''); setError(null) }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('xml.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('xml.desc')}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={format}>{t('xml.format')}</Button>
        <Button size="sm" variant="outline" onClick={validate}>{t('xml.validate')}</Button>
        <Button size="sm" variant="outline" onClick={minify}>{t('xml.minify')}</Button>
        <Button size="sm" variant="ghost" onClick={clear}>{t('xml.clear')}</Button>
      </div>
      <CodePanel input={input} output={output} onInputChange={setInput} error={error} language="xml" />
    </div>
  )
}
