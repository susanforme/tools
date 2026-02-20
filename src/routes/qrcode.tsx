import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, Download, QrCode, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';

export const Route = createFileRoute('/qrcode')({ component: QrCodePage });

// ─── 生成标签页 ────────────────────────────────────────────

function GenerateTab() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [size, setSize] = useState(256);
  const [margin, setMargin] = useState(2);
  const [darkColor, setDarkColor] = useState('#000000');
  const [lightColor, setLightColor] = useState('#ffffff');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    if (!text.trim()) {
      setDataUrl(null);
      setError(null);
      return;
    }
    setError(null);
    try {
      const QRCode = await import('qrcode');
      const url = await QRCode.default.toDataURL(text, {
        width: size,
        margin,
        color: { dark: darkColor, light: lightColor },
        errorCorrectionLevel: 'M',
      });
      setDataUrl(url);
    } catch (e) {
      setError(t('qrcode.generateError', { msg: (e as Error).message }));
      setDataUrl(null);
    }
  }, [text, size, margin, darkColor, lightColor, t]);

  // 内容或参数变化时实时生成
  useEffect(() => {
    void generate();
  }, [generate]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'qrcode.png';
    a.click();
  };

  const copyImage = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 回退：复制 data URL 文本
      await navigator.clipboard.writeText(dataUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* 输入文本 */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t('qrcode.inputLabel')}</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('qrcode.inputPlaceholder')}
          rows={4}
          className="font-mono text-sm resize-none"
        />
      </div>

      {/* 参数 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border bg-card p-4">
        {/* 尺寸 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t('qrcode.size')}</Label>
            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
              {size}px
            </span>
          </div>
          <Slider
            min={64}
            max={512}
            step={16}
            value={[size]}
            onValueChange={([v]) => setSize(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>64px</span>
            <span>512px</span>
          </div>
        </div>

        {/* 边距 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t('qrcode.margin')}</Label>
            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
              {margin}
            </span>
          </div>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[margin]}
            onValueChange={([v]) => setMargin(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>10</span>
          </div>
        </div>

        {/* 颜色 */}
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium shrink-0">
            {t('qrcode.fgColor')}
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={darkColor}
              onChange={(e) => setDarkColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
            />
            <span className="text-xs font-mono text-muted-foreground">
              {darkColor}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium shrink-0">
            {t('qrcode.bgColor')}
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={lightColor}
              onChange={(e) => setLightColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
            />
            <span className="text-xs font-mono text-muted-foreground">
              {lightColor}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* 预览 */}
      {dataUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-center rounded-xl border bg-muted/30 p-6">
            <img
              src={dataUrl}
              alt={t('qrcode.qrAlt')}
              style={{
                width: Math.min(size, 300),
                height: Math.min(size, 300),
              }}
              className="rounded"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={download}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t('qrcode.downloadPng')}
            </Button>
            <Button size="sm" variant="outline" onClick={copyImage}>
              {copied ? (
                <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {copied ? t('qrcode.copied') : t('qrcode.copyImage')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 识别标签页 ────────────────────────────────────────────

function DecodeTab() {
  const { t } = useTranslation();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const decodeImage = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);

      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(t('qrcode.imgLoadError')));
          img.src = objectUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(t('qrcode.canvasError'));
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const jsQR = (await import('jsqr')).default;
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          setResult(code.data);
        } else {
          setError(t('qrcode.noQrFound'));
        }
      } catch (e) {
        setError(t('qrcode.decodeError', { msg: (e as Error).message }));
      }
    },
    [t],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void decodeImage(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void decodeImage(file);
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      );
      if (item) {
        const file = item.getAsFile();
        if (file) void decodeImage(file);
      }
    },
    [decodeImage],
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const clear = () => {
    setResult(null);
    setError(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <div
        className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer
          ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <Upload className="w-8 h-8" />
          <p className="text-sm font-medium">{t('qrcode.uploadHint')}</p>
          <p className="text-xs">{t('qrcode.uploadHintSub')}</p>
        </div>
      </div>

      {/* 预览 + 结果 */}
      {(preview || error) && (
        <div className="space-y-3">
          {preview && (
            <div className="flex items-start gap-4 rounded-xl border bg-card p-4">
              <img
                src={preview}
                alt={t('qrcode.imgAlt')}
                className="w-24 h-24 object-contain rounded border bg-muted/30 shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  {t('qrcode.decodeResult')}
                </p>
                {result ? (
                  <p className="text-sm font-mono break-all bg-muted/50 rounded px-2 py-1.5">
                    {result}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('qrcode.decoding')}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {result && (
              <Button size="sm" onClick={copyResult}>
                {copied ? (
                  <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                )}
                {copied ? t('qrcode.copied') : t('qrcode.copyResult')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={clear}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              {t('qrcode.clear')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────

type QrTabType = 'generate' | 'decode';

function QrCodePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useQueryParam<QrTabType>(
    'tab',
    StringParam,
    'generate',
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <QrCode className="w-6 h-6 text-blue-500" />
          {t('qrcode.title')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('qrcode.desc')}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as QrTabType)}>
        <TabsList>
          <TabsTrigger value="generate">{t('qrcode.tabGenerate')}</TabsTrigger>
          <TabsTrigger value="decode">{t('qrcode.tabDecode')}</TabsTrigger>
        </TabsList>
        <TabsContent value="generate" className="mt-4">
          <GenerateTab />
        </TabsContent>
        <TabsContent value="decode" className="mt-4">
          <DecodeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
