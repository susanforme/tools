import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { type Locale, setLanguage } from '../i18n'

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
}

export function LangSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.language as Locale

  return (
    <Select value={current} onValueChange={(v) => setLanguage(v as Locale)}>
      <SelectTrigger className="h-8 w-auto gap-1.5 border-none bg-transparent px-2 text-sm text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0">
        <Globe className="w-4 h-4 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([lang, label]) => (
          <SelectItem key={lang} value={lang}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
