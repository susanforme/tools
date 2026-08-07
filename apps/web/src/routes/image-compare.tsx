import { FileDropzone } from '@/components/file-dropzone';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { downloadBlob } from '@/lib/download';
import { createPixelDiff } from '@/lib/image-diff';
import { createFileRoute } from '@tanstack/react-router';
import { Images } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/image-compare')({
  component: ImageComparePage,
});
type Mode = 'slider' | 'blink' | 'diff' | 'heatmap';

function ImageComparePage() {
  const { t } = useTranslation();
  const [mode, setMode] = useQueryParam<Mode>('mode', StringParam, 'slider');
  const [first, setFirst] = useState<ImageBitmap | null>(null);
  const [second, setSecond] = useState<ImageBitmap | null>(null);
  const [position, setPosition] = useState(50);
  const [blink, setBlink] = useState(false);
  const [changed, setChanged] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (mode !== 'blink' || !first || !second) return;
    const timer = window.setInterval(() => setBlink((value) => !value), 500);
    return () => window.clearInterval(timer);
  }, [mode, first, second]);
  useEffect(() => {
    if (!first || !second || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = Math.max(first.width, second.width);
    canvas.height = Math.max(first.height, second.height);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(first, 0, 0);
    if (mode === 'slider') {
      context.save();
      context.beginPath();
      context.rect(0, 0, (canvas.width * position) / 100, canvas.height);
      context.clip();
      context.drawImage(second, 0, 0);
      context.restore();
      setChanged(null);
    } else if (mode === 'blink') {
      if (blink) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(second, 0, 0);
      }
      setChanged(null);
    } else {
      const firstData = context.getImageData(0, 0, canvas.width, canvas.height);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(second, 0, 0);
      const secondData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const result = createPixelDiff(firstData, secondData, mode === 'heatmap');
      context.putImageData(result.image, 0, 0);
      setChanged((result.changed / result.total) * 100);
    }
  }, [first, second, mode, position, blink]);

  async function load(file: File, side: 'first' | 'second') {
    setError(null);
    try {
      const bitmap = await createImageBitmap(file);
      if (side === 'first')
        setFirst((previous) => {
          previous?.close();
          return bitmap;
        });
      else
        setSecond((previous) => {
          previous?.close();
          return bitmap;
        });
    } catch (cause) {
      setError(t('imageCompare.failed', { msg: (cause as Error).message }));
    }
  }
  function download() {
    canvasRef.current?.toBlob(
      (blob) => blob && downloadBlob(blob, 'image-difference.png'),
      'image/png',
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('imageCompare.title')}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {(['first', 'second'] as const).map((side) => (
          <FileDropzone
            key={side}
            accept="image/*"
            onFiles={(files) => files[0] && void load(files[0].file, side)}
            className="flex min-h-28 items-center justify-center rounded-xl p-4 text-center"
          >
            <div>
              <Images className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              {t(`imageCompare.${side}`)}
            </div>
          </FileDropzone>
        ))}
      </div>
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList>
          <TabsTrigger value="slider">{t('imageCompare.slider')}</TabsTrigger>
          <TabsTrigger value="blink">{t('imageCompare.blink')}</TabsTrigger>
          <TabsTrigger value="diff">{t('imageCompare.diff')}</TabsTrigger>
          <TabsTrigger value="heatmap">{t('imageCompare.heatmap')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === 'slider' && (
        <Slider
          value={[position]}
          min={0}
          max={100}
          step={1}
          onValueChange={(value) => setPosition(value[0] ?? 50)}
        />
      )}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {first && second && (
        <>
          <div className="overflow-auto rounded-xl border bg-muted p-2">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={t('imageCompare.title')}
              className="mx-auto max-h-[70vh] max-w-full"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {changed === null
                ? ''
                : t('imageCompare.changed', { value: changed.toFixed(2) })}
            </span>
            <Button variant="outline" onClick={download}>
              {t('imageCompare.download')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
