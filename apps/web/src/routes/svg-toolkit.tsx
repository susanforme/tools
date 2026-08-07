import { CodePanel } from '@/components/code-panel';
import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import {
  createSvgSprite,
  sanitizeSvg,
  svgToDataUri,
  svgToReactComponent,
} from '@/lib/svg-tools';
import { createFileRoute } from '@tanstack/react-router';
import { FileCode2, LoaderCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/svg-toolkit')({
  component: SvgToolkitPage,
});
type Mode = 'optimize' | 'data-uri' | 'react' | 'sprite';
type SvgFile = { name: string; source: string };

const SAMPLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#2563eb"/></svg>';

function SvgToolkitPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'optimize');
  const [input, setInput] = useState(SAMPLE);
  const [files, setFiles] = useState<SvgFile[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const preview = useMemo(() => {
    try {
      return svgToDataUri(
        sanitizeSvg(output.startsWith('<svg') ? output : input),
      );
    } catch {
      return '';
    }
  }, [input, output]);

  async function importFiles(next: File[]) {
    const loaded = await Promise.all(
      next.map(async (file) => ({
        name: file.name,
        source: await file.text(),
      })),
    );
    setFiles(loaded);
    if (loaded[0]) setInput(loaded[0].source);
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'optimize') {
        const { optimize } = await import('svgo/browser');
        setOutput(optimize(input, { multipass: true }).data);
      } else if (mode === 'data-uri') setOutput(svgToDataUri(input));
      else if (mode === 'sprite')
        setOutput(
          createSvgSprite(
            files.length ? files : [{ name: 'icon.svg', source: input }],
          ),
        );
      else setOutput(svgToReactComponent(input));
    } catch (cause) {
      setError(t('svgToolkit.failed', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('svgToolkit.title')}</h1>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="optimize">{t('svgToolkit.optimize')}</TabsTrigger>
          <TabsTrigger value="data-uri">Data URI</TabsTrigger>
          <TabsTrigger value="react">React JSX</TabsTrigger>
          <TabsTrigger value="sprite">Sprite</TabsTrigger>
        </TabsList>
      </Tabs>
      <FileDropzone
        accept=".svg,image/svg+xml"
        multiple
        onFiles={(items) => void importFiles(items.map((item) => item.file))}
        className="flex min-h-24 items-center justify-center rounded-xl p-4 text-center"
      >
        <div>
          <FileCode2 className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          {t('svgToolkit.drop')}
        </div>
      </FileDropzone>
      <div className="flex items-center justify-between gap-3">
        <Button disabled={loading} onClick={() => void run()}>
          {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t('svgToolkit.run')}
        </Button>
        <img
          src={preview}
          alt={t('svgToolkit.preview')}
          className="h-20 w-20 rounded-lg border bg-white object-contain p-2"
        />
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        error={error}
        language="xml"
        outputLanguage={mode === 'react' ? 'typescript' : 'xml'}
      />
    </div>
  );
}
