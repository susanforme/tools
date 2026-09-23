import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '@/lib/download';
import { Button } from './ui/button';
export function AnalysisFrame({
  tool,
  children,
  error,
}: {
  tool: string;
  children: ReactNode;
  error?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">{t(`analysis3.${tool}.title`)}</h1>
      {children}
      {error && (
        <p
          role="alert"
          className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {t('analysis3.error', {
            message: t(`analysis3.${error}`, { defaultValue: error }),
          })}
        </p>
      )}
    </main>
  );
}
export async function svgPng(svg: SVGSVGElement): Promise<Blob> {
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml',
  });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = Math.ceil(
      (1600 * svg.viewBox.baseVal.height) / svg.viewBox.baseVal.width,
    );
    if (canvas.height > 8000) throw new Error('sizeLimit');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('canvas'))),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function SvgDownloads({
  svg,
  name,
  onError,
}: {
  svg: () => SVGSVGElement | null;
  name: string;
  onError: (error: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => {
          const node = svg();
          if (node)
            downloadBlob(
              new Blob([new XMLSerializer().serializeToString(node)], {
                type: 'image/svg+xml',
              }),
              `${name}.svg`,
            );
        }}
      >
        SVG
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            const node = svg();
            if (node) downloadBlob(await svgPng(node), `${name}.png`);
          } catch (cause) {
            onError((cause as Error).message);
          }
        }}
      >
        PNG
      </Button>
    </div>
  );
}
