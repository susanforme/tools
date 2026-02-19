import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export const Route = createFileRoute('/base64')({ component: Base64Page })

function useTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const clear = () => { setInput(''); setOutput(''); setError(null) }
  return { input, setInput, output, setOutput, error, setError, clear }
}

function Base64Page() {
  const { t } = useTranslation()
  const enc = useTool()
  const dec = useTool()
  const [copied, setCopied] = useState(false)

  const encode = () => {
    enc.setError(null)
    try {
      enc.setOutput(btoa(unescape(encodeURIComponent(enc.input))))
    } catch (e) {
      enc.setError(t('base64.encodeError', { msg: (e as Error).message }))
    }
  }

  const decode = () => {
    dec.setError(null)
    try {
      dec.setOutput(decodeURIComponent(escape(atob(dec.input.trim()))))
    } catch (e) {
      dec.setError(t('base64.decodeError', { msg: (e as Error).message }))
    }
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const Panel = ({
    state,
    placeholder,
    outputPlaceholder,
    onAction,
    actionLabel,
    onClear,
  }: {
    state: ReturnType<typeof useTool>
    placeholder: string
    outputPlaceholder: string
    onAction: () => void
    actionLabel: string
    onClear: () => void
  }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={onAction}>{actionLabel}</Button>
        <Button size="sm" variant="outline" onClick={onClear}>{t('base64.clear')}</Button>
      </div>
      {state.error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {state.error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">{t('base64.input')}</div>
          <textarea
            className="w-full h-48 p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            value={state.input}
            onChange={(e) => state.setInput(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
          />
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 border-b">
            <span className="text-xs text-muted-foreground">{t('base64.output')}</span>
            {state.output && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => copy(state.output)}
              >
                {copied ? t('base64.copied') : t('base64.copy')}
              </button>
            )}
          </div>
          <textarea
            readOnly
            className="w-full h-48 p-3 font-mono text-sm bg-muted/20 resize-none focus:outline-none"
            value={state.output}
            placeholder={outputPlaceholder}
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('base64.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('base64.desc')}</p>
      </div>

      <Tabs defaultValue="encode">
        <TabsList>
          <TabsTrigger value="encode">{t('base64.tabEncode')}</TabsTrigger>
          <TabsTrigger value="decode">{t('base64.tabDecode')}</TabsTrigger>
        </TabsList>
        <TabsContent value="encode" className="mt-4">
          <Panel
            state={enc}
            placeholder={t('base64.encodePlaceholder')}
            outputPlaceholder={t('base64.encodeOutputPlaceholder')}
            onAction={encode}
            actionLabel={t('base64.encode')}
            onClear={enc.clear}
          />
        </TabsContent>
        <TabsContent value="decode" className="mt-4">
          <Panel
            state={dec}
            placeholder={t('base64.decodePlaceholder')}
            outputPlaceholder={t('base64.decodeOutputPlaceholder')}
            onAction={decode}
            actionLabel={t('base64.decode')}
            onClear={dec.clear}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
