import { MediaWorkspace } from '@/components/media-workspace-switcher';
import { NumberField } from '@/components/calculator-ui';
import type { ModelMeasurement } from '@/lib/media-model';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  NumberParam,
  StringParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
import { sampleGltf } from '@/lib/gltf-inspector';
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelStats } from '@/components/gltf-scene';

const Scene = lazy(() => import('@/components/gltf-scene'));
export const Route = createFileRoute('/gltf-inspector')({
  component: () => (
    <MediaWorkspace kind="gcode" original={<GltfInspectorPage />} />
  ),
});
function GltfInspectorPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useQueryParams<{
    wireframe: string;
    play: string;
    scale: number;
  }>({ wireframe: StringParam, play: StringParam, scale: NumberParam });
  const [measurement, setMeasurement] = useState<ModelMeasurement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [main, setMain] = useState('');
  const [active, setActive] = useState<{ files: File[]; main: string } | null>(
    null,
  );
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  function choose(next: File[]) {
    setActive(null);
    setStats(null);
    setMeasurement(null);
    setError(null);
    setFiles([]);
    setMain('');
    if (
      next.length > 100 ||
      next.reduce((sum, file) => sum + file.size, 0) > 30 * 1024 * 1024
    ) {
      setError('LIMIT');
      return;
    }
    const names = next.map((file) => file.webkitRelativePath || file.name);
    if (new Set(names).size !== names.length) {
      setError('INVALID');
      return;
    }
    setFiles(next);
    setMain(
      next.find((file) => /\.(glb|gltf|stl|obj)$/i.test(file.name))?.name ?? '',
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('mediaWorkflow.models')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('mediaWorkflow.modelLimit')}
      </p>
      <Label htmlFor="gltf-files">{t('mediaWorkflow.modelUpload')}</Label>
      <Input
        id="gltf-files"
        type="file"
        multiple
        onChange={(e) => {
          choose(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      {files.length > 0 && (
        <div className="space-y-2">
          <Label>{t('communityVisual.model.file')}</Label>
          <Select
            value={main}
            onValueChange={(value) => {
              setActive(null);
              setStats(null);
              setMeasurement(null);
              setMain(value);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {files
                .filter((file) => /\.(glb|gltf|stl|obj)$/i.test(file.name))
                .map((file) => (
                  <SelectItem value={file.name} key={file.name}>
                    {file.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!main}
          onClick={() => {
            setActive({ files: [...files], main });
          }}
        >
          {t('communityVisual.model.inspect')}
        </Button>
        <Button variant="outline" onClick={() => choose([sampleGltf()])}>
          {t('communityVisual.sample')}
        </Button>
        <Button variant="outline" onClick={() => choose([])}>
          {t('communityVisual.clear')}
        </Button>
        <Label
          htmlFor="model-wireframe"
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox
            id="model-wireframe"
            checked={query.wireframe === 'true'}
            onCheckedChange={(value) =>
              setQuery({ wireframe: String(value === true) })
            }
          />
          {t('communityVisual.model.wireframe')}
        </Label>
        <Label htmlFor="model-play" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="model-play"
            checked={query.play === 'true'}
            onCheckedChange={(value) =>
              setQuery({ play: String(value === true) })
            }
          />
          {t('communityVisual.model.play')}
        </Label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('communityVisual.failed', {
            msg: t(`communityVisual.errors.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
      <NumberField
        label={t('mediaWorkflow.scale')}
        value={query.scale ?? 1}
        min={0.000001}
        max={1000000}
        onChange={(scale) => setQuery({ scale })}
      />
      {active && (
        <Suspense
          fallback={<p role="status">{t('communityVisual.loading')}</p>}
        >
          <Scene
            key={active.main}
            files={active.files}
            main={active.main}
            wireframe={query.wireframe === 'true'}
            play={query.play === 'true'}
            onStats={setStats}
            scale={query.scale ?? 1}
            onMeasure={setMeasurement}
          />
        </Suspense>
      )}
      {measurement && (
        <div className="grid gap-3 md:grid-cols-3">
          <p>
            {t('mediaWorkflow.dimensions')}:{' '}
            {measurement.dimensions.map((n) => n.toPrecision(6)).join(' × ')}
          </p>
          <p>
            {t('mediaWorkflow.area')}: {measurement.area.toPrecision(6)}
          </p>
          <p>
            {t('mediaWorkflow.volume')}:{' '}
            {measurement.volume?.toPrecision(6) ?? t('mediaWorkflow.notClosed')}
          </p>
        </div>
      )}
      {stats && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(stats) as (keyof ModelStats)[]).map((key) => (
            <div className="rounded-md border p-3" key={key}>
              <dt className="text-sm text-muted-foreground">
                {t(`communityVisual.model.${key}`)}
              </dt>
              <dd className="font-mono text-xl">
                {stats[key].toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
