import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
const Photo = lazy(() => import('./batch4-media-photo'));
const Storyboard = lazy(() => import('./batch4-media-storyboard'));
const Midi = lazy(() => import('./batch4-media-midi'));
const Analysis = lazy(() => import('./batch4-media-analysis'));
const Gcode = lazy(() => import('./batch4-media-gcode'));
const PANELS = {
  photo: Photo,
  storyboard: Storyboard,
  midi: Midi,
  analysis: Analysis,
  gcode: Gcode,
};
export function MediaWorkspace({
  kind,
  original,
}: {
  kind: keyof typeof PANELS;
  original: ReactNode;
}) {
  const { t } = useTranslation();
  const [view, setView] = useQueryParam<string>(
    'workbench',
    StringParam,
    'original',
  );
  const Panel = PANELS[kind];
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <Tabs value={view === kind ? kind : 'original'} onValueChange={setView}>
          <TabsList className="h-auto max-w-full flex-wrap">
            <TabsTrigger value="original">
              {t(`batch4Media.original.${kind}`)}
            </TabsTrigger>
            <TabsTrigger value={kind}>
              {t(`batch4Media.titles.${kind}`)}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === kind ? (
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          <h1 className="text-2xl font-bold">
            {t(`batch4Media.titles.${kind}`)}
          </h1>
          <Suspense fallback={<p role="status">{t('batch4Media.loading')}</p>}>
            <Panel />
          </Suspense>
        </div>
      ) : (
        original
      )}
    </>
  );
}
