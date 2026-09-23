import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
export function LifeWorkspace({
  label,
  panel,
  children,
}: {
  label: string;
  panel: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useQueryParam<string>(
    'workspace',
    StringParam,
    'original',
  );
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <Tabs
          value={workspace === 'expanded' ? 'expanded' : 'original'}
          onValueChange={setWorkspace}
        >
          <TabsList className="h-auto max-w-full flex-wrap">
            <TabsTrigger value="original">
              {t('lifeWorkspace.original')}
            </TabsTrigger>
            <TabsTrigger value="expanded">{t(label)}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {workspace === 'expanded' ? panel : children}
    </>
  );
}
export function LifeError({ error }: { error: string | null }) {
  const { t } = useTranslation();
  return error ? (
    <p
      role="alert"
      className="rounded border border-destructive/30 p-3 text-sm text-destructive"
    >
      {t(`lifeWorkspace.${error}`, { defaultValue: t('lifeWorkspace.invalid') })}
    </p>
  ) : null;
}
export function LifePrint({
  title,
  lines,
  filename = 'document.pdf',
}: {
  title: string;
  lines: string[];
  filename?: string;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={busy || !lines.length}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await document.fonts.ready;
            const { studySheet, printLines, sheetImages, exportStudyPdf } =
              await import('@/lib/study-print');
            const images: string[] = [];
            let sheet = studySheet(),
              y = 15;
            const add = (text: string, size = 3.4) => {
              for (const line of printLines(sheet.context, text, 180, size)) {
                if (y > 280) {
                  images.push(...sheetImages([sheet]));
                  if (images.length > 100) throw Error('pages');
                  sheet = studySheet();
                  y = 15;
                }
                sheet.context.fillText(line, 15, y);
                y += size * 1.6;
              }
            };
            add(title, 5);
            y += 4;
            for (const line of lines) {
              add(line);
              y += 2;
            }
            images.push(...sheetImages([sheet]));
            if (images.length > 100) throw Error('pages');
            await exportStudyPdf(images, filename);
          } catch {
            setError('exportError');
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(busy ? 'lifeWorkspace.working' : 'lifeWorkspace.print')}
      </Button>
      <LifeError error={error} />
    </div>
  );
}
