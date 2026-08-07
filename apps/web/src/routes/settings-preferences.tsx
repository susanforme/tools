import { SettingsLayout } from '@/components/settings-layout';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { type Locale, setLanguage } from '@/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { Languages, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/settings-preferences')({
  component: SettingsPreferencesPage,
});

function SettingsPreferencesPage() {
  const { i18n, t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <SettingsLayout
      active="preferences"
      title={t('settingsPage.preferencesTitle')}
    >
      <div className="divide-y rounded-xl border">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Label htmlFor="theme-preference" className="flex items-center gap-2">
            <Moon className="size-4 text-muted-foreground" />
            {t('settingsPage.theme')}
          </Label>
          <Select
            value={theme}
            onValueChange={(value) => setTheme(value as Theme)}
          >
            <SelectTrigger id="theme-preference" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="light">
                {t('settingsPage.themeLight')}
              </SelectItem>
              <SelectItem value="dark">
                {t('settingsPage.themeDark')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Label
            htmlFor="language-preference"
            className="flex items-center gap-2"
          >
            <Languages className="size-4 text-muted-foreground" />
            {t('settingsPage.language')}
          </Label>
          <Select
            value={i18n.language}
            onValueChange={(value) => setLanguage(value as Locale)}
          >
            <SelectTrigger id="language-preference" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="zh">中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </SettingsLayout>
  );
}
