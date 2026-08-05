import { cn } from '@/lib/utils';
import { createFileRoute } from '@tanstack/react-router';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/contrast')({ component: ContrastPage });

// ─── WCAG 算法 ─────────────────────────────────────────────

/** 将 sRGB 分量（0-255）线性化 */
function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** 计算相对亮度（WCAG 2.x 标准） */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** 计算对比度比例（1:1 ~ 21:1） */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── 颜色解析 ──────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };

/** 解析 HEX 颜色（3/4/6/8 位，支持带 # 或不带） */
function parseHex(raw: string): RGB | null {
  const s = raw.trim().replace(/^#/, '');
  let r: number, g: number, b: number;
  if (s.length === 3 || s.length === 4) {
    r = parseInt(s[0] + s[0], 16);
    g = parseInt(s[1] + s[1], 16);
    b = parseInt(s[2] + s[2], 16);
  } else if (s.length === 6 || s.length === 8) {
    r = parseInt(s.slice(0, 2), 16);
    g = parseInt(s.slice(2, 4), 16);
    b = parseInt(s.slice(4, 6), 16);
  } else {
    return null;
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

/** 解析 rgb(r, g, b) / rgba(r, g, b, a) */
function parseRgb(raw: string): RGB | null {
  const m = raw.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
}

/** 解析 hsl(h, s%, l%) / hsla */
function parseHsl(raw: string): RGB | null {
  const m = raw
    .trim()
    .match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*/i);
  if (!m) return null;
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(h + 1 / 3) * 255),
    g: Math.round(hue2rgb(h) * 255),
    b: Math.round(hue2rgb(h - 1 / 3) * 255),
  };
}

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith('#') || /^[0-9a-fA-F]{3,8}$/.test(s)) return parseHex(s);
  if (/^rgba?/i.test(s)) return parseRgb(s);
  if (/^hsla?/i.test(s)) return parseHsl(s);
  return null;
}

/** RGB → 6 位 HEX（用于 color input 同步） */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ─── WCAG 判断阈值 ─────────────────────────────────────────

const THRESHOLDS = {
  AA_normal: 4.5,
  AA_large: 3,
  AAA_normal: 7,
  AAA_large: 4.5,
} as const;

// ─── 子组件 ────────────────────────────────────────────────

/** 单项通过 / 未通过徽章 */
function PassBadge({ pass }: { pass: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        pass
          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
          : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
      )}
    >
      {pass ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {pass ? t('contrast.pass') : t('contrast.fail')}
    </span>
  );
}

/** 单行判断结果行 */
function ResultRow({
  label,
  threshold,
  ratio,
}: {
  label: string;
  threshold: number;
  ratio: number;
}) {
  const pass = ratio >= threshold;
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/40 gap-2">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">≥ {threshold}:1</span>
        <PassBadge pass={pass} />
      </div>
    </div>
  );
}

// ─── 颜色输入框 ────────────────────────────────────────────

