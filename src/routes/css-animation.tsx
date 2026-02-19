import { createFileRoute } from '@tanstack/react-router';
import { Check, Copy, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/css-animation')({
  component: CssAnimationPage,
});

// ─── 类型 ───────────────────────────────────────────────────

type EasingPreset =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier';

interface BezierPoint {
  x: number;
  y: number;
}

interface KeyframeStep {
  offset: number; // 0-100
  translateX: number; // px
  translateY: number; // px
  scale: number; // 0.1-3
  rotate: number; // deg
  opacity: number; // 0-1
}

// ─── 常量 ───────────────────────────────────────────────────

const EASING_PRESETS: Record<
  Exclude<EasingPreset, 'cubic-bezier'>,
  [number, number, number, number]
> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

const DEFAULT_KEYFRAMES: KeyframeStep[] = [
  { offset: 0, translateX: 0, translateY: 0, scale: 1, rotate: 0, opacity: 1 },
  {
    offset: 100,
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotate: 360,
    opacity: 1,
  },
];

// ─── 贝塞尔曲线编辑器 ───────────────────────────────────────

const CANVAS_SIZE = 220;
const CANVAS_PADDING = 28;
const CURVE_AREA = CANVAS_SIZE - CANVAS_PADDING * 2;

function toCanvasX(x: number) {
  return CANVAS_PADDING + x * CURVE_AREA;
}
function toCanvasY(y: number) {
  // y轴翻转：CSS坐标0在底部
  return CANVAS_PADDING + (1 - y) * CURVE_AREA;
}
function fromCanvasX(cx: number) {
  return Math.max(0, Math.min(1, (cx - CANVAS_PADDING) / CURVE_AREA));
}
function fromCanvasY(cy: number) {
  return (CANVAS_PADDING - cy) / CURVE_AREA + 1;
}

interface BezierEditorProps {
  p1: BezierPoint;
  p2: BezierPoint;
  onChange: (p1: BezierPoint, p2: BezierPoint) => void;
}

