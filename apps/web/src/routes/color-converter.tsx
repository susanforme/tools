import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, Pipette } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';

export const Route = createFileRoute('/color-converter')({
  component: ColorConverterPage,
});

// ─── 类型 ──────────────────────────────────────────────────

type RgbaColor = { r: number; g: number; b: number; a: number };
type HslaColor = { h: number; s: number; l: number; a: number };

// ─── 工具函数 ──────────────────────────────────────────────

/** 将 0-255 数值转为 2 位十六进制 */
function toHex2(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0');
}

/** 解析任意 CSS 颜色字符串，返回 rgba */
function parseCssColor(raw: string): RgbaColor | null {
  const s = raw.trim();
  if (!s) return null;

  // HEX: #rgb / #rrggbb / #rgba / #rrggbbaa
  const hexMatch = s.match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    if (hex.length === 4)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  // RGB / RGBA
  const rgbMatch = s.match(
    /^rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i,
  );
  if (rgbMatch) {
    const parseVal = (v: string, max: number) =>
      v.endsWith('%') ? (parseFloat(v) / 100) * max : parseFloat(v);
    const r = parseVal(rgbMatch[1], 255);
    const g = parseVal(rgbMatch[2], 255);
    const b = parseVal(rgbMatch[3], 255);
    const a =
      rgbMatch[4] !== undefined
        ? rgbMatch[4].endsWith('%')
          ? parseFloat(rgbMatch[4]) / 100
          : parseFloat(rgbMatch[4])
        : 1;
    return { r, g, b, a };
  }

  // HSL / HSLA
  const hslMatch = s.match(
    /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+%?)\s*)?\)$/i,
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const sl = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    const a =
      hslMatch[4] !== undefined
        ? hslMatch[4].endsWith('%')
          ? parseFloat(hslMatch[4]) / 100
          : parseFloat(hslMatch[4])
        : 1;
    return { ...hslToRgb(h, sl, l), a };
  }

  return null;
}

/** HSL → RGB（无 alpha） */
function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** RGB → HSL */
function rgbToHsl(r: number, g: number, b: number): HslaColor {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = 60 * (((gn - bn) / delta + 6) % 6);
        break;
      case gn:
        h = 60 * ((bn - rn) / delta + 2);
        break;
      default:
        h = 60 * ((rn - gn) / delta + 4);
    }
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: 1,
  };
}

/** rgba → HEX 字符串 */
function rgbaToHex(c: RgbaColor, includeAlpha: boolean): string {
  const hex = `#${toHex2(c.r)}${toHex2(c.g)}${toHex2(c.b)}`;
  if (includeAlpha && c.a < 1) return hex + toHex2(c.a * 255);
  return hex;
}

/** rgba → rgb()/rgba() 字符串 */
function rgbaToRgbStr(c: RgbaColor): string {
  if (c.a < 1) {
    const alpha = parseFloat(c.a.toFixed(2));
    return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
  }
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
}

/** rgba → hsl()/hsla() 字符串 */
function rgbaToHslStr(c: RgbaColor): string {
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  if (c.a < 1) {
    const alpha = parseFloat(c.a.toFixed(2));
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ─── 复制按钮 ──────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
      aria-label="复制"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ─── 颜色预览块 ────────────────────────────────────────────

function ColorSwatch({ color }: { color: string }) {
  return (
    <div
      className="w-full h-24 rounded-xl border shadow-sm transition-colors duration-200"
      style={{ background: color || 'transparent' }}
    />
  );
}

// ─── 输出行 ────────────────────────────────────────────────

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      <code className="flex-1 text-sm font-mono bg-muted/50 rounded-md px-2.5 py-1.5 truncate">
        {value || '—'}
      </code>
      <CopyButton text={value} />
    </div>
  );
}

// ─── 取色器按钮（Eye Dropper API） ────────────────────────

function EyeDropperButton({ onPick }: { onPick: (hex: string) => void }) {
  const { t } = useTranslation();
  const supported = typeof window !== 'undefined' && 'EyeDropper' in window;
  if (!supported) return null;

  const handlePick = async () => {
    try {
      // @ts-expect-error EyeDropper 是实验性 API
      const dropper = new window.EyeDropper();
      const result = (await dropper.open()) as { sRGBHex: string };
      onPick(result.sRGBHex);
    } catch {
      // 用户取消操作，忽略
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePick}
      className="gap-1.5"
    >
      <Pipette className="w-3.5 h-3.5" />
      {t('colorConverter.eyeDropper')}
    </Button>
  );
}

// ─── 主页面 ────────────────────────────────────────────────

