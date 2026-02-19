import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { Copy, Check, RefreshCw, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/uuid')({ component: UuidPage })

function generateUUID(): string {
  return crypto.randomUUID()
}

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const cls = size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className={`${cls} text-green-500`} /> : <Copy className={cls} />}
    </button>
  )
}

function UuidPage() {
  const { t } = useTranslation()
  const [uuids, setUuids] = useState<string[]>(() => [generateUUID()])
  const [count, setCount] = useState(1)
  const [uppercase, setUppercase] = useState(false)
  const [hyphens, setHyphens] = useState(true)
  const [allCopied, setAllCopied] = useState(false)

  const transformUuid = (uuid: string) => {
    let result = uuid
    if (!hyphens) result = result.replace(/-/g, '')
    if (uppercase) result = result.toUpperCase()
    return result
  }

  const generate = () => {
    const newUuids = Array.from({ length: count }, () => generateUUID())
    setUuids(newUuids)
  }

  const addMore = () => {
    const newOnes = Array.from({ length: count }, () => generateUUID())
    setUuids((prev) => [...prev, ...newOnes])
  }

  const clear = () => setUuids([])

  const copyAll = async () => {
    await navigator.clipboard.writeText(uuids.map(transformUuid).join('\n'))
    setAllCopied(true)
    setTimeout(() => setAllCopied(false), 1500)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('uuid.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('uuid.desc')}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground whitespace-nowrap">{t('uuid.count')}:</label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className="w-20 px-2 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
          {t('uuid.uppercase')}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} />
          {t('uuid.hyphens')}
        </label>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={generate}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {t('uuid.generate')}
        </Button>
        <Button size="sm" variant="outline" onClick={addMore}>
          {t('uuid.addMore')}
        </Button>
        {uuids.length > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={copyAll}>
              {allCopied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {t('uuid.copyAll')}
            </Button>
            <Button size="sm" variant="outline" onClick={clear}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('uuid.clear')}
            </Button>
          </>
        )}
      </div>

      {uuids.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t('uuid.result', { count: uuids.length })}</span>
          </div>
          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {uuids.map((uuid, i) => (
              <div key={i} className="flex items-center px-3 py-2 hover:bg-muted/30 group">
                <span className="text-xs text-muted-foreground/50 w-8 shrink-0 tabular-nums">{i + 1}</span>
                <span className="font-mono text-sm flex-1 select-all">
                  {transformUuid(uuid)}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={transformUuid(uuid)} size="xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
