import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { lazy, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

const PANELS = {
  response: lazy(() =>
    import('./tool-extensions/developer-data').then((module) => ({
      default: module.ResponseValidator,
    })),
  ),
  join: lazy(() =>
    import('./tool-extensions/developer-data').then((module) => ({
      default: module.TableJoiner,
    })),
  ),
  profile: lazy(() =>
    import('./tool-extensions/developer-data').then((module) => ({
      default: module.DatasetProfiler,
    })),
  ),
  secrets: lazy(() =>
    import('./tool-extensions/developer-data').then((module) => ({
      default: module.SecretScanner,
    })),
  ),
  thirdParty: lazy(() =>
    import('./tool-extensions/developer-data').then((module) => ({
      default: module.ThirdPartyInventory,
    })),
  ),
  morph: lazy(() =>
    import('./tool-extensions/creative-media').then((module) => ({
      default: module.SvgMorph,
    })),
  ),
  subset: lazy(() =>
    import('./tool-extensions/creative-media').then((module) => ({
      default: module.FontSubset,
    })),
  ),
  loudness: lazy(() =>
    import('./tool-extensions/creative-media').then((module) => ({
      default: module.LoudnessMeter,
    })),
  ),
  subtitleQc: lazy(() =>
    import('./tool-extensions/creative-media').then((module) => ({
      default: module.SubtitleQuality,
    })),
  ),
  pdfAccess: lazy(() =>
    import('./tool-extensions/documents-office').then((module) => ({
      default: module.PdfAccessibility,
    })),
  ),
  epubAccess: lazy(() =>
    import('./tool-extensions/documents-office').then((module) => ({
      default: module.EpubAccessibility,
    })),
  ),
  survey: lazy(() =>
    import('./tool-extensions/documents-office').then((module) => ({
      default: module.SurveyAnalyzer,
    })),
  ),
  capacity: lazy(() =>
    import('./tool-extensions/documents-office').then((module) => ({
      default: module.CapacityPlanner,
    })),
  ),
  elevation: lazy(() =>
    import('./tool-extensions/geo-device').then((module) => ({
      default: module.ElevationProfile,
    })),
  ),
  coordinates: lazy(() =>
    import('./tool-extensions/geo-device').then((module) => ({
      default: module.CoordinateConverter,
    })),
  ),
  midi: lazy(() =>
    import('./tool-extensions/geo-device').then((module) => ({
      default: module.MidiMonitor,
    })),
  ),
} as const;

type PanelId = keyof typeof PANELS;

export function ToolExtensionSelector({
  base,
  panels,
}: {
  base: ReactNode;
  panels: readonly PanelId[];
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useQueryParam<string>(
    'extension',
    StringParam,
    'original',
  );
  const active = panels.includes(selected as PanelId)
    ? (selected as PanelId)
    : null;
  const Panel = active ? PANELS[active] : null;
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-5">
        <Tabs value={active ?? 'original'} onValueChange={setSelected}>
          <TabsList className="h-auto max-w-full flex-wrap">
            <TabsTrigger value="original">{t('newTools.original')}</TabsTrigger>
            {panels.map((id) => (
              <TabsTrigger key={id} value={id}>
                {t(`newTools.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {Panel ? (
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
          <h1 className="text-2xl font-bold">{t(`newTools.${active}`)}</h1>
          <Suspense fallback={<p role="status">{t('newTools.loading')}</p>}>
            <Panel />
          </Suspense>
        </div>
      ) : (
        base
      )}
    </>
  );
}