function ColorInput({
  label,
  value,
  onChange,
  rgb,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rgb: RGB | null;
}) {
  // 同步 color picker → text
  const hexForPicker = rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : '#000000';

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-2">
        {/* 原生取色器 */}
        <div className="relative shrink-0">
          <input
            type="color"
            value={hexForPicker}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded-md border cursor-pointer p-0.5 bg-background"
            aria-label={label}
          />
        </div>
        {/* 文本输入 */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB / rgb() / hsl()"
          className={cn(
            'flex-1 h-10 rounded-md border px-3 text-sm bg-background text-foreground transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            rgb === null && value.trim() !== ''
              ? 'border-destructive focus:ring-destructive'
              : 'border-input',
          )}
          spellCheck={false}
        />
        {/* 色块预览 */}
        {rgb && (
          <div
            className="w-10 h-10 rounded-md border shrink-0"
            style={{ backgroundColor: hexForPicker }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

// ─── 主页面 ────────────────────────────────────────────────

function ContrastPage() {
  const { t } = useTranslation();

  const [fgText, setFgText] = useState('#000000');
  const [bgText, setBgText] = useState('#ffffff');

  const fgRgb = parseColor(fgText);
  const bgRgb = parseColor(bgText);

  // 实时计算
  const ratio: number | null =
    fgRgb && bgRgb
      ? (() => {
          const lFg = relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
          const lBg = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
          return contrastRatio(lFg, lBg);
        })()
      : null;

  // 颜色互换
  const swap = () => {
    setFgText(bgText);
    setBgText(fgText);
  };

  // 对比度评级
  const getRatingKey = (r: number): string => {
    if (r >= THRESHOLDS.AAA_normal) return 'contrast.ratingExcellent';
    if (r >= THRESHOLDS.AA_normal) return 'contrast.ratingGood';
    if (r >= THRESHOLDS.AA_large) return 'contrast.ratingPartial';
    return 'contrast.ratingFail';
  };

  const fgHex = fgRgb ? rgbToHex(fgRgb.r, fgRgb.g, fgRgb.b) : '#000000';
  const bgHex = bgRgb ? rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b) : '#ffffff';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">{t('contrast.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('contrast.desc')}
        </p>
      </div>

      {/* 颜色输入 */}
      <div className="space-y-4 p-4 rounded-xl border bg-card">
        <ColorInput
          label={t('contrast.fgColor')}
          value={fgText}
          onChange={setFgText}
          rgb={fgRgb}
        />
        {/* 互换按钮 */}
        <div className="flex justify-center">
          <button
            onClick={swap}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            ⇅ {t('contrast.swap')}
          </button>
        </div>
        <ColorInput
          label={t('contrast.bgColor')}
          value={bgText}
          onChange={setBgText}
          rgb={bgRgb}
        />
      </div>

      {/* 预览区 */}
      {fgRgb && bgRgb && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: bgHex }}
        >
          <div className="px-6 py-5 space-y-2">
            <p
              className="text-2xl font-bold leading-tight"
              style={{ color: fgHex }}
            >
              {t('contrast.previewLarge')}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: fgHex }}>
              {t('contrast.previewNormal')}
            </p>
          </div>
        </div>
      )}

      {/* 对比度比例 */}
      {ratio !== null && (
        <div className="p-4 rounded-xl border bg-card space-y-4">
          {/* 比例数值 */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl font-bold tabular-nums text-foreground">
              {ratio.toFixed(2)}
              <span className="text-2xl font-semibold text-muted-foreground">
                :1
              </span>
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {t(getRatingKey(ratio))}
            </span>
          </div>

          {/* 进度条 */}
          <div className="space-y-1">
            <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
              {/* 背景渐变刻度 */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 opacity-30" />
              {/* 当前进度 */}
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500 transition-all duration-300"
                style={{ width: `${Math.min((ratio / 21) * 100, 100)}%` }}
              />
            </div>
            {/* 刻度标注 */}
            <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
              <span>1:1</span>
              <span>3:1</span>
              <span>4.5:1</span>
              <span>7:1</span>
              <span>21:1</span>
            </div>
          </div>

          {/* 详细判断 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              WCAG 2.x
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ResultRow
                label={t('contrast.aaLarge')}
                threshold={THRESHOLDS.AA_large}
                ratio={ratio}
              />
              <ResultRow
                label={t('contrast.aaaNormal')}
                threshold={THRESHOLDS.AAA_normal}
                ratio={ratio}
              />
              <ResultRow
                label={t('contrast.aaNormal')}
                threshold={THRESHOLDS.AA_normal}
                ratio={ratio}
              />
              <ResultRow
                label={t('contrast.aaaLarge')}
                threshold={THRESHOLDS.AAA_large}
                ratio={ratio}
              />
            </div>
          </div>
        </div>
      )}

      {/* 说明 */}
      <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
        <p>{t('contrast.noteAA')}</p>
        <p>{t('contrast.noteAAA')}</p>
        <p>{t('contrast.noteLarge')}</p>
      </div>
    </div>
  );
}
