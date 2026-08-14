import { SettingsLayout } from '@/components/settings-layout';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { resetFavorites } from '@/hooks/useFavorites';
import {
  clearStoredFiles,
  clearStoredRecords,
  getStoredDataUsage,
  type StoredDataUsage,
} from '@/lib/local-data';
import { formatMediaBytes } from '@/lib/media-tools';
import { createFileRoute } from '@tanstack/react-router';
import {
  CheckCircle2,
  FileX2,
  ListX,
  LoaderCircle,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';

export const Route = createFileRoute('/settings-data')({
  component: SettingsDataPage,
});

type ClearTarget = 'records' | 'files' | 'all';

function SettingsDataPage() {
  const { t } = useTranslation();
  const [target, setTarget] = useState<ClearTarget | null>(null);
  const [clearing, setClearing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<StoredDataUsage | null>(null);

  useEffect(() => {
    void getStoredDataUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);

  const clearData = async () => {
    if (!target) return;
    setClearing(true);
    setError(null);
    setSuccess(false);
    try {
      if (target !== 'files') {
        await clearStoredRecords();
        resetFavorites();
      }
      if (target !== 'records') await clearStoredFiles();
      setUsage(await getStoredDataUsage());
      setSuccess(true);
      setTarget(null);
    } catch {
      setError(t('settingsData.clearError'));
    } finally {
      setClearing(false);
    }
  };

  const cards = [
    {
      target: 'records' as const,
      title: t('settingsData.recordsTitle'),
      action: t('settingsData.clearRecords'),
      bytes: usage?.recordBytes,
      icon: ListX,
    },
    {
      target: 'files' as const,
      title: t('settingsData.filesTitle'),
      action: t('settingsData.clearFiles'),
      bytes: usage?.opfsBytes,
      icon: FileX2,
    },
  ];

  return (
    <SettingsLayout active="data" title={t('settingsData.title')}>
      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600"
          >
            <CheckCircle2 className="size-4" />
            {t('settingsData.clearSuccess')}
          </div>
        )}

        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            {cards.map((card) => (
              <div
                key={card.target}
                className="flex flex-col gap-3 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <card.icon className="size-5" />
                    {card.title}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.bytes === undefined
                      ? t('settingsData.calculating')
                      : t('settingsData.used', {
                          size: formatMediaBytes(card.bytes),
                        })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTarget(card.target)}
                >
                  {card.action}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              {t('settingsData.allTitle')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {usage
                ? t('settingsData.totalUsed', {
                    size: formatMediaBytes(usage.totalBytes),
                  })
                : t('settingsData.calculating')}
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setTarget('all')}>
              {t('settingsData.clearAll')}
            </Button>
          </CardContent>
        </Card>

        <Dialog
          open={target !== null}
          onOpenChange={(open) => {
            if (!open && !clearing) setTarget(null);
          }}
        >
          <DialogContent showCloseButton={!clearing}>
            <DialogHeader>
              <DialogTitle>{t('settingsData.confirmTitle')}</DialogTitle>
              <DialogDescription>
                {target ? t(`settingsData.confirm.${target}`) : ''}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={clearing}>
                  {t('settingsData.cancel')}
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={clearing}
                onClick={() => void clearData()}
              >
                {clearing && <LoaderCircle className="animate-spin" />}
                {clearing
                  ? t('settingsData.clearing')
                  : t('settingsData.confirmAction')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsLayout>
  );
}
