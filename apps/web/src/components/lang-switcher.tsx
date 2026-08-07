import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from './ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { type Locale, setLanguage } from '../i18n';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

export function LangSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.language as Locale;

  return (
    <Select value={current} onValueChange={(v) => setLanguage(v as Locale)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <SelectTrigger
              aria-label={t('shell.language')}
              className="h-8 w-8 justify-center border-none bg-transparent p-0 text-muted-foreground shadow-none hover:bg-accent hover:text-foreground focus-visible:ring-0 [&>svg:last-child]:hidden"
            >
              <Globe className="h-4 w-4" />
            </SelectTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {t('shell.language')}
        </TooltipContent>
      </Tooltip>
      <SelectContent align="end">
        {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(
          ([lang, label]) => (
            <SelectItem key={lang} value={lang}>
              {label}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
