import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export const Route = createFileRoute('/unicode')({ component: UnicodePage })

// ── 转换函数 ──────────────────────────────────────────────────────────

/** 文本 → Unicode 转义 (\uXXXX) */
function textToUnicodeEscape(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const cp = ch.codePointAt(0)!
      return cp > 0xffff
        ? `\\u{${cp.toString(16).toUpperCase()}}`
        : `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`
    })
    .join('')
}

/** Unicode 转义 → 文本 */
function unicodeEscapeToText(escaped: string): string {
  return escaped
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
}

/** 文本 → UTF-8 十六进制字节序列 */
function textToUtf8Hex(text: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}

/** UTF-8 十六进制 → 文本 */
function utf8HexToText(hex: string): string {
  const bytes = hex.trim().split(/\s+/).map((h) => parseInt(h, 16))
  if (bytes.some(isNaN)) throw new Error('包含无效的十六进制值')
  const decoder = new TextDecoder()
  return decoder.decode(Uint8Array.from(bytes))
}

/** 文本 → UTF-16 十六进制（大端） */
function textToUtf16Hex(text: string): string {
  const result: string[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    result.push(code.toString(16).toUpperCase().padStart(4, '0'))
  }
  return result.join(' ')
}

/** UTF-16 十六进制 → 文本 */
function utf16HexToText(hex: string): string {
  const codes = hex.trim().split(/\s+/).map((h) => parseInt(h, 16))
  if (codes.some(isNaN)) throw new Error('包含无效的十六进制值')
  return String.fromCharCode(...codes)
}

/** 文本 → 码位列表 */
function textToCodePoints(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const cp = ch.codePointAt(0)!
      const hex = cp.toString(16).toUpperCase().padStart(4, '0')
      return `U+${hex}  (${cp})  ${ch}`
    })
    .join('\n')
}

// ── 组件 ────────────────────────────────────────────────────────────

function Panel({
  label,
  input,
  onInput,
  output,
  onEncode,
  onDecode,
  encodeLabel,
  decodeLabel,
  error,
  onClear,
  clearLabel,
}: {
  label: string
  input: string
  onInput: (v: string) => void
  output: string
  onEncode: () => void
  onDecode: () => void
  encodeLabel: string
  decodeLabel: string
  error: string | null
  onClear: () => void
  clearLabel: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={onEncode}>{encodeLabel}</Button>
        <Button size="sm" variant="outline" onClick={onDecode}>{decodeLabel}</Button>
        <Button size="sm" variant="ghost" onClick={onClear}>{clearLabel}</Button>
      </div>
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">{label}</div>
          <textarea
            className="w-full h-48 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            value={input}
            onChange={(e) => onInput(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">{label} →</div>
          <textarea
            readOnly
            className="w-full h-48 p-3 font-mono text-sm bg-muted/20 resize-none focus:outline-none"
            value={output}
          />
        </div>
      </div>
    </div>
  )
}

function UnicodePage() {
  const { t } = useTranslation()

  const [esc, setEsc] = useState('你好，世界！Hello World 🌍')
  const [escOut, setEscOut] = useState('')
  const [escErr, setEscErr] = useState<string | null>(null)

  const [u8, setU8] = useState('你好')
  const [u8Out, setU8Out] = useState('')
  const [u8Err, setU8Err] = useState<string | null>(null)

  const [u16, setU16] = useState('Hello')
  const [u16Out, setU16Out] = useState('')
  const [u16Err, setU16Err] = useState<string | null>(null)

  const [cp, setCp] = useState('Hello 你好 🚀')
  const [cpOut, setCpOut] = useState('')

  const wrap = (fn: () => void, setErr: (e: string | null) => void) => {
    setErr(null)
    try { fn() } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('unicode.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('unicode.desc')}</p>
      </div>

      <Tabs defaultValue="escape">
        <TabsList>
          <TabsTrigger value="escape">{t('unicode.tabEscape')}</TabsTrigger>
          <TabsTrigger value="utf8">{t('unicode.tabUtf8')}</TabsTrigger>
          <TabsTrigger value="utf16">{t('unicode.tabUtf16')}</TabsTrigger>
          <TabsTrigger value="codepoints">{t('unicode.tabCodepoints')}</TabsTrigger>
        </TabsList>

        <TabsContent value="escape" className="mt-4">
          <Panel
            label={t('unicode.text')}
            input={esc}
            onInput={setEsc}
            output={escOut}
            onEncode={() => wrap(() => setEscOut(textToUnicodeEscape(esc)), setEscErr)}
            onDecode={() => wrap(() => setEscOut(unicodeEscapeToText(esc)), setEscErr)}
            encodeLabel={t('unicode.toEscape')}
            decodeLabel={t('unicode.fromEscape')}
            error={escErr}
            onClear={() => { setEsc(''); setEscOut(''); setEscErr(null) }}
            clearLabel={t('unicode.clear')}
          />
        </TabsContent>

        <TabsContent value="utf8" className="mt-4">
          <Panel
            label={t('unicode.text')}
            input={u8}
            onInput={setU8}
            output={u8Out}
            onEncode={() => wrap(() => setU8Out(textToUtf8Hex(u8)), setU8Err)}
            onDecode={() => wrap(() => setU8Out(utf8HexToText(u8)), setU8Err)}
            encodeLabel={t('unicode.toHex')}
            decodeLabel={t('unicode.fromHex')}
            error={u8Err}
            onClear={() => { setU8(''); setU8Out(''); setU8Err(null) }}
            clearLabel={t('unicode.clear')}
          />
        </TabsContent>

        <TabsContent value="utf16" className="mt-4">
          <Panel
            label={t('unicode.text')}
            input={u16}
            onInput={setU16}
            output={u16Out}
            onEncode={() => wrap(() => setU16Out(textToUtf16Hex(u16)), setU16Err)}
            onDecode={() => wrap(() => setU16Out(utf16HexToText(u16)), setU16Err)}
            encodeLabel={t('unicode.toHex')}
            decodeLabel={t('unicode.fromHex')}
            error={u16Err}
            onClear={() => { setU16(''); setU16Out(''); setU16Err(null) }}
            clearLabel={t('unicode.clear')}
          />
        </TabsContent>

        <TabsContent value="codepoints" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setCpOut(textToCodePoints(cp))}>
                {t('unicode.inspect')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setCp(''); setCpOut('') }}>
                {t('unicode.clear')}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">{t('unicode.text')}</div>
                <textarea
                  className="w-full h-48 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
                  value={cp}
                  onChange={(e) => setCp(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">{t('unicode.codepoints')}</div>
                <textarea
                  readOnly
                  className="w-full h-48 p-3 font-mono text-sm bg-muted/20 resize-none focus:outline-none"
                  value={cpOut}
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