function BezierEditor({ p1, p2, onChange }: BezierEditorProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<'p1' | 'p2' | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 背景网格
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = CANVAS_PADDING + (i / 4) * CURVE_AREA;
      const y = CANVAS_PADDING + (i / 4) * CURVE_AREA;
      ctx.beginPath();
      ctx.moveTo(x, CANVAS_PADDING);
      ctx.lineTo(x, CANVAS_SIZE - CANVAS_PADDING);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CANVAS_PADDING, y);
      ctx.lineTo(CANVAS_SIZE - CANVAS_PADDING, y);
      ctx.stroke();
    }

    // 对角线（linear参考）
    ctx.strokeStyle = 'rgba(128,128,128,0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), toCanvasY(0));
    ctx.lineTo(toCanvasX(1), toCanvasY(1));
    ctx.stroke();
    ctx.setLineDash([]);

    // 控制线
    const p0 = { x: toCanvasX(0), y: toCanvasY(0) };
    const p1c = { x: toCanvasX(p1.x), y: toCanvasY(p1.y) };
    const p2c = { x: toCanvasX(p2.x), y: toCanvasY(p2.y) };
    const p3 = { x: toCanvasX(1), y: toCanvasY(1) };

    ctx.strokeStyle = 'rgba(128,128,128,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1c.x, p1c.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p2c.x, p2c.y);
    ctx.stroke();

    // 贝塞尔曲线
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1c.x, p1c.y, p2c.x, p2c.y, p3.x, p3.y);
    ctx.stroke();

    // 端点
    ctx.fillStyle = 'rgba(128,128,128,0.5)';
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p3.x, p3.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // 控制点
    const drawHandle = (px: number, py: number, color: string) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    drawHandle(p1c.x, p1c.y, '#6366f1');
    drawHandle(p2c.x, p2c.y, '#ec4899');
  }, [p1, p2]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX =
      'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: fromCanvasX(clientX - rect.left),
      y: fromCanvasY(clientY - rect.top),
    };
  };

  const hitTest = (
    cx: number,
    cy: number,
    point: BezierPoint,
    threshold = 12,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const px = toCanvasX(point.x) * (rect.width / CANVAS_SIZE);
    const py = toCanvasY(point.y) * (rect.height / CANVAS_SIZE);
    return Math.hypot(cx - rect.left - px, cy - rect.top - py) < threshold;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (hitTest(e.clientX, e.clientY, p1)) {
      dragging.current = 'p1';
    } else if (hitTest(e.clientX, e.clientY, p2)) {
      dragging.current = 'p2';
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const pos = getPos(e);
    if (dragging.current === 'p1') {
      onChange({ x: Math.max(0, Math.min(1, pos.x)), y: pos.y }, p2);
    } else {
      onChange(p1, { x: Math.max(0, Math.min(1, pos.x)), y: pos.y });
    }
  };

  const onMouseUp = () => {
    dragging.current = null;
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="border rounded-lg cursor-crosshair"
        style={{ touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      <div className="grid grid-cols-2 gap-2 w-full text-xs">
        <div className="space-y-1">
          <Label className="text-indigo-500 text-xs">
            {t('cssAnimation.p1')}
          </Label>
          <div className="flex gap-1">
            <Input
              className="h-7 text-xs"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={p1.x.toFixed(2)}
              onChange={(e) =>
                onChange(
                  {
                    x: Math.max(0, Math.min(1, Number(e.target.value))),
                    y: p1.y,
                  },
                  p2,
                )
              }
            />
            <Input
              className="h-7 text-xs"
              type="number"
              step="0.01"
              value={p1.y.toFixed(2)}
              onChange={(e) =>
                onChange({ x: p1.x, y: Number(e.target.value) }, p2)
              }
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-pink-500 text-xs">
            {t('cssAnimation.p2')}
          </Label>
          <div className="flex gap-1">
            <Input
              className="h-7 text-xs"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={p2.x.toFixed(2)}
              onChange={(e) =>
                onChange(p1, {
                  x: Math.max(0, Math.min(1, Number(e.target.value))),
                  y: p2.y,
                })
              }
            />
            <Input
              className="h-7 text-xs"
              type="number"
              step="0.01"
              value={p2.y.toFixed(2)}
              onChange={(e) =>
                onChange(p1, { x: p2.x, y: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 关键帧编辑行 ────────────────────────────────────────────

interface KeyframeRowProps {
  kf: KeyframeStep;
  index: number;
  total: number;
  onChange: (kf: KeyframeStep) => void;
  onRemove: () => void;
}

function KeyframeRow({
  kf,
  index,
  total,
  onChange,
  onRemove,
}: KeyframeRowProps) {
  const { t } = useTranslation();

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary">{kf.offset}%</span>
        {total > 2 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            {t('cssAnimation.removeKf')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* offset */}
        <div className="space-y-1.5 col-span-2">
          <div className="flex justify-between">
            <Label className="text-xs text-muted-foreground">
              {t('cssAnimation.kfOffset')}
            </Label>
            <span className="text-xs font-mono">{kf.offset}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[kf.offset]}
            disabled={index === 0 || index === total - 1}
            onValueChange={([v]) => onChange({ ...kf, offset: v })}
          />
        </div>

        {/* translateX */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-muted-foreground">translateX</Label>
            <span className="text-xs font-mono">{kf.translateX}px</span>
          </div>
          <Slider
            min={-200}
            max={200}
            step={1}
            value={[kf.translateX]}
            onValueChange={([v]) => onChange({ ...kf, translateX: v })}
          />
        </div>

        {/* translateY */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-muted-foreground">translateY</Label>
            <span className="text-xs font-mono">{kf.translateY}px</span>
          </div>
          <Slider
            min={-200}
            max={200}
            step={1}
            value={[kf.translateY]}
            onValueChange={([v]) => onChange({ ...kf, translateY: v })}
          />
        </div>

        {/* scale */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-muted-foreground">scale</Label>
            <span className="text-xs font-mono">{kf.scale.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={300}
            step={1}
            value={[Math.round(kf.scale * 100)]}
            onValueChange={([v]) => onChange({ ...kf, scale: v / 100 })}
          />
        </div>

        {/* rotate */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-xs text-muted-foreground">rotate</Label>
            <span className="text-xs font-mono">{kf.rotate}deg</span>
          </div>
          <Slider
            min={-360}
            max={360}
            step={1}
            value={[kf.rotate]}
            onValueChange={([v]) => onChange({ ...kf, rotate: v })}
          />
        </div>

        {/* opacity */}
        <div className="space-y-1.5 col-span-2">
          <div className="flex justify-between">
            <Label className="text-xs text-muted-foreground">opacity</Label>
            <span className="text-xs font-mono">{kf.opacity.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[Math.round(kf.opacity * 100)]}
            onValueChange={([v]) => onChange({ ...kf, opacity: v / 100 })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 工具函数 ─────────────────────────────────────────────────

function buildTimingFunction(
  preset: EasingPreset,
  p1: BezierPoint,
  p2: BezierPoint,
): string {
  if (preset === 'cubic-bezier') {
    return `cubic-bezier(${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}, ${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})`;
  }
  return preset;
}

function buildTransitionCSS(
  property: string,
  duration: number,
  delay: number,
  timingFn: string,
): string {
  return `transition: ${property} ${duration}ms ${timingFn} ${delay}ms;`;
}

function buildAnimationCSS(
  name: string,
  duration: number,
  delay: number,
  timingFn: string,
  iterationCount: string,
  direction: string,
  fillMode: string,
): string {
  return [
    `animation-name: ${name};`,
    `animation-duration: ${duration}ms;`,
    `animation-timing-function: ${timingFn};`,
    `animation-delay: ${delay}ms;`,
    `animation-iteration-count: ${iterationCount};`,
    `animation-direction: ${direction};`,
    `animation-fill-mode: ${fillMode};`,
    `/* shorthand */`,
    `animation: ${name} ${duration}ms ${timingFn} ${delay}ms ${iterationCount} ${direction} ${fillMode};`,
  ].join('\n');
}

function buildKeyframesCSS(name: string, keyframes: KeyframeStep[]): string {
  const sorted = [...keyframes].sort((a, b) => a.offset - b.offset);
  const lines: string[] = [`@keyframes ${name} {`];
  for (const kf of sorted) {
    const transform = [
      kf.translateX !== 0 || kf.translateY !== 0
        ? `translate(${kf.translateX}px, ${kf.translateY}px)`
        : '',
      kf.scale !== 1 ? `scale(${kf.scale.toFixed(2)})` : '',
      kf.rotate !== 0 ? `rotate(${kf.rotate}deg)` : '',
    ]
      .filter(Boolean)
      .join(' ');
    lines.push(`  ${kf.offset}% {`);
    if (transform) lines.push(`    transform: ${transform};`);
    if (kf.opacity !== 1) lines.push(`    opacity: ${kf.opacity.toFixed(2)};`);
    if (!transform && kf.opacity === 1) lines.push(`    /* no change */`);
    lines.push(`  }`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ─── Transition 面板 ─────────────────────────────────────────

function TransitionPanel() {
  const { t } = useTranslation();
  const [property, setProperty] = useState('all');
  const [duration, setDuration] = useState(300);
  const [delay, setDelay] = useState(0);
  const [preset, setPreset] = useState<EasingPreset>('ease');
  const [p1, setP1] = useState<BezierPoint>({ x: 0.25, y: 0.1 });
  const [p2, setP2] = useState<BezierPoint>({ x: 0.25, y: 1 });
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const timingFn = buildTimingFunction(preset, p1, p2);
  const css = buildTransitionCSS(property, duration, delay, timingFn);

  const handlePresetChange = (val: string) => {
    const p = val as EasingPreset;
    setPreset(p);
    if (p !== 'cubic-bezier') {
      const [x1, y1, x2, y2] = EASING_PRESETS[p];
      setP1({ x: x1, y: y1 });
      setP2({ x: x2, y: y2 });
    }
  };

  const handleBezierChange = (np1: BezierPoint, np2: BezierPoint) => {
    setP1(np1);
    setP2(np2);
    setPreset('cubic-bezier');
  };

  const copy = async () => {
    await navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 根据配置的 property 决定 transition 值：
  // 若 property === 'all'，用 all 覆盖所有属性；否则只过渡该属性
  const transitionValue =
    property === 'all'
      ? `all ${duration}ms ${timingFn} ${delay}ms`
      : `${property} ${duration}ms ${timingFn} ${delay}ms`;

  // 悬停时的目标状态——所有可演示属性都发生变化，
  // 若 property 不是 all，则只有对应属性会有过渡效果（其他属性会瞬间切换），
  // 这样就能清晰展示 property 配置的含义。
  const previewStyle: React.CSSProperties = {
    transition: transitionValue,
    transform: hovered
      ? 'translateX(100px) scale(1.2) rotate(12deg)'
      : 'translateX(0) scale(1) rotate(0deg)',
    opacity: hovered ? 0.5 : 1,
    backgroundColor: hovered ? 'rgb(236, 72, 153)' : 'rgb(99, 102, 241)',
    borderRadius: hovered ? '50%' : '8px',
    width: hovered ? '64px' : '48px',
    height: hovered ? '64px' : '48px',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左侧：配置面板 */}
      <div className="space-y-5">
        {/* 属性 */}
        <div className="space-y-1.5">
          <Label className="text-sm">{t('cssAnimation.property')}</Label>
          <Select value={property} onValueChange={setProperty}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                'all',
                'transform',
                'opacity',
                'background-color',
                'border-radius',
                'width',
                'height',
              ].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* duration */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-sm">{t('cssAnimation.duration')}</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {duration}ms
            </span>
          </div>
          <Slider
            min={50}
            max={3000}
            step={50}
            value={[duration]}
            onValueChange={([v]) => setDuration(v)}
          />
        </div>

        {/* delay */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-sm">{t('cssAnimation.delay')}</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {delay}ms
            </span>
          </div>
          <Slider
            min={0}
            max={2000}
            step={50}
            value={[delay]}
            onValueChange={([v]) => setDelay(v)}
          />
        </div>

        {/* easing */}
        <div className="space-y-1.5">
          <Label className="text-sm">{t('cssAnimation.easing')}</Label>
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">linear</SelectItem>
              <SelectItem value="ease">ease</SelectItem>
              <SelectItem value="ease-in">ease-in</SelectItem>
              <SelectItem value="ease-out">ease-out</SelectItem>
              <SelectItem value="ease-in-out">ease-in-out</SelectItem>
              <SelectItem value="cubic-bezier">
                cubic-bezier（{t('cssAnimation.custom')}）
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 贝塞尔曲线编辑器 */}
        <div className="space-y-2">
          <Label className="text-sm">{t('cssAnimation.bezierEditor')}</Label>
          <BezierEditor p1={p1} p2={p2} onChange={handleBezierChange} />
          <p className="text-xs text-muted-foreground font-mono break-all">
            {timingFn}
          </p>
        </div>
      </div>

      {/* 右侧：预览 + 代码 */}
      <div className="space-y-5">
        {/* 预览区 */}
        <div className="space-y-2">
          <Label className="text-sm">{t('cssAnimation.preview')}</Label>
          <div
            className="border rounded-xl bg-muted/30 h-40 flex items-center px-6 cursor-pointer select-none relative overflow-hidden"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div style={previewStyle} />
            <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
              {t('cssAnimation.hoverHint')}
            </span>
          </div>
          {/* 属性变化说明 */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('cssAnimation.previewNote')}
          </p>
        </div>

        {/* 生成的 CSS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('cssAnimation.generatedCss')}</Label>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 gap-1 text-xs"
              onClick={copy}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? t('cssAnimation.copied') : t('cssAnimation.copy')}
            </Button>
          </div>
          <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all border text-foreground leading-relaxed">
            {css}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Animation 面板 ──────────────────────────────────────────

function AnimationPanel() {
  const { t } = useTranslation();
  const [animName, setAnimName] = useState('myAnimation');
  const [duration, setDuration] = useState(1000);
  const [delay, setDelay] = useState(0);
  const [preset, setPreset] = useState<EasingPreset>('ease');
  const [p1, setP1] = useState<BezierPoint>({ x: 0.25, y: 0.1 });
  const [p2, setP2] = useState<BezierPoint>({ x: 0.25, y: 1 });
  const [iterCount, setIterCount] = useState('infinite');
  const [direction, setDirection] = useState('normal');
  const [fillMode, setFillMode] = useState('none');
  const [keyframes, setKeyframes] = useState<KeyframeStep[]>(DEFAULT_KEYFRAMES);
  const [playing, setPlaying] = useState(false);
  const [copiedAnim, setCopiedAnim] = useState(false);
  const [copiedKf, setCopiedKf] = useState(false);

  const timingFn = buildTimingFunction(preset, p1, p2);
  const animCss = buildAnimationCSS(
    animName,
    duration,
    delay,
    timingFn,
    iterCount,
    direction,
    fillMode,
  );
  const kfCss = buildKeyframesCSS(animName, keyframes);

  const handlePresetChange = (val: string) => {
    const p = val as EasingPreset;
    setPreset(p);
    if (p !== 'cubic-bezier') {
      const [x1, y1, x2, y2] = EASING_PRESETS[p];
      setP1({ x: x1, y: y1 });
      setP2({ x: x2, y: y2 });
    }
  };

  const handleBezierChange = (np1: BezierPoint, np2: BezierPoint) => {
    setP1(np1);
    setP2(np2);
    setPreset('cubic-bezier');
  };

  const addKeyframe = () => {
    const sorted = [...keyframes].sort((a, b) => a.offset - b.offset);
    // 在最后一个和倒数第二个之间插入
    const last = sorted[sorted.length - 1];
    const secondLast = sorted[sorted.length - 2];
    const newOffset = Math.round((last.offset + secondLast.offset) / 2);
    if (newOffset === last.offset || newOffset === secondLast.offset) return;
    setKeyframes([
      ...keyframes,
      {
        offset: newOffset,
        translateX: 0,
        translateY: 0,
        scale: 1,
        rotate: 0,
        opacity: 1,
      },
    ]);
  };

  const updateKeyframe = (i: number, kf: KeyframeStep) => {
    const next = [...keyframes];
    next[i] = kf;
    setKeyframes(next);
  };

  const removeKeyframe = (i: number) => {
    setKeyframes(keyframes.filter((_, idx) => idx !== i));
  };

  const sortedKf = [...keyframes].sort((a, b) => a.offset - b.offset);

  // 动态注入 @keyframes 用于预览
  const styleId = 'css-anim-preview-style';
  useEffect(() => {
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = kfCss;
    return () => {
      // 保留样式元素
    };
  }, [kfCss]);

  const previewStyle: React.CSSProperties = playing
    ? {
        animationName: animName,
        animationDuration: `${duration}ms`,
        animationTimingFunction: timingFn,
        animationDelay: `${delay}ms`,
        animationIterationCount: iterCount,
        animationDirection: direction as
          | 'normal'
          | 'reverse'
          | 'alternate'
          | 'alternate-reverse',
        animationFillMode: fillMode as
          | 'none'
          | 'forwards'
          | 'backwards'
          | 'both',
      }
    : { animation: 'none' };

  const copyAnim = async () => {
    await navigator.clipboard.writeText(animCss);
    setCopiedAnim(true);
    setTimeout(() => setCopiedAnim(false), 1500);
  };

  const copyKf = async () => {
    await navigator.clipboard.writeText(kfCss);
    setCopiedKf(true);
    setTimeout(() => setCopiedKf(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左侧：配置面板 */}
      <div className="space-y-4">
        {/* 动画名称 */}
        <div className="space-y-1.5">
          <Label className="text-sm">{t('cssAnimation.animName')}</Label>
          <Input
            className="h-9 font-mono"
            value={animName}
            onChange={(e) => setAnimName(e.target.value)}
            placeholder="myAnimation"
          />
        </div>

        {/* duration */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-sm">{t('cssAnimation.duration')}</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {duration}ms
            </span>
          </div>
          <Slider
            min={100}
            max={5000}
            step={100}
            value={[duration]}
            onValueChange={([v]) => setDuration(v)}
          />
        </div>

        {/* delay */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-sm">{t('cssAnimation.delay')}</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {delay}ms
            </span>
          </div>
          <Slider
            min={0}
            max={3000}
            step={100}
            value={[delay]}
            onValueChange={([v]) => setDelay(v)}
          />
        </div>

        {/* iteration-count */}
        <div className="space-y-1.5">
          <Label className="text-sm">{t('cssAnimation.iterationCount')}</Label>
          <div className="flex gap-2">
            <Select
              value={iterCount === 'infinite' ? 'infinite' : 'custom'}
              onValueChange={(v) =>
                setIterCount(v === 'infinite' ? 'infinite' : '1')
              }
            >
              <SelectTrigger className="h-9 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="infinite">
                  {t('cssAnimation.infinite')}
                </SelectItem>
                <SelectItem value="custom">
                  {t('cssAnimation.customCount')}
                </SelectItem>
              </SelectContent>
            </Select>
            {iterCount !== 'infinite' && (
              <Input
                className="h-9 w-20 font-mono"
                type="number"
                min="1"
                value={iterCount}
                onChange={(e) => setIterCount(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* direction */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('cssAnimation.direction')}</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['normal', 'reverse', 'alternate', 'alternate-reverse'].map(
                  (v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* fill-mode */}
          <div className="space-y-1.5">
            <Label className="text-sm">{t('cssAnimation.fillMode')}</Label>
            <Select value={fillMode} onValueChange={setFillMode}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['none', 'forwards', 'backwards', 'both'].map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* easing */}
        <div className="space-y-1.5">
          <Label className="text-sm">{t('cssAnimation.easing')}</Label>
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">linear</SelectItem>
              <SelectItem value="ease">ease</SelectItem>
              <SelectItem value="ease-in">ease-in</SelectItem>
              <SelectItem value="ease-out">ease-out</SelectItem>
              <SelectItem value="ease-in-out">ease-in-out</SelectItem>
              <SelectItem value="cubic-bezier">
                cubic-bezier（{t('cssAnimation.custom')}）
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 贝塞尔 */}
        {preset === 'cubic-bezier' && (
          <div className="space-y-2">
            <Label className="text-sm">{t('cssAnimation.bezierEditor')}</Label>
            <BezierEditor p1={p1} p2={p2} onChange={handleBezierChange} />
            <p className="text-xs text-muted-foreground font-mono break-all">
              {timingFn}
            </p>
          </div>
        )}
      </div>

      {/* 右侧：预览 + 关键帧 + 代码 */}
      <div className="space-y-5">
        {/* 预览 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('cssAnimation.preview')}</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={playing ? 'default' : 'outline'}
                className="h-7 px-3 gap-1 text-xs"
                onClick={() => setPlaying(true)}
              >
                <Play className="w-3 h-3" />
                {t('cssAnimation.play')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 gap-1 text-xs"
                onClick={() => setPlaying(false)}
              >
                <Square className="w-3 h-3" />
                {t('cssAnimation.stop')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setPlaying(false);
                  setTimeout(() => setPlaying(true), 50);
                }}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div className="border rounded-xl bg-muted/30 h-36 flex items-center justify-center overflow-hidden">
            <div
              className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg"
              style={previewStyle}
            />
          </div>
        </div>

        {/* 关键帧编辑 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('cssAnimation.keyframes')}</Label>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs"
              onClick={addKeyframe}
            >
              + {t('cssAnimation.addKf')}
            </Button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {sortedKf.map((kf, i) => (
              <KeyframeRow
                key={i}
                kf={kf}
                index={i}
                total={sortedKf.length}
                onChange={(updated) => {
                  const origIdx = keyframes.indexOf(kf);
                  updateKeyframe(origIdx >= 0 ? origIdx : i, updated);
                }}
                onRemove={() => {
                  const origIdx = keyframes.indexOf(kf);
                  removeKeyframe(origIdx >= 0 ? origIdx : i);
                }}
              />
            ))}
          </div>
        </div>

        {/* 生成代码 */}
        <div className="space-y-3">
          {/* animation 属性 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">animation</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 gap-1 text-xs"
                onClick={copyAnim}
              >
                {copiedAnim ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copiedAnim ? t('cssAnimation.copied') : t('cssAnimation.copy')}
              </Button>
            </div>
            <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all border text-foreground leading-relaxed max-h-32 overflow-y-auto">
              {animCss}
            </pre>
          </div>

          {/* @keyframes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">
                @keyframes
              </Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 gap-1 text-xs"
                onClick={copyKf}
              >
                {copiedKf ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copiedKf ? t('cssAnimation.copied') : t('cssAnimation.copy')}
              </Button>
            </div>
            <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all border text-foreground leading-relaxed max-h-52 overflow-y-auto">
              {kfCss}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────

function CssAnimationPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('cssAnimation.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('cssAnimation.desc')}
        </p>
      </div>

      <Tabs defaultValue="transition">
        <TabsList>
          <TabsTrigger value="transition">
            {t('cssAnimation.tabTransition')}
          </TabsTrigger>
          <TabsTrigger value="animation">
            {t('cssAnimation.tabAnimation')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transition" className="mt-5">
          <TransitionPanel />
        </TabsContent>

        <TabsContent value="animation" className="mt-5">
          <AnimationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
