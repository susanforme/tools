import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodePanel } from '../components/code-panel'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/yaml')({ component: YamlPage })

const SAMPLE_YAML = `name: my-app
version: 1.0.0
description: A sample application

server:
  host: localhost
  port: 3000
  debug: true

database:
  host: db.example.com
  port: 5432
  name: mydb
  credentials:
    user: admin
    password: secret

features:
  - authentication
  - authorization
  - logging`

function YamlPage() {
  const { t } = useTranslation()
  const [input, setInput] = useState(SAMPLE_YAML)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const format = async () => {
    setError(null)
    try {
      const yaml = await import('js-yaml')
      const parsed = yaml.load(input)
      setOutput(yaml.dump(parsed, { indent: 2, lineWidth: -1, noRefs: true }))
    } catch (e) {
      setError(t('yaml.formatError', { msg: (e as Error).message }))
    }
  }

  const minify = async () => {
    setError(null)
    try {
      const yaml = await import('js-yaml')
      const parsed = yaml.load(input)
      // 用 JSON 序列化为紧凑形式
      setOutput(JSON.stringify(parsed))
    } catch (e) {
      setError(t('yaml.minifyError', { msg: (e as Error).message }))
    }
  }

  const toJson = async () => {
    setError(null)
    try {
      const yaml = await import('js-yaml')
      const parsed = yaml.load(input)
      setOutput(JSON.stringify(parsed, null, 2))
    } catch (e) {
      setError(t('yaml.toJsonError', { msg: (e as Error).message }))
    }
  }

  const validate = async () => {
    setError(null)
    try {
      const yaml = await import('js-yaml')
      yaml.load(input)
      setOutput(t('yaml.valid'))
    } catch (e) {
      setError(t('yaml.validateError', { msg: (e as Error).message }))
    }
  }

  const clear = () => { setInput(''); setOutput(''); setError(null) }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('yaml.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('yaml.desc')}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={format}>{t('yaml.format')}</Button>
        <Button size="sm" variant="outline" onClick={validate}>{t('yaml.validate')}</Button>
        <Button size="sm" variant="outline" onClick={minify}>{t('yaml.minify')}</Button>
        <Button size="sm" variant="outline" onClick={toJson}>{t('yaml.toJson')}</Button>
        <Button size="sm" variant="ghost" onClick={clear}>{t('yaml.clear')}</Button>
      </div>
      <CodePanel input={input} output={output} onInputChange={setInput} error={error} language="yaml" outputLanguage="json" />
    </div>
  )
}
