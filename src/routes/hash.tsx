import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { Copy, Check, Hash } from 'lucide-react'

export const Route = createFileRoute('/hash')({ component: HashPage })

type HashResult = {
  md5: string
  sha1: string
  sha256: string
  sha512: string
}

async function bufToHex(buf: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function computeWebCryptoHash(text: string, algo: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest(algo, enc.encode(text))
  return bufToHex(buf)
}

async function computeAllHashes(text: string): Promise<HashResult> {
  const CryptoJS = (await import('crypto-js')).default
  const [sha1, sha256, sha512] = await Promise.all([
    computeWebCryptoHash(text, 'SHA-1'),
    computeWebCryptoHash(text, 'SHA-256'),
    computeWebCryptoHash(text, 'SHA-512'),
  ])
  const md5 = CryptoJS.MD5(text).toString()
  return { md5, sha1, sha256, sha512 }
}

const HASH_LABELS = [
  { key: 'md5', label: 'MD5', bits: 128 },
  { key: 'sha1', label: 'SHA-1', bits: 160 },
  { key: 'sha256', label: 'SHA-256', bits: 256 },
  { key: 'sha512', label: 'SHA-512', bits: 512 },
] as const

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title="复制"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function HashPage() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<HashResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uppercase, setUppercase] = useState(false)

  const compute = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await computeAllHashes(input)
      setResult(r)
    } catch (e) {
      setError(t('hash.computeError', { msg: (e as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setInput('')
    setResult(null)
    setError(null)
  }

  const displayHash = (h: string) => uppercase ? h.toUpperCase() : h

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('hash.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('hash.desc')}</p>
      </div>

      <div className="space-y-3">
        <textarea
          className="w-full h-32 p-3 font-mono text-sm bg-background border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('hash.placeholder')}
          spellCheck={false}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={compute} disabled={loading || !input.trim()}>
            {loading ? t('hash.computing') : t('hash.compute')}
          </Button>
          <Button size="sm" variant="outline" onClick={clear}>{t('hash.clear')}</Button>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none ml-2">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              className="rounded"
            />
            {t('hash.uppercase')}
          </label>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
      )}

      {result && (
        <div className="space-y-3">
          {HASH_LABELS.map(({ key, label, bits }) => (
            <div key={key} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                <span className="text-xs text-muted-foreground/60">({bits} bit)</span>
                <div className="ml-auto">
                  <CopyButton text={displayHash(result[key])} />
                </div>
              </div>
              <div className="px-3 py-2.5 font-mono text-sm break-all select-all bg-background">
                {displayHash(result[key])}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