function ColorConverterPage() {
  const { t } = useTranslation();

  // 原始输入
  const [input, setInput] = useState('#3b82f6');
  // 解析后的颜色（null 表示无效输入）
  const [parsed, setParsed] = useState<RgbaColor | null>(() =>
    parseCssColor('#3b82f6'),
  );
  const [error, setError] = useState<string | null>(null);

  // 当输入变化时实时解析
  const handleInput = useCallback(
    (val: string) => {
      setInput(val);
      const result = parseCssColor(val);
      if (result) {
        setParsed(result);
        setError(null);
      } else {
        // 输入为空时不报错，有内容但无效才报错
        if (val.trim()) {
          setError(t('colorConverter.parseError'));
          setParsed(null);
        } else {
          setParsed(null);
          setError(null);
        }
      }
    },
    [t],
  );

  // 原生 color input 联动
  const handleColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const result = parseCssColor(val);
    if (result) {
      setParsed(result);
      setError(null);
    }
  };

  // Eye Dropper 取色
  const handleEyeDrop = (hex: string) => {
    setInput(hex);
    const result = parseCssColor(hex);
    if (result) {
      setParsed(result);
      setError(null);
    }
  };

  // 派生输出值
  const hex = parsed ? rgbaToHex(parsed, true) : '';
  const hexNoAlpha = parsed ? rgbaToHex(parsed, false) : '';
  const rgbStr = parsed ? rgbaToRgbStr(parsed) : '';
  const hslStr = parsed ? rgbaToHslStr(parsed) : '';
  const previewColor = parsed
    ? parsed.a < 1
      ? rgbStr
      : hexNoAlpha
    : 'transparent';

  // 同步原生 color picker 值（只接受 6 位 hex）
  const pickerValue = hexNoAlpha.length === 7 ? hexNoAlpha : '#000000';

  // 当 input 内容是有效颜色时，color picker 始终反映最新颜色
  useEffect(() => {
    // 仅用于 controlled input 同步，逻辑已在 handleInput 中处理
  }, [parsed]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">{t('colorConverter.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('colorConverter.desc')}
        </p>
      </div>

      {/* 输入区 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t('colorConverter.inputLabel')}
        </Label>
        <div className="flex items-center gap-2">
          {/* 原生取色器 */}
          <label className="relative cursor-pointer">
            <div
              className="w-10 h-10 rounded-lg border-2 border-border shadow-sm hover:scale-105 transition-transform"
              style={{ background: previewColor }}
            />
            <input
              type="color"
              value={pickerValue}
              onChange={handleColorPicker}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="取色器"
            />
          </label>

          {/* 文本输入 */}
          <input
            type="text"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleInput(e.target.value)
            }
            placeholder="例如: #3b82f6  rgb(59, 130, 246)  hsl(217, 91%, 60%)"
            className="font-mono text-sm flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />

          {/* Eye Dropper */}
          <EyeDropperButton onPick={handleEyeDrop} />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* 提示文字 */}
        <p className="text-xs text-muted-foreground">
          {t('colorConverter.hint')}
        </p>
      </div>

      {/* 颜色预览 */}
      {parsed && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t('colorConverter.preview')}
          </Label>
          <ColorSwatch color={previewColor} />
          {parsed.a < 1 && (
            <p className="text-xs text-muted-foreground">
              {t('colorConverter.alphaNote', {
                alpha: parseFloat(parsed.a.toFixed(2)),
              })}
            </p>
          )}
        </div>
      )}

      {/* 转换结果 */}
      {parsed && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            {t('colorConverter.results')}
          </Label>
          <div className="rounded-xl border bg-card p-4 space-y-2.5">
            <OutputRow label="HEX" value={hex} />
            <OutputRow label="RGB" value={rgbStr} />
            <OutputRow label="HSL" value={hslStr} />
          </div>
        </div>
      )}

      {/* 各分量滑块 */}
      {parsed && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            {t('colorConverter.sliders')}
          </Label>
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <SliderRow
              label="R"
              value={Math.round(parsed.r)}
              max={255}
              color="#ef4444"
              onChange={(v) => {
                const next = { ...parsed, r: v };
                setParsed(next);
                setInput(rgbaToHex(next, true));
                setError(null);
              }}
            />
            <SliderRow
              label="G"
              value={Math.round(parsed.g)}
              max={255}
              color="#22c55e"
              onChange={(v) => {
                const next = { ...parsed, g: v };
                setParsed(next);
                setInput(rgbaToHex(next, true));
                setError(null);
              }}
            />
            <SliderRow
              label="B"
              value={Math.round(parsed.b)}
              max={255}
              color="#3b82f6"
              onChange={(v) => {
                const next = { ...parsed, b: v };
                setParsed(next);
                setInput(rgbaToHex(next, true));
                setError(null);
              }}
            />
            <SliderRow
              label="A"
              value={parseFloat(parsed.a.toFixed(2))}
              max={1}
              step={0.01}
              color="#94a3b8"
              onChange={(v) => {
                const next = { ...parsed, a: v };
                setParsed(next);
                setInput(rgbaToHex(next, true));
                setError(null);
              }}
            />
          </div>
        </div>
      )}

      {/* 清空按钮 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setInput('');
            setParsed(null);
            setError(null);
          }}
        >
          {t('colorConverter.clear')}
        </Button>
      </div>
    </div>
  );
}

// ─── 滑块组件 ──────────────────────────────────────────────

function SliderRow({
  label,
  value,
  max,
  step = 1,
  color,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs font-mono font-bold w-4 shrink-0"
        style={{ color }}
      >
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-current"
        style={{ color }}
      />
      <span className="text-xs font-mono text-muted-foreground w-10 text-right shrink-0">
        {max === 1 ? value.toFixed(2) : value}
      </span>
    </div>
  );
}
