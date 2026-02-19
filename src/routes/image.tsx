import { createFileRoute } from '@tanstack/react-router';
import {
  Check,
  Copy,
  Download,
  ImageIcon,
  Maximize2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/image')({ component: ImageToolPage });

// ─── shared types ──────────────────────────────────────────────────────────

type UploadedImage = {
  file: File;
  url: string;
  width: number;
  height: number;
};

// ─── helpers ───────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob returned null'));
      },
      mime,
      quality,
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── ImageLightbox ─────────────────────────────────────────────────────────

function ImageLightbox({
  src,
  alt,
  children,
}: {
  src: string;
  alt?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="relative group cursor-zoom-in"
        onClick={() => setOpen(true)}
      >
        {children}
        {/* 放大提示遮罩 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-[inherit]">
          <Maximize2 className="w-6 h-6 text-white drop-shadow" />
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center overflow-hidden">
          <DialogTitle className="sr-only">{alt ?? '图片预览'}</DialogTitle>
          <img
            src={src}
            alt={alt ?? '图片预览'}
            className="max-w-full max-h-[85vh] object-contain rounded"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── ImageUploader ─────────────────────────────────────────────────────────

function ImageUploader({
  image,
  onChange,
  onClear,
}: {
  image: UploadedImage | null;
  onChange: (img: UploadedImage) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        onChange({
          file,
          url,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = url;
    },
    [onChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (image) {
    return (
      <div className="relative border rounded-lg overflow-hidden bg-muted/30">
        <ImageLightbox src={image.url} alt={t('imageTool.convert.imgAlt')}>
          <img
            src={image.url}
            alt={t('imageTool.convert.imgAlt')}
            className="max-h-48 w-full object-contain"
          />
        </ImageLightbox>
        <div className="px-3 py-2 flex items-center justify-between text-xs text-muted-foreground border-t">
          <span>
            {image.file.name} — {image.width}×{image.height} —{' '}
            {formatBytes(image.file.size)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="w-6 h-6"
            onClick={onClear}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 py-12 cursor-pointer transition-colors ${
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <UploadCloud className="w-8 h-8 text-muted-foreground" />
      <p className="text-sm font-medium">{t('imageTool.uploadHint')}</p>
      <p className="text-xs text-muted-foreground">
        {t('imageTool.uploadHintSub')}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── ConvertTab ────────────────────────────────────────────────────────────

function ConvertTab() {
  const { t } = useTranslation();
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [format, setFormat] = useState<'webp' | 'avif'>('webp');
  const [quality, setQuality] = useState(80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    blob: Blob;
    url: string;
    size: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const convert = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const img = await loadImage(image.url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');
      ctx.drawImage(img, 0, 0);
      const mime = format === 'avif' ? 'image/avif' : 'image/webp';
      const blob = await canvasToBlob(canvas, mime, quality / 100);
      if (result) URL.revokeObjectURL(result.url);
      setResult({ blob, url: URL.createObjectURL(blob), size: blob.size });
    } catch (e) {
      setError(
        t('imageTool.convert.convertError', { msg: (e as Error).message }),
      );
    } finally {
      setLoading(false);
    }
  };

  const savedPct =
    result && image ? Math.round((1 - result.size / image.file.size) * 100) : 0;

  const baseName = image?.file.name.replace(/\.[^.]+$/, '') ?? 'image';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('imageTool.convert.desc')}
      </p>
      <ImageUploader
        image={image}
        onChange={setImage}
        onClear={() => {
          setImage(null);
          setResult(null);
          setError(null);
        }}
      />

      {/* 格式与质量 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('imageTool.convert.outputFormat')}</Label>
          <div className="flex gap-2">
            {(['webp', 'avif'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={format === f ? 'default' : 'outline'}
                onClick={() => setFormat(f)}
              >
                {f.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>
            {t('imageTool.convert.quality')}：{quality}
          </Label>
          <Slider
            min={10}
            max={100}
            step={5}
            value={[quality]}
            onValueChange={([v]) => setQuality(v)}
          />
          <p className="text-xs text-muted-foreground">
            {t('imageTool.convert.qualityHint')}
          </p>
        </div>
      </div>

      <Button size="sm" onClick={convert} disabled={!image || loading}>
        {loading ? t('imageTool.processing') : t('imageTool.convert.convert')}
      </Button>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* 结果 */}
      {result && image && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t('imageTool.convert.original')}
            </p>
            <ImageLightbox src={image.url} alt={t('imageTool.convert.imgAlt')}>
              <img
                src={image.url}
                alt={t('imageTool.convert.imgAlt')}
                className="w-full rounded-md border object-contain max-h-40"
              />
            </ImageLightbox>
            <p className="text-xs text-muted-foreground">
              {t('imageTool.convert.originalSize')}：
              {formatBytes(image.file.size)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t('imageTool.convert.result')}
            </p>
            <ImageLightbox src={result.url} alt={t('imageTool.convert.imgAlt')}>
              <img
                src={result.url}
                alt={t('imageTool.convert.imgAlt')}
                className="w-full rounded-md border object-contain max-h-40"
              />
            </ImageLightbox>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {t('imageTool.convert.outputSize')}：{formatBytes(result.size)}
              </p>
              {savedPct > 0 && (
                <span className="text-xs text-green-600 font-medium">
                  {t('imageTool.convert.saved', { pct: savedPct })}
                </span>
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button
              size="sm"
              onClick={() => downloadBlob(result.blob, `${baseName}.${format}`)}
            >
              <Download className="w-4 h-4 mr-1" />
              {t('imageTool.download')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Base64Tab ─────────────────────────────────────────────────────────────

function Base64Tab() {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<'encode' | 'decode'>('encode');

  // encode side
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [b64Result, setB64Result] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // decode side
  const [b64Input, setB64Input] = useState('');
  const [decodeUrl, setDecodeUrl] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const encode = () => {
    if (!image) return;
    setEncodeError(null);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setB64Result(reader.result as string);
      };
      reader.onerror = () =>
        setEncodeError(
          t('imageTool.base64.encodeError', { msg: 'FileReader failed' }),
        );
      reader.readAsDataURL(image.file);
    } catch (e) {
      setEncodeError(
        t('imageTool.base64.encodeError', { msg: (e as Error).message }),
      );
    }
  };

  const decode = () => {
    setDecodeError(null);
    setDecodeUrl(null);
    try {
      const raw = b64Input.trim();
      if (!raw) return;
      // 支持 data URI 或裸 base64
      const src = raw.startsWith('data:')
        ? raw
        : `data:image/png;base64,${raw}`;
      const img = new Image();
      img.onload = () => setDecodeUrl(src);
      img.onerror = () =>
        setDecodeError(
          t('imageTool.base64.decodeError', { msg: 'Invalid Base64' }),
        );
      img.src = src;
    } catch (e) {
      setDecodeError(
        t('imageTool.base64.decodeError', { msg: (e as Error).message }),
      );
    }
  };

  const copyB64 = async () => {
    if (!b64Result) return;
    await navigator.clipboard.writeText(b64Result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('imageTool.base64.desc')}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={subTab === 'encode' ? 'default' : 'outline'}
          onClick={() => setSubTab('encode')}
        >
          {t('imageTool.base64.tabImgToB64')}
        </Button>
        <Button
          size="sm"
          variant={subTab === 'decode' ? 'default' : 'outline'}
          onClick={() => setSubTab('decode')}
        >
          {t('imageTool.base64.tabB64ToImg')}
        </Button>
      </div>

      {subTab === 'encode' && (
        <div className="space-y-4">
          <ImageUploader
            image={image}
            onChange={setImage}
            onClear={() => {
              setImage(null);
              setB64Result(null);
              setEncodeError(null);
            }}
          />
          <Button size="sm" onClick={encode} disabled={!image}>
            {t('imageTool.base64.encode')}
          </Button>
          {encodeError && (
            <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {encodeError}
            </div>
          )}
          {b64Result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('imageTool.base64.result')}</Label>
                <Button size="sm" variant="outline" onClick={copyB64}>
                  {copied ? (
                    <Check className="w-4 h-4 mr-1" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {copied
                    ? t('imageTool.copied')
                    : t('imageTool.base64.copyBase64')}
                </Button>
              </div>
              <Textarea
                readOnly
                value={b64Result}
                rows={5}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>
      )}

      {subTab === 'decode' && (
        <div className="space-y-4">
          <Textarea
            value={b64Input}
            onChange={(e) => setB64Input(e.target.value)}
            placeholder={t('imageTool.base64.b64Placeholder')}
            rows={5}
            className="font-mono text-xs"
          />
          <Button size="sm" onClick={decode} disabled={!b64Input.trim()}>
            {t('imageTool.base64.decode')}
          </Button>
          {decodeError && (
            <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {decodeError}
            </div>
          )}
          {decodeUrl && (
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              <ImageLightbox src={decodeUrl} alt={t('imageTool.base64.imgAlt')}>
                <img
                  src={decodeUrl}
                  alt={t('imageTool.base64.imgAlt')}
                  className="max-h-64 w-full object-contain"
                />
              </ImageLightbox>
              <div className="px-3 py-2 border-t">
                <Button
                  size="sm"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = decodeUrl;
                    a.download = 'decoded-image.png';
                    a.click();
                  }}
                >
                  <Download className="w-4 h-4 mr-1" />
                  {t('imageTool.download')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CropTab ───────────────────────────────────────────────────────────────

const RATIOS = [
  { label: '16:9', w: 16, h: 9 },
  { label: '4:3', w: 4, h: 3 },
  { label: '3:2', w: 3, h: 2 },
  { label: '1:1', w: 1, h: 1 },
  { label: '9:16', w: 9, h: 16 },
  { label: '21:9', w: 21, h: 9 },
] as const;

type RatioKey = (typeof RATIOS)[number]['label'] | 'free';

function CropTab() {
  const { t } = useTranslation();
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [ratio, setRatio] = useState<RatioKey>('16:9');
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasLightbox, setCanvasLightbox] = useState(false);

  // 裁剪参数（基于图片内容）
  const getCropRect = useCallback(
    (
      imgW: number,
      imgH: number,
    ): { x: number; y: number; w: number; h: number } => {
      if (ratio === 'free') {
        const w = parseInt(customW) || imgW;
        const h = parseInt(customH) || imgH;
        const scale = Math.min(imgW / w, imgH / h, 1);
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);
        return {
          x: Math.round((imgW - cw) / 2),
          y: Math.round((imgH - ch) / 2),
          w: cw,
          h: ch,
        };
      }
      const found = RATIOS.find((r) => r.label === ratio);
      const rw = found?.w ?? 16;
      const rh = found?.h ?? 9;
      let cw = imgW;
      let ch = Math.round((imgW * rh) / rw);
      if (ch > imgH) {
        ch = imgH;
        cw = Math.round((imgH * rw) / rh);
      }
      return {
        x: Math.round((imgW - cw) / 2),
        y: Math.round((imgH - ch) / 2),
        w: cw,
        h: ch,
      };
    },
    [ratio, customW, customH],
  );

  // 预览
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const { x, y, w, h } = getCropRect(img.naturalWidth, img.naturalHeight);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
    };
    img.src = image.url;
  }, [image, getCropRect]);

  const crop = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const img = await loadImage(image.url);
      const { x, y, w, h } = getCropRect(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      const blob = await canvasToBlob(canvas, 'image/png', 1);
      const baseName = image.file.name.replace(/\.[^.]+$/, '');
      downloadBlob(blob, `${baseName}-crop.png`);
    } catch (e) {
      setError(t('imageTool.crop.cropError', { msg: (e as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('imageTool.crop.desc')}
      </p>
      <ImageUploader
        image={image}
        onChange={setImage}
        onClear={() => {
          setImage(null);
          setError(null);
        }}
      />

      <div className="space-y-2">
        <Label>{t('imageTool.crop.ratio')}</Label>
        <div className="flex flex-wrap gap-2">
          {RATIOS.map((r) => (
            <Button
              key={r.label}
              size="sm"
              variant={ratio === r.label ? 'default' : 'outline'}
              onClick={() => setRatio(r.label)}
            >
              {r.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={ratio === 'free' ? 'default' : 'outline'}
            onClick={() => setRatio('free')}
          >
            {t('imageTool.crop.ratioFree')}
          </Button>
        </div>
      </div>

      {ratio === 'free' && (
        <div className="flex gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">{t('imageTool.crop.customWidth')}</Label>
            <Input
              type="number"
              min={1}
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              {t('imageTool.crop.customHeight')}
            </Label>
            <Input
              type="number"
              min={1}
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              className="w-28"
            />
          </div>
        </div>
      )}

      {/* 预览 */}
      {image && (
        <div className="border rounded-lg overflow-hidden bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground mb-2">
            {t('imageTool.crop.imgAlt')}
          </p>
          <div
            className="relative group cursor-zoom-in mx-auto w-fit"
            onClick={() => setCanvasLightbox(true)}
          >
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-56 rounded object-contain block"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded">
              <Maximize2 className="w-6 h-6 text-white drop-shadow" />
            </div>
          </div>
          {/* Canvas 放大 Dialog */}
          <Dialog open={canvasLightbox} onOpenChange={setCanvasLightbox}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 flex items-center justify-center overflow-hidden">
              <DialogTitle className="sr-only">
                {t('imageTool.crop.imgAlt')}
              </DialogTitle>
              <img
                src={canvasRef.current?.toDataURL('image/png') ?? ''}
                alt={t('imageTool.crop.imgAlt')}
                className="max-w-full max-h-[85vh] object-contain rounded"
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Button size="sm" onClick={crop} disabled={!image || loading}>
        <Download className="w-4 h-4 mr-1" />
        {loading ? t('imageTool.processing') : t('imageTool.crop.crop')}
      </Button>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── RetinaTab ─────────────────────────────────────────────────────────────

type RetinaResult = {
  scale: 1 | 2 | 3;
  label: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
};

function RetinaTab() {
  const { t } = useTranslation();
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [baseW, setBaseW] = useState('');
  const [baseH, setBaseH] = useState('');
  const [keepRatio, setKeepRatio] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RetinaResult[]>([]);

  useEffect(() => {
    if (image && !baseW && !baseH) {
      setBaseW(String(Math.round(image.width / 3)));
      setBaseH(String(Math.round(image.height / 3)));
    }
  }, [image, baseW, baseH]);

  const handleWChange = (v: string) => {
    setBaseW(v);
    if (keepRatio && image) {
      const newW = parseInt(v) || 0;
      setBaseH(String(Math.round((newW * image.height) / image.width)));
    }
  };

  const handleHChange = (v: string) => {
    setBaseH(v);
    if (keepRatio && image) {
      const newH = parseInt(v) || 0;
      setBaseW(String(Math.round((newH * image.width) / image.height)));
    }
  };

  const generate = async () => {
    if (!image) return;
    const w1 = parseInt(baseW);
    const h1 = parseInt(baseH);
    if (!w1 || !h1) return;

    setLoading(true);
    setError(null);
    // 清理旧 URLs
    results.forEach((r) => URL.revokeObjectURL(r.url));
    setResults([]);

    try {
      const img = await loadImage(image.url);
      const scales: Array<{ scale: 1 | 2 | 3; label: string }> = [
        { scale: 1, label: '@1x' },
        { scale: 2, label: '@2x' },
        { scale: 3, label: '@3x' },
      ];
      const generated: RetinaResult[] = [];
      for (const { scale, label } of scales) {
        const w = w1 * scale;
        const h = h1 * scale;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas unavailable');
        ctx.drawImage(img, 0, 0, w, h);
        const blob = await canvasToBlob(canvas, 'image/png', 1);
        generated.push({
          scale,
          label,
          blob,
          url: URL.createObjectURL(blob),
          width: w,
          height: h,
        });
      }
      setResults(generated);
    } catch (e) {
      setError(
        t('imageTool.retina.generateError', { msg: (e as Error).message }),
      );
    } finally {
      setLoading(false);
    }
  };

  const baseName = image?.file.name.replace(/\.[^.]+$/, '') ?? 'image';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('imageTool.retina.desc')}
      </p>
      <ImageUploader
        image={image}
        onChange={(img) => {
          setImage(img);
          setBaseW('');
          setBaseH('');
          results.forEach((r) => URL.revokeObjectURL(r.url));
          setResults([]);
          setError(null);
        }}
        onClear={() => {
          setImage(null);
          setBaseW('');
          setBaseH('');
          results.forEach((r) => URL.revokeObjectURL(r.url));
          setResults([]);
          setError(null);
        }}
      />

      <div className="space-y-2">
        <Label>{t('imageTool.retina.baseSize')}</Label>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">{t('imageTool.retina.width')}</Label>
            <Input
              type="number"
              min={1}
              value={baseW}
              onChange={(e) => handleWChange(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('imageTool.retina.height')}</Label>
            <Input
              type="number"
              min={1}
              value={baseH}
              onChange={(e) => handleHChange(e.target.value)}
              className="w-28"
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none mt-4">
            <input
              type="checkbox"
              checked={keepRatio}
              onChange={(e) => setKeepRatio(e.target.checked)}
              className="accent-primary"
            />
            {t('imageTool.retina.keepRatio')}
          </label>
        </div>
      </div>

      <Button
        size="sm"
        onClick={generate}
        disabled={!image || !baseW || !baseH || loading}
      >
        {loading
          ? t('imageTool.retina.generating')
          : t('imageTool.retina.generate')}
      </Button>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {results.map((r) => (
            <div
              key={r.label}
              className="border rounded-lg overflow-hidden bg-muted/30"
            >
              <ImageLightbox src={r.url} alt={r.label}>
                <img
                  src={r.url}
                  alt={r.label}
                  className="w-full object-contain max-h-36"
                />
              </ImageLightbox>
              <div className="px-3 py-2 border-t space-y-1">
                <p className="text-xs font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {r.width}×{r.height} — {formatBytes(r.blob.size)}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    downloadBlob(r.blob, `${baseName}${r.label}.png`)
                  }
                >
                  <Download className="w-4 h-4 mr-1" />
                  {r.label === '@1x'
                    ? t('imageTool.retina.download1x')
                    : r.label === '@2x'
                      ? t('imageTool.retina.download2x')
                      : t('imageTool.retina.download3x')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SkeletonTab ───────────────────────────────────────────────────────────

type SkeletonOutputType = 'css' | 'svg';
type SkeletonAnimation = 'none' | 'pulse' | 'shimmer';

function buildCssSkeleton(
  w: number,
  h: number,
  radius: number,
  animation: SkeletonAnimation,
): string {
  const ratio = ((h / w) * 100).toFixed(4);

  const keyframes =
    animation === 'shimmer'
      ? `@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`
      : animation === 'pulse'
        ? `@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`
        : '';

  const animProp =
    animation === 'shimmer'
      ? `  animation: skeleton-shimmer 1.6s ease-in-out infinite;\n  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);\n  background-size: 400% 100%;`
      : animation === 'pulse'
        ? `  animation: skeleton-pulse 1.5s ease-in-out infinite;`
        : '';

  return `${keyframes}.skeleton {
  width: 100%;
  max-width: ${w}px;
  aspect-ratio: ${w} / ${h};
  /* 或使用 padding-bottom 兼容写法 */
  /* padding-bottom: ${ratio}%; */
  border-radius: ${radius}px;
  background-color: #e0e0e0;
${animProp}
}`;
}

function buildSvgSkeleton(
  w: number,
  h: number,
  radius: number,
  animation: SkeletonAnimation,
): string {
  const defs =
    animation === 'shimmer'
      ? `\n  <defs>\n    <linearGradient id="shimmer" x1="-1" y1="0" x2="2" y2="0">\n      <stop offset="0%" stop-color="#e0e0e0"/>\n      <stop offset="50%" stop-color="#f0f0f0"/>\n      <stop offset="100%" stop-color="#e0e0e0"/>\n      <animateTransform attributeName="gradientTransform" type="translate" from="-2 0" to="2 0" dur="1.6s" repeatCount="indefinite"/>\n    </linearGradient>\n  </defs>`
      : '';

  const fill = animation === 'shimmer' ? 'url(#shimmer)' : '#e0e0e0';

  const rectInner =
    animation === 'pulse'
      ? `\n    <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/>\n  `
      : '';

  const rect =
    animation === 'pulse'
      ? `  <rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${fill}">${rectInner}</rect>`
      : `  <rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${fill}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}\n${rect}\n</svg>`;
}

function SkeletonTab() {
  const { t } = useTranslation();
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [outputType, setOutputType] = useState<SkeletonOutputType>('css');
  const [radius, setRadius] = useState(8);
  const [animation, setAnimation] = useState<SkeletonAnimation>('shimmer');
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const generate = () => {
    const w = image?.width ?? 400;
    const h = image?.height ?? 225;
    if (outputType === 'css') {
      setCode(buildCssSkeleton(w, h, radius, animation));
    } else {
      setCode(buildSvgSkeleton(w, h, radius, animation));
    }
  };

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 实时预览注入
  useEffect(() => {
    if (!previewRef.current || !code || outputType !== 'css') return;
  }, [code, outputType]);

  const w = image?.width ?? 400;
  const h = image?.height ?? 225;
  const previewStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: Math.min(w, 320),
    aspectRatio: `${w} / ${h}`,
    borderRadius: radius,
    backgroundColor: '#e0e0e0',
  };

  if (animation === 'shimmer') {
    previewStyle.background =
      'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)';
    previewStyle.backgroundSize = '400% 100%';
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('imageTool.skeleton.desc')}
      </p>

      <ImageUploader
        image={image}
        onChange={setImage}
        onClear={() => {
          setImage(null);
          setCode(null);
        }}
      />

      {!image && (
        <p className="text-xs text-muted-foreground">
          {/* 未上传图片时使用默认 400×225 */}
          （未上传图片时使用默认 400×225 尺寸）
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t('imageTool.skeleton.outputType')}</Label>
          <div className="flex gap-2">
            {(['css', 'svg'] as const).map((o) => (
              <Button
                key={o}
                size="sm"
                variant={outputType === o ? 'default' : 'outline'}
                onClick={() => setOutputType(o)}
              >
                {o === 'css'
                  ? t('imageTool.skeleton.outputCss')
                  : t('imageTool.skeleton.outputSvg')}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>
            {t('imageTool.skeleton.borderRadius')}：{radius}px
          </Label>
          <Slider
            min={0}
            max={80}
            step={2}
            value={[radius]}
            onValueChange={([v]) => setRadius(v)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('imageTool.skeleton.animationType')}</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['none', t('imageTool.skeleton.animNone')],
                ['pulse', t('imageTool.skeleton.animPulse')],
                ['shimmer', t('imageTool.skeleton.animShimmer')],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={animation === key ? 'default' : 'outline'}
                onClick={() => setAnimation(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Button size="sm" onClick={generate}>
        {t('imageTool.skeleton.generate')}
      </Button>

      {code && (
        <div className="space-y-4">
          {/* 代码输出 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{outputType === 'css' ? 'CSS' : 'SVG'}</Label>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? (
                  <Check className="w-4 h-4 mr-1" />
                ) : (
                  <Copy className="w-4 h-4 mr-1" />
                )}
                {copied
                  ? t('imageTool.copied')
                  : t('imageTool.skeleton.copyCode')}
              </Button>
            </div>
            <Textarea
              readOnly
              value={code}
              rows={outputType === 'css' ? 12 : 18}
              className="font-mono text-xs"
            />
          </div>

          {/* 预览 */}
          <div className="space-y-2">
            <Label>{t('imageTool.skeleton.preview')}</Label>
            <div ref={previewRef}>
              {outputType === 'svg' ? (
                <div
                  dangerouslySetInnerHTML={{ __html: code }}
                  style={{ maxWidth: Math.min(w, 320) }}
                />
              ) : (
                <>
                  <style>{`
                    @keyframes skeleton-shimmer-preview {
                      0% { background-position: -200% 0; }
                      100% { background-position: 200% 0; }
                    }
                    @keyframes skeleton-pulse-preview {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.4; }
                    }
                    .skeleton-preview-box {
                      ${animation === 'shimmer' ? 'animation: skeleton-shimmer-preview 1.6s ease-in-out infinite;' : ''}
                      ${animation === 'pulse' ? 'animation: skeleton-pulse-preview 1.5s ease-in-out infinite;' : ''}
                    }
                  `}</style>
                  <div className="skeleton-preview-box" style={previewStyle} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ImageToolPage ─────────────────────────────────────────────────────────

function ImageToolPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500">
          <ImageIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('imageTool.title')}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t('imageTool.desc')}
          </p>
        </div>
      </div>

      <Tabs defaultValue="convert">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="convert">{t('imageTool.tabConvert')}</TabsTrigger>
          <TabsTrigger value="base64">{t('imageTool.tabBase64')}</TabsTrigger>
          <TabsTrigger value="crop">{t('imageTool.tabCrop')}</TabsTrigger>
          <TabsTrigger value="retina">{t('imageTool.tabRetina')}</TabsTrigger>
          <TabsTrigger value="skeleton">
            {t('imageTool.tabSkeleton')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="convert" className="mt-4">
          <ConvertTab />
        </TabsContent>
        <TabsContent value="base64" className="mt-4">
          <Base64Tab />
        </TabsContent>
        <TabsContent value="crop" className="mt-4">
          <CropTab />
        </TabsContent>
        <TabsContent value="retina" className="mt-4">
          <RetinaTab />
        </TabsContent>
        <TabsContent value="skeleton" className="mt-4">
          <SkeletonTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
