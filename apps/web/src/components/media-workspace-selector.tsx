import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
const PANELS = {
  transcript: lazy(() => import('./audio-transcription-workspace')),
  tags: lazy(() => import('./music-tag-workspace')),
  score: lazy(() => import('./sheet-music-workspace')),
  book: lazy(() => import('./photo-book-workspace')),
  sequence: lazy(() => import('./stop-motion-workspace')),
};
const Midi = lazy(() => import('./midi-composer-workspace')),
  Analysis = lazy(() => import('./audio-analysis-workspace'));
export function MediaWorkspaceSelector({
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
  const legacy =
    kind === 'score' ? 'midi' : kind === 'tags' ? 'analysis' : null;
  const Panel = PANELS[kind];
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <Tabs
          value={view === kind || view === legacy ? view : 'original'}
          onValueChange={setView}
        >
          <TabsList className="h-auto max-w-full flex-wrap">
            <TabsTrigger value="original">
              {t(`mediaWorkspace.original.${kind}`)}
            </TabsTrigger>
            {legacy && (
              <TabsTrigger value={legacy}>
                {t(`mediaEditingTools.titles.${legacy}`)}
              </TabsTrigger>
            )}
            <TabsTrigger value={kind}>
              {t(`mediaWorkspace.titles.${kind}`)}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === kind || view === legacy ? (
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          <h1 className="text-2xl font-bold">
            {t(
              view === kind
                ? `mediaWorkspace.titles.${kind}`
                : `mediaEditingTools.titles.${legacy}`,
            )}
          </h1>
          <Suspense
            fallback={<p role="status">{t('mediaWorkspace.processing')}</p>}
          >
            {view === kind ? (
              <Panel />
            ) : legacy === 'midi' ? (
              <Midi />
            ) : (
              <Analysis />
            )}
          </Suspense>
        </div>
      ) : (
        original
      )}
    </>
  );
}
