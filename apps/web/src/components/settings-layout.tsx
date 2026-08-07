import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { Eraser, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Separator } from './ui/separator';

type SettingsSection = 'account' | 'data';

export function SettingsLayout({
  active,
  children,
  title,
}: {
  active: SettingsSection;
  children: ReactNode;
  title: string;
}) {
  const { t } = useTranslation();
  const items = [
    {
      id: 'account' as const,
      icon: UserRound,
      label: t('settingsPage.accountTitle'),
      to: '/settings' as const,
    },
    {
      id: 'data' as const,
      icon: Eraser,
      label: t('settingsPage.dataTitle'),
      to: '/settings-data' as const,
    },
  ];

  return (
    <div className="max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">
        {t('settingsPage.title')}
      </h1>
      <Separator className="my-6" />
      <div className="grid gap-8 md:grid-cols-[11rem_minmax(0,1fr)]">
        <nav
          aria-label={t('settingsPage.title')}
          className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible"
        >
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              aria-current={active === item.id ? 'page' : undefined}
              className={cn(
                'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                active === item.id
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 max-w-2xl">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Separator className="my-4" />
          {children}
        </main>
      </div>
    </div>
  );
}
