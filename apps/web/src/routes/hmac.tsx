import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { Copy, Check } from 'lucide-react'

export const Route = createFileRoute('/hmac')({ component: HmacPage })

type HmacAlgo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

const ALGOS: HmacAlgo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

async function computeHmac(algo: HmacAlgo, message: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: algo },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      disabled={!text}
      className="flex items-center gap-1 shrink-0 px-2 py-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs disabled:opacity-40"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      {label && <span>{label}</span>}
    </button>
  )
}

function HmacPage() {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [secret, setSecret] = useState('')
  const [algo, setAlgo] = useState<HmacAlgo>('SHA-256')
  const [results, setResults] = useState<Partial<Record<HmacAlgo, string>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uppercase, setUppercase] = useState(false)
  const [computeAll, setComputeAll] = useState(false)

  const compute = async () => {
    if (!message.trim() || !secret.trim()) return
    setLoading(true)
    setError(null)
    try {
      if (computeAll) {
        const entries = await Promise.all(
          ALGOS.map(async (a) => [a, await computeHmac(a, message, secret)] as const)
        )
        setResults(Object.fromEntries(entries))
      } else {
        const result = await computeHmac(algo, message, secret)
        setResults({ [algo]: result } as Record<HmacAlgo, string>)
      }
    } catch (e) {
      setError(t('hmac.computeError', { msg: (e as Error).message }))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setMessage('')
    setSecret('')
    setResults({})
    setError(null)
  }

  const displayHash = (h: string) => uppercase ? h.toUpperCase() : h

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('hmac.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('hmac.desc')}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">{t('hmac.message')}</label>
          <textarea
            className="w-full h-28 p-3 font-mono text-sm bg-background border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('hmac.messagePlaceholder')}
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">{t('hmac.secret')}</label>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t('hmac.secretPlaceholder')}
            className="w-full px-3 py-2 text-sm border rounded-lg bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            spellCheck={false}
          />
        </div>

        {!computeAll && (
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground">{t('hmac.algorithm')}:</span>
            <div className="flex gap-1">
              {ALGOS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAlgo(a)}
                  className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                    algo === a ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={compute} disabled={loading || !message.trim() || !secret.trim()}>
            {loading ? t('hmac.computing') : t('hmac.compute')}
          </Button>
          <Button size="sm" variant="outline" onClick={clear}>{t('hmac.clear')}</Button>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={computeAll} onChange={(e) => setComputeAll(e.target.checked)} />
            {t('hmac.computeAll')}
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
            {t('hmac.uppercase')}
          </label>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</div>
      )}

      {Object.entries(results).length > 0 && (
        <div className="space-y-3">
          {(Object.entries(results) as [HmacAlgo, string][]).map(([a, hash]) => (
            <div key={a} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                <span className="text-xs font-semibold text-muted-foreground">HMAC-{a}</span>
                <div className="ml-auto">
                  <CopyButton text={displayHash(hash)} />
                </div>
              </div>
              <div className="px-3 py-2.5 font-mono text-sm break-all select-all bg-background">
                {displayHash(hash)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
