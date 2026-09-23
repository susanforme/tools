import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
const Photo = lazy(() => import('./photo-culling-workspace'));
const Storyboard = lazy(() => import('./video-storyboard-workspace'));
const Midi = lazy(() => import('./midi-composer-workspace'));
const Analysis = lazy(() => import('./audio-analysis-workspace'));
const Gcode = lazy(() => import('./gcode-viewer-workspace'));
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
              {t(`mediaEditingTools.original.${kind}`)}
            </TabsTrigger>
            <TabsTrigger value={kind}>
              {t(`mediaEditingTools.titles.${kind}`)}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === kind ? (
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          <h1 className="text-2xl font-bold">
            {t(`mediaEditingTools.titles.${kind}`)}
          </h1>
          <Suspense fallback={<p role="status">{t('mediaEditingTools.loading')}</p>}>
            <Panel />
          </Suspense>
        </div>
      ) : (
        original
      )}
    </>
  );
}
