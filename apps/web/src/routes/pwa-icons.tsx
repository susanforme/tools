import { FileDropzone } from '@/components/file-dropzone';
import { MonacoTextEditor } from '@/components/monaco-editor';
import { ManifestAuditPanel } from '@/components/modern-web-tool-panels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import { createPngIco } from '@/lib/pwa-icons';
import { createFileRoute } from '@tanstack/react-router';
import { AppWindow, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/pwa-icons')({ component: PwaIconsPage });
type GeneratedIcon = { name: string; blob: Blob; url: string };

async function renderIcon(
  source: ImageBitmap,
  size: number,
  background: string | null,
  padding = 0,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.clearRect(0, 0, size, size);
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, size, size);
  }
  const available = size * (1 - padding * 2);
  const scale = Math.min(available / source.width, available / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  context.drawImage(
    source,
    (size - width) / 2,
    (size - height) / 2,
    width,
    height,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('PNG generation failed')),
      'image/png',
    ),
  );
}

function PwaIconsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<'icons' | 'audit'>(
    'tab',
    StringParam,
    'icons',
  );
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [name, setName] = useState('Breeze Tools');
  const [shortName, setShortName] = useState('Tools');
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [icons, setIcons] = useState<GeneratedIcon[]>([]);
  const [manifest, setManifest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => icons.forEach((icon) => URL.revokeObjectURL(icon.url)),
    [icons],
  );

  async function load(file: File) {
    try {
      const bitmap = await createImageBitmap(file);
      source?.close();
      setSource(bitmap);
      setError(null);
    } catch (cause) {
      setError(t('pwaIcons.failed', { msg: (cause as Error).message }));
    }
  }
  async function generate() {
    if (!source) return;
    setLoading(true);
    setError(null);
    try {
      const specs = [
        { name: 'favicon-32x32.png', size: 32, background: null, padding: 0 },
        {
          name: 'apple-touch-icon.png',
          size: 180,
          background: backgroundColor,
          padding: 0.1,
        },
        {
          name: 'icon-192.png',
          size: 192,
          background: backgroundColor,
          padding: 0.05,
        },
        {
          name: 'icon-512.png',
          size: 512,
          background: backgroundColor,
          padding: 0.05,
        },
        {
          name: 'icon-maskable-512.png',
          size: 512,
          background: backgroundColor,
          padding: 0.2,
        },
      ] as const;
      const blobs: Array<{ name: string; blob: Blob }> = await Promise.all(
        specs.map(async (spec) => ({
          name: spec.name,
          blob: await renderIcon(
            source,
            spec.size,
            spec.background,
            spec.padding,
          ),
        })),
      );
      const faviconPng = new Uint8Array(await blobs[0]!.blob.arrayBuffer());
      blobs.push({
        name: 'favicon.ico',
        blob: new Blob([createPngIco(faviconPng, 32, 32).buffer], {
          type: 'image/x-icon',
        }),
      });
      icons.forEach((icon) => URL.revokeObjectURL(icon.url));
      setIcons(
        blobs.map((item) => ({ ...item, url: URL.createObjectURL(item.blob) })),
      );
      setManifest(
        JSON.stringify(
          {
            name,
            short_name: shortName,
            start_url: '/',
            display: 'standalone',
            theme_color: themeColor,
            background_color: backgroundColor,
            icons: [
              { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
              {
                src: '/icon-maskable-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          null,
          2,
        ),
      );
    } catch (cause) {
      setError(t('pwaIcons.failed', { msg: (cause as Error).message }));
    } finally {
      setLoading(false);
    }
  }
  async function download() {
    const { zipSync, strToU8 } = await import('fflate');
    const files: Record<string, Uint8Array> = {
      'manifest.webmanifest': strToU8(manifest),
    };
    for (const icon of icons)
      files[icon.name] = new Uint8Array(await icon.blob.arrayBuffer());
    downloadBlob(
      new Blob([zipSync(files)], { type: 'application/zip' }),
      'pwa-assets.zip',
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('pwaIcons.title')}</h1>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'icons' | 'audit')}
      >
        <TabsList>
          <TabsTrigger value="icons">{t('modern.iconGenerator')}</TabsTrigger>
          <TabsTrigger value="audit">{t('modern.manifestAudit')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'audit' ? (
        <ManifestAuditPanel />
      ) : (
        <>
          <FileDropzone
            accept="image/*"
            onFiles={(files) => files[0] && void load(files[0].file)}
            className="flex min-h-28 items-center justify-center rounded-xl p-4 text-center"
          >
            <div>
              <AppWindow className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              {t('pwaIcons.drop')}
            </div>
          </FileDropzone>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>{t('pwaIcons.name')}</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pwaIcons.shortName')}</Label>
              <Input
                value={shortName}
                onChange={(event) => setShortName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pwaIcons.theme')}</Label>
              <Input
                type="color"
                value={themeColor}
                onChange={(event) => setThemeColor(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pwaIcons.background')}</Label>
              <Input
                type="color"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!source || loading}
              onClick={() => void generate()}
            >
              {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t('pwaIcons.generate')}
            </Button>
            <Button
              variant="outline"
              disabled={!icons.length}
              onClick={() => void download()}
            >
              {t('pwaIcons.download')}
            </Button>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid grid-cols-3 gap-3">
              {icons
                .filter((icon) => icon.name.endsWith('.png'))
                .map((icon) => (
                  <div
                    key={icon.name}
                    className="rounded-xl border p-3 text-center"
                  >
                    <img
                      src={icon.url}
                      alt=""
                      className={`mx-auto h-24 w-24 object-contain ${icon.name.includes('maskable') ? 'rounded-full' : ''}`}
                    />
                    <div className="mt-2 truncate text-xs">{icon.name}</div>
                  </div>
                ))}
            </div>
            <MonacoTextEditor
              readOnly
              label="manifest.webmanifest"
              language="json"
              height="420px"
              value={manifest}
            />
          </div>
        </>
      )}
    </div>
  );
}
