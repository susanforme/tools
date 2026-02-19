import { cn } from '@/lib/utils';
import { createFileRoute } from '@tanstack/react-router';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  GripVertical,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const Route = createFileRoute('/css-layout')({ component: LayoutPage });

// ─── 类型 ──────────────────────────────────────────────────

type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
type JustifyContent =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
type AlignItems = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';

type GridAutoMode = 'fixed' | 'auto-fill' | 'auto-fit';

// 合并单元格选区
type MergedCell = {
  id: string;
  rowStart: number;
  colStart: number;
  rowEnd: number;
  colEnd: number;
  areaName: string;
};

// ─── 常量 ──────────────────────────────────────────────────

const LAYOUT_TEMPLATES = [
  { id: 'holy-grail', nameKey: 'layout.tpl.holyGrail' },
  { id: 'double-wing', nameKey: 'layout.tpl.doubleWing' },
  { id: 'masonry', nameKey: 'layout.tpl.masonry' },
  { id: 'admin', nameKey: 'layout.tpl.admin' },
] as const;

type TemplateId = (typeof LAYOUT_TEMPLATES)[number]['id'];

const TEMPLATE_CSS: Record<TemplateId, { css: string; html: string }> = {
  'holy-grail': {
    css: `.holy-grail {
  display: grid;
  grid-template-areas:
    "header header header"
    "nav    main   aside"
    "footer footer footer";
  grid-template-columns: 200px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  min-height: 100vh;
  gap: 0;
}

.holy-grail header { grid-area: header; }
.holy-grail nav    { grid-area: nav; }
.holy-grail main   { grid-area: main; }
.holy-grail aside  { grid-area: aside; }
.holy-grail footer { grid-area: footer; }`,
    html: `<div class="holy-grail">
  <header>Header</header>
  <nav>Left Nav</nav>
  <main>Main Content</main>
  <aside>Right Aside</aside>
  <footer>Footer</footer>
</div>`,
  },
  'double-wing': {
    css: `.double-wing {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
}

.double-wing-header,
.double-wing-footer {
  flex-shrink: 0;
}

.double-wing-body {
  display: flex;
  flex: 1;
}

.double-wing-left,
.double-wing-right {
  width: 200px;
  flex-shrink: 0;
}

.double-wing-main {
  flex: 1;
  /* BFC prevents margin collapse */
  overflow: hidden;
}`,
    html: `<div class="double-wing">
  <header class="double-wing-header">Header</header>
  <div class="double-wing-body">
    <aside class="double-wing-left">Left</aside>
    <main class="double-wing-main">Main</main>
    <aside class="double-wing-right">Right</aside>
  </div>
  <footer class="double-wing-footer">Footer</footer>
</div>`,
  },
  masonry: {
    css: `.masonry {
  columns: 4;
  column-gap: 16px;
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 16px;
}

/* Responsive */
@media (max-width: 1024px) {
  .masonry { columns: 3; }
}
@media (max-width: 768px) {
  .masonry { columns: 2; }
}
@media (max-width: 480px) {
  .masonry { columns: 1; }
}`,
    html: `<div class="masonry">
  <div class="masonry-item">Item 1</div>
  <div class="masonry-item">Item 2</div>
  <div class="masonry-item">Item 3</div>
  <!-- more items... -->
</div>`,
  },
  admin: {
    css: `.admin-layout {
  display: grid;
  grid-template-areas:
    "sidebar topbar"
    "sidebar content";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 56px 1fr;
  height: 100vh;
  overflow: hidden;
}

.admin-sidebar  { grid-area: sidebar; overflow-y: auto; }
.admin-topbar   { grid-area: topbar; }
.admin-content  { grid-area: content; overflow-y: auto; }`,
    html: `<div class="admin-layout">
  <aside class="admin-sidebar">Sidebar</aside>
  <header class="admin-topbar">Top Bar</header>
  <main class="admin-content">Content</main>
</div>`,
  },
};

// ─── Flex Gap 计算器 ──────────────────────────────────────

function FlexGapCalculator() {
  const { t } = useTranslation();
  const [containerWidth, setContainerWidth] = useState<string>('1200');
  const [columns, setColumns] = useState<string>('4');
  const [gap, setGap] = useState<string>('16');
  const [unit, setUnit] = useState<'px' | '%'>('px');

  const containerW = parseFloat(containerWidth) || 0;
  const cols = parseInt(columns) || 1;
  const gapV = parseFloat(gap) || 0;

  let childWidth: string | null = null;
  let formula = '';

  if (containerW > 0 && cols > 0) {
    const gapPx = unit === '%' ? (gapV / 100) * containerW : gapV;
    const totalGap = gapPx * (cols - 1);
    const w = (containerW - totalGap) / cols;

    if (unit === 'px') {
      const pct = ((w / containerW) * 100).toFixed(4);
      childWidth = `${w.toFixed(2)}px (≈ ${pct}%)`;
      formula = `(${containerW}px - ${cols - 1} × ${gapV}px) ÷ ${cols} = ${w.toFixed(2)}px`;
    } else {
      const pct = ((w / containerW) * 100).toFixed(4);
      childWidth = `${w.toFixed(2)}px (≈ ${pct}%)`;
      formula = `(${containerW}px - ${cols - 1} × ${gapV}% × ${containerW}px) ÷ ${cols} = ${w.toFixed(2)}px`;
    }
  }

  const flexCss =
    childWidth && containerW > 0
      ? `.container {
  display: flex;
  flex-wrap: wrap;
  gap: ${gap}${unit};
  width: ${containerWidth}px;
}

.item {
  width: calc((100% - ${gap}${unit} * ${cols - 1}) / ${cols});
  /* flex-basis alternative: */
  flex: 0 0 calc((100% - ${gap}${unit} * ${cols - 1}) / ${cols});
}`
      : '';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>{t('layout.flexGap.containerWidth')}</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min="1"
              value={containerWidth}
              onChange={(e) => setContainerWidth(e.target.value)}
              className="w-full"
            />
            <span className="flex items-center text-sm text-muted-foreground px-2">
              px
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.flexGap.columns')}</Label>
          <Input
            type="number"
            min="1"
            max="24"
            value={columns}
            onChange={(e) => setColumns(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.flexGap.gap')}</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min="0"
              value={gap}
              onChange={(e) => setGap(e.target.value)}
              className="flex-1"
            />
            <Select
              value={unit}
              onValueChange={(v) => setUnit(v as 'px' | '%')}
            >
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="%">%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.flexGap.childWidth')}</Label>
          <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm font-mono text-foreground">
            {childWidth ?? '—'}
          </div>
        </div>
      </div>

      {formula && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 font-mono">
          {t('layout.flexGap.formula')}: {formula}
        </div>
      )}

      {flexCss && <CssOutputPanel css={flexCss} />}
    </div>
  );
}

// ─── Grid Column 计算器 ───────────────────────────────────

type Breakpoint = { name: string; width: string; columns: string; gap: string };

function GridColumnCalculator() {
  const { t } = useTranslation();
  const [minItemWidth, setMinItemWidth] = useState<string>('200');
  const [gap, setGap] = useState<string>('16');
  const [autoMode, setAutoMode] = useState<GridAutoMode>('auto-fill');
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([
    { name: 'sm', width: '640', columns: '2', gap: '12' },
    { name: 'md', width: '768', columns: '3', gap: '16' },
    { name: 'lg', width: '1024', columns: '4', gap: '20' },
    { name: 'xl', width: '1280', columns: '5', gap: '24' },
  ]);

  const addBreakpoint = () => {
    setBreakpoints((prev) => [
      ...prev,
      { name: `bp${prev.length + 1}`, width: '1440', columns: '6', gap: '24' },
    ]);
  };

  const removeBreakpoint = (i: number) => {
    setBreakpoints((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateBreakpoint = (
    i: number,
    field: keyof Breakpoint,
    val: string,
  ) => {
    setBreakpoints((prev) =>
      prev.map((bp, idx) => (idx === i ? { ...bp, [field]: val } : bp)),
    );
  };

  const baseCss = `/* 基础：响应式 Grid（${autoMode} + minmax） */
.grid-container {
  display: grid;
  grid-template-columns: repeat(${autoMode}, minmax(${minItemWidth}px, 1fr));
  gap: ${gap}px;
}`;

  const responsiveCss =
    breakpoints.length > 0
      ? `\n\n/* 响应式断点 */\n` +
        breakpoints
          .map(
            (bp) =>
              `@media (min-width: ${bp.width}px) {\n  .grid-container {\n    grid-template-columns: repeat(${bp.columns}, 1fr);\n    gap: ${bp.gap}px;\n  }\n}`,
          )
          .join('\n\n')
      : '';

  const fullCss = baseCss + responsiveCss;

  return (
    <div className="space-y-5">
      {/* 基础设置 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>{t('layout.grid.minItemWidth')}</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min="50"
              value={minItemWidth}
              onChange={(e) => setMinItemWidth(e.target.value)}
            />
            <span className="flex items-center text-sm text-muted-foreground px-2">
              px
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.grid.gap')}</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min="0"
              value={gap}
              onChange={(e) => setGap(e.target.value)}
            />
            <span className="flex items-center text-sm text-muted-foreground px-2">
              px
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.grid.autoMode')}</Label>
          <Select
            value={autoMode}
            onValueChange={(v) => setAutoMode(v as GridAutoMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto-fill">auto-fill</SelectItem>
              <SelectItem value="auto-fit">auto-fit</SelectItem>
              <SelectItem value="fixed">{t('layout.grid.fixed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 响应式断点 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('layout.grid.breakpoints')}</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={addBreakpoint}
            className="h-7 px-2 text-xs gap-1"
          >
            <Plus className="w-3 h-3" />
            {t('layout.grid.addBreakpoint')}
          </Button>
        </div>
        <div className="space-y-2">
          {breakpoints.map((bp, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <Input
                className="w-16 h-7 text-xs"
                placeholder="name"
                value={bp.name}
                onChange={(e) => updateBreakpoint(i, 'name', e.target.value)}
              />
              <span className="text-xs text-muted-foreground">@</span>
              <div className="flex items-center gap-1">
                <Input
                  className="w-20 h-7 text-xs"
                  type="number"
                  min="0"
                  placeholder="width"
                  value={bp.width}
                  onChange={(e) => updateBreakpoint(i, 'width', e.target.value)}
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {t('layout.grid.cols')}:
              </span>
              <Input
                className="w-14 h-7 text-xs"
                type="number"
                min="1"
                value={bp.columns}
                onChange={(e) => updateBreakpoint(i, 'columns', e.target.value)}
              />
              <span className="text-xs text-muted-foreground">gap:</span>
              <div className="flex items-center gap-1">
                <Input
                  className="w-14 h-7 text-xs"
                  type="number"
                  min="0"
                  value={bp.gap}
                  onChange={(e) => updateBreakpoint(i, 'gap', e.target.value)}
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeBreakpoint(i)}
              >
                <Minus className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <CssOutputPanel css={fullCss} />
    </div>
  );
}

// ─── 布局模板 ─────────────────────────────────────────────

function LayoutTemplates() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<TemplateId>('holy-grail');
  const [tab, setTab] = useState<'css' | 'html'>('css');

  const tpl = TEMPLATE_CSS[selected];
  const code = tab === 'css' ? tpl.css : tpl.html;

  return (
    <div className="space-y-4">
      {/* 模板选择器 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LAYOUT_TEMPLATES.map(({ id, nameKey }) => (
          <button
            key={id}
            onClick={() => setSelected(id as TemplateId)}
            className={cn(
              'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer',
              selected === id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-accent',
            )}
          >
            <TemplateThumbnail id={id as TemplateId} active={selected === id} />
            <span className="text-xs font-medium text-center">
              {t(nameKey)}
            </span>
          </button>
        ))}
      </div>

      {/* CSS / HTML 切换 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === 'css' ? 'default' : 'outline'}
          onClick={() => setTab('css')}
          className="h-7 px-3 text-xs"
        >
          CSS
        </Button>
        <Button
          size="sm"
          variant={tab === 'html' ? 'default' : 'outline'}
          onClick={() => setTab('html')}
          className="h-7 px-3 text-xs"
        >
          HTML
        </Button>
      </div>

      <CssOutputPanel css={code} language={tab} />
    </div>
  );
}

// 布局模板缩略图
function TemplateThumbnail({
  id,
  active,
}: {
  id: TemplateId;
  active: boolean;
}) {
  const color = active ? 'bg-primary/20' : 'bg-muted-foreground/20';
  const accent = active ? 'bg-primary/40' : 'bg-muted-foreground/30';

  if (id === 'holy-grail') {
    return (
      <div className="w-full aspect-[4/3] flex flex-col gap-0.5 p-1">
        <div className={cn('h-2 rounded-sm w-full', accent)} />
        <div className="flex gap-0.5 flex-1">
          <div className={cn('w-4 rounded-sm', color)} />
          <div className={cn('flex-1 rounded-sm', accent)} />
          <div className={cn('w-4 rounded-sm', color)} />
        </div>
        <div className={cn('h-2 rounded-sm w-full', accent)} />
      </div>
    );
  }
  if (id === 'double-wing') {
    return (
      <div className="w-full aspect-[4/3] flex flex-col gap-0.5 p-1">
        <div className={cn('h-2 rounded-sm w-full', color)} />
        <div className="flex gap-0.5 flex-1">
          <div className={cn('w-4 rounded-sm', color)} />
          <div className={cn('flex-1 rounded-sm', accent)} />
          <div className={cn('w-4 rounded-sm', color)} />
        </div>
        <div className={cn('h-2 rounded-sm w-full', color)} />
      </div>
    );
  }
  if (id === 'masonry') {
    return (
      <div className="w-full aspect-[4/3] flex gap-0.5 p-1">
        {[3, 5, 4, 3].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col gap-0.5 justify-end">
            <div
              className={cn('rounded-sm', color)}
              style={{ height: `${h * 16}%` }}
            />
            <div
              className={cn('rounded-sm', accent)}
              style={{ height: `${(8 - h) * 10}%` }}
            />
          </div>
        ))}
      </div>
    );
  }
  // admin
  return (
    <div className="w-full aspect-[4/3] flex gap-0.5 p-1">
      <div className={cn('w-5 rounded-sm', color)} />
      <div className="flex-1 flex flex-col gap-0.5">
        <div className={cn('h-2 rounded-sm', accent)} />
        <div className={cn('flex-1 rounded-sm', color)} />
      </div>
    </div>
  );
}

// ─── Flexbox 可视化沙盒 ───────────────────────────────────

const FLEX_ITEMS_COUNT_OPTIONS = [2, 3, 4, 5, 6, 8] as const;

function FlexSandbox() {
  const { t } = useTranslation();
  const [direction, setDirection] = useState<FlexDirection>('row');
  const [wrap, setWrap] = useState<FlexWrap>('wrap');
  const [justifyContent, setJustifyContent] =
    useState<JustifyContent>('flex-start');
  const [alignItems, setAlignItems] = useState<AlignItems>('stretch');
  const [gap, setGap] = useState<string>('8');
  const [itemCount, setItemCount] = useState<number>(4);

  const css = `.flex-container {
  display: flex;
  flex-direction: ${direction};
  flex-wrap: ${wrap};
  justify-content: ${justifyContent};
  align-items: ${alignItems};
  gap: ${gap}px;
}`;

  return (
    <div className="space-y-4">
      {/* 控件 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>flex-direction</Label>
          <Select
            value={direction}
            onValueChange={(v) => setDirection(v as FlexDirection)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                ['row', 'row-reverse', 'column', 'column-reverse'] as const
              ).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>flex-wrap</Label>
          <Select value={wrap} onValueChange={(v) => setWrap(v as FlexWrap)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['nowrap', 'wrap', 'wrap-reverse'] as const).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>justify-content</Label>
          <Select
            value={justifyContent}
            onValueChange={(v) => setJustifyContent(v as JustifyContent)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  'flex-start',
                  'flex-end',
                  'center',
                  'space-between',
                  'space-around',
                  'space-evenly',
                ] as const
              ).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>align-items</Label>
          <Select
            value={alignItems}
            onValueChange={(v) => setAlignItems(v as AlignItems)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  'flex-start',
                  'flex-end',
                  'center',
                  'stretch',
                  'baseline',
                ] as const
              ).map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>gap</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min="0"
              max="64"
              value={gap}
              onChange={(e) => setGap(e.target.value)}
            />
            <span className="flex items-center text-sm text-muted-foreground px-2">
              px
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.sandbox.itemCount')}</Label>
          <Select
            value={String(itemCount)}
            onValueChange={(v) => setItemCount(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FLEX_ITEMS_COUNT_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 预览区 */}
      <div className="border rounded-xl overflow-hidden bg-background">
        <div className="px-3 py-1.5 border-b bg-muted/40 text-xs text-muted-foreground">
          {t('layout.sandbox.preview')}
        </div>
        <div className="p-4 min-h-40">
          <div
            style={{
              display: 'flex',
              flexDirection: direction,
              flexWrap: wrap,
              justifyContent,
              alignItems,
              gap: `${gap}px`,
              minHeight: '120px',
              padding: '8px',
              border: '2px dashed hsl(var(--border))',
              borderRadius: '8px',
            }}
          >
            {Array.from({ length: itemCount }, (_, i) => (
              <div
                key={i}
                style={{
                  minWidth: '48px',
                  minHeight: ['stretch', 'baseline'].includes(alignItems)
                    ? undefined
                    : '48px',
                  height:
                    alignItems === 'stretch'
                      ? undefined
                      : i % 3 === 0
                        ? '64px'
                        : i % 3 === 1
                          ? '48px'
                          : '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'white',
                  background: `hsl(${(i * 47 + 200) % 360} 70% 55%)`,
                  padding: '8px 12px',
                  flexShrink: wrap === 'nowrap' ? 1 : 0,
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      <CssOutputPanel css={css} />
    </div>
  );
}

// ─── Grid 可视化沙盒（含拖拽合并单元格） ─────────────────

const AREA_COLORS = [
  'hsl(217 91% 60%)',
  'hsl(142 76% 45%)',
  'hsl(25 95% 55%)',
  'hsl(292 84% 60%)',
  'hsl(346 87% 60%)',
  'hsl(198 93% 48%)',
  'hsl(45 100% 51%)',
  'hsl(170 72% 45%)',
];

const AREA_NAMES = [
  'header',
  'nav',
  'main',
  'aside',
  'footer',
  'sidebar',
  'hero',
  'extra',
];

function GridSandbox() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(4);
  const [rowSizes, setRowSizes] = useState<string[]>(['auto', '1fr', 'auto']);
  const [colSizes, setColSizes] = useState<string[]>([
    '200px',
    '1fr',
    '1fr',
    '200px',
  ]);
  const [gapRow, setGapRow] = useState<string>('8');
  const [gapCol, setGapCol] = useState<string>('8');
  const [mergedCells, setMergedCells] = useState<MergedCell[]>([]);

  // 拖拽状态
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(
    null,
  );
  const [dragCurrent, setDragCurrent] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 同步行/列大小数组长度
  useEffect(() => {
    setRowSizes((prev) => {
      const next = [...prev];
      while (next.length < rows) next.push('1fr');
      return next.slice(0, rows);
    });
  }, [rows]);

  useEffect(() => {
    setColSizes((prev) => {
      const next = [...prev];
      while (next.length < cols) next.push('1fr');
      return next.slice(0, cols);
    });
  }, [cols]);

  // 清除越界合并单元格
  useEffect(() => {
    setMergedCells((prev) =>
      prev.filter((m) => m.rowEnd <= rows && m.colEnd <= cols),
    );
  }, [rows, cols]);

  const gridTemplateRows = rowSizes.join(' ');
  const gridTemplateColumns = colSizes.join(' ');

  // 判断某格是否被某 merged cell 覆盖（非左上角）
  const getCellMerge = (r: number, c: number) => {
    for (const m of mergedCells) {
      if (r >= m.rowStart && r < m.rowEnd && c >= m.colStart && c < m.colEnd) {
        return m;
      }
    }
    return null;
  };

  // 判断某格是否是 merged cell 的左上角
  const isMergeOrigin = (r: number, c: number) => {
    return (
      mergedCells.find((m) => m.rowStart === r && m.colStart === c) ?? null
    );
  };

  const removeMerge = (id: string) => {
    setMergedCells((prev) => prev.filter((m) => m.id !== id));
  };

  const onCellMouseDown = (r: number, c: number) => {
    setDragStart({ r, c });
    setDragCurrent({ r, c });
    setIsDragging(true);
  };

  const onCellMouseEnter = (r: number, c: number) => {
    if (isDragging) {
      setDragCurrent({ r, c });
    }
  };

  const onMouseUp = useCallback(() => {
    if (!isDragging || !dragStart || !dragCurrent) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);

    const rStart = Math.min(dragStart.r, dragCurrent.r);
    const rEnd = Math.max(dragStart.r, dragCurrent.r);
    const cStart = Math.min(dragStart.c, dragCurrent.c);
    const cEnd = Math.max(dragStart.c, dragCurrent.c);

    if (rStart === rEnd && cStart === cEnd) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    // 移除被新区域覆盖的旧合并区域
    setMergedCells((prev) => {
      const filtered = prev.filter(
        (m) =>
          !(
            m.rowStart >= rStart &&
            m.rowEnd <= rEnd + 1 &&
            m.colStart >= cStart &&
            m.colEnd <= cEnd + 1
          ),
      );
      const existingNames = new Set(filtered.map((m) => m.areaName));
      const nameIdx = AREA_NAMES.findIndex((n) => !existingNames.has(n));
      const areaName =
        nameIdx >= 0 ? AREA_NAMES[nameIdx] : `area${filtered.length + 1}`;
      return [
        ...filtered,
        {
          id: `merge-${Date.now()}`,
          rowStart: rStart,
          colStart: cStart,
          rowEnd: rEnd + 1,
          colEnd: cEnd + 1,
          areaName,
        },
      ];
    });

    setDragStart(null);
    setDragCurrent(null);
  }, [isDragging, dragStart, dragCurrent]);

  useEffect(() => {
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseUp]);

  // 判断格子是否在拖拽选区内
  const isInDragSelection = (r: number, c: number) => {
    if (!isDragging || !dragStart || !dragCurrent) return false;
    const rMin = Math.min(dragStart.r, dragCurrent.r);
    const rMax = Math.max(dragStart.r, dragCurrent.r);
    const cMin = Math.min(dragStart.c, dragCurrent.c);
    const cMax = Math.max(dragStart.c, dragCurrent.c);
    return r >= rMin && r <= rMax && c >= cMin && c <= cMax;
  };

  // 生成 CSS
  const generateCss = () => {
    const hasAreas = mergedCells.length > 0;
    let css = `.grid-container {
  display: grid;
  grid-template-columns: ${gridTemplateColumns};
  grid-template-rows: ${gridTemplateRows};
  gap: ${gapRow}px ${gapCol}px;
}`;

    if (hasAreas) {
      // 构建 grid-template-areas
      const grid: (string | null)[][] = Array.from({ length: rows }, () =>
        Array(cols).fill(null),
      );
      for (const m of mergedCells) {
        for (let r = m.rowStart; r < m.rowEnd; r++) {
          for (let c = m.colStart; c < m.colEnd; c++) {
            grid[r][c] = m.areaName;
          }
        }
      }
      const areas = grid
        .map((row) => `    "${row.map((cell) => cell ?? '.').join(' ')}"`)
        .join('\n');
      css = `.grid-container {
  display: grid;
  grid-template-columns: ${gridTemplateColumns};
  grid-template-rows: ${gridTemplateRows};
  grid-template-areas:\n${areas};
  gap: ${gapRow}px ${gapCol}px;
}`;

      const itemsCss = mergedCells
        .map((m) => `\n.${m.areaName} {\n  grid-area: ${m.areaName};\n}`)
        .join('');
      css += itemsCss;
    }

    return css;
  };

  const updateRowSize = (i: number, val: string) => {
    setRowSizes((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  };

  const updateColSize = (i: number, val: string) => {
    setColSizes((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  };

  const mergeColorMap = mergedCells.reduce(
    (acc, m, i) => ({ ...acc, [m.id]: AREA_COLORS[i % AREA_COLORS.length] }),
    {} as Record<string, string>,
  );

  return (
    <div className="space-y-4">
      {/* 行列控制 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label>{t('layout.gridSandbox.rows')}</Label>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setRows((r) => Math.max(1, r - 1))}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">{rows}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setRows((r) => Math.min(8, r + 1))}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.gridSandbox.cols')}</Label>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCols((c) => Math.max(1, c - 1))}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="w-8 text-center text-sm font-medium">{cols}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCols((c) => Math.min(8, c + 1))}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.gridSandbox.rowGap')}</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min="0"
              value={gapRow}
              onChange={(e) => setGapRow(e.target.value)}
            />
            <span className="flex items-center text-sm text-muted-foreground px-2">
              px
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('layout.gridSandbox.colGap')}</Label>
          <div className="flex gap-1">
            <Input
              type="number"
              min="0"
              value={gapCol}
              onChange={(e) => setGapCol(e.target.value)}
            />
            <span className="flex items-center text-sm text-muted-foreground px-2">
              px
            </span>
          </div>
        </div>
      </div>

      {/* 行/列尺寸快速设置 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('layout.gridSandbox.rowSizes')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {rowSizes.map((size, i) => (
              <Input
                key={i}
                className="w-24 h-7 text-xs"
                value={size}
                placeholder={`row${i + 1}`}
                onChange={(e) => updateRowSize(i, e.target.value)}
              />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('layout.gridSandbox.colSizes')}</Label>
          <div className="flex flex-wrap gap-1.5">
            {colSizes.map((size, i) => (
              <Input
                key={i}
                className="w-24 h-7 text-xs"
                value={size}
                placeholder={`col${i + 1}`}
                onChange={(e) => updateColSize(i, e.target.value)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 说明 */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
        {t('layout.gridSandbox.dragHint')}
      </div>

      {/* Grid 预览/拖拽区 */}
      <div className="border rounded-xl overflow-hidden bg-background select-none">
        <div className="px-3 py-1.5 border-b bg-muted/40 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t('layout.sandbox.preview')}
          </span>
          {mergedCells.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1 text-muted-foreground"
              onClick={() => setMergedCells([])}
            >
              <RotateCcw className="w-3 h-3" />
              {t('layout.gridSandbox.clearMerge')}
            </Button>
          )}
        </div>
        <div className="p-4 overflow-x-auto">
          <div
            className="relative"
            style={{
              display: 'grid',
              gridTemplateColumns: colSizes
                .map(() => 'minmax(60px, 1fr)')
                .join(' '),
              gridTemplateRows: rowSizes
                .map(() => 'minmax(40px, auto)')
                .join(' '),
              gap: `${gapRow}px ${gapCol}px`,
              minWidth: `${cols * 70}px`,
            }}
          >
            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const merge = getCellMerge(r, c);
                const origin = isMergeOrigin(r, c);

                // 被合并覆盖且不是左上角 → 不渲染
                if (merge && !origin) return null;

                const inDrag = isInDragSelection(r, c);
                const color = origin ? mergeColorMap[origin.id] : undefined;

                return (
                  <div
                    key={`${r}-${c}`}
                    onMouseDown={() => onCellMouseDown(r, c)}
                    onMouseEnter={() => onCellMouseEnter(r, c)}
                    style={
                      origin
                        ? {
                            gridRowStart: origin.rowStart + 1,
                            gridRowEnd: origin.rowEnd + 1,
                            gridColumnStart: origin.colStart + 1,
                            gridColumnEnd: origin.colEnd + 1,
                            background: color,
                          }
                        : undefined
                    }
                    className={cn(
                      'relative flex items-center justify-center rounded-md cursor-crosshair transition-colors duration-100 min-h-10',
                      origin
                        ? 'text-white text-sm font-semibold'
                        : inDrag
                          ? 'bg-primary/20 border-2 border-primary'
                          : 'bg-muted/50 border-2 border-dashed border-border hover:bg-muted',
                    )}
                  >
                    {origin ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xs font-mono opacity-90">
                          {origin.areaName}
                        </span>
                        <button
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => removeMerge(origin.id)}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 font-mono select-none">
                        {r + 1},{c + 1}
                      </span>
                    )}
                    {inDrag && !origin && (
                      <div className="absolute inset-0 rounded-md bg-primary/10 pointer-events-none" />
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>

      {/* 已合并区域列表 */}
      {mergedCells.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            {t('layout.gridSandbox.mergedAreas')}
          </Label>
          <div className="flex flex-wrap gap-2">
            {mergedCells.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border text-white font-medium"
                style={{ background: AREA_COLORS[i % AREA_COLORS.length] }}
              >
                <GripVertical className="w-3 h-3 opacity-70" />
                <span>{m.areaName}</span>
                <span className="opacity-70">
                  ({m.rowStart + 1}/{m.colStart + 1} → {m.rowEnd}/{m.colEnd})
                </span>
                <button
                  onClick={() => removeMerge(m.id)}
                  className="opacity-70 hover:opacity-100 ml-0.5"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <CssOutputPanel css={generateCss()} />
    </div>
  );
}

// ─── CSS 输出面板（复制 / 下载） ──────────────────────────

function CssOutputPanel({
  css,
  language = 'css',
}: {
  css: string;
  language?: 'css' | 'html';
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleDownload = () => {
    const ext = language === 'html' ? 'html' : 'css';
    const blob = new Blob([css], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {language === 'html' ? 'HTML' : 'CSS'} {t('layout.output')}
        </Label>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-500" />
                {t('layout.copied')}
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                {t('layout.copy')}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={handleDownload}
          >
            <Download className="w-3 h-3" />
            {t('layout.download')}
          </Button>
        </div>
      </div>
      <div className="relative">
        <textarea
          ref={textareaRef}
          readOnly
          value={css}
          className="w-full min-h-40 font-mono text-xs p-3 rounded-md border bg-muted/50 text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── 折叠说明区块 ─────────────────────────────────────────

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors cursor-pointer"
      >
        <span>{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      {open && (
        <div className="px-4 py-3 border-t text-sm text-muted-foreground space-y-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────

function LayoutPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">{t('layout.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('layout.desc')}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="flexGap">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="flexGap">{t('layout.tab.flexGap')}</TabsTrigger>
          <TabsTrigger value="gridCalc">{t('layout.tab.gridCalc')}</TabsTrigger>
          <TabsTrigger value="templates">
            {t('layout.tab.templates')}
          </TabsTrigger>
          <TabsTrigger value="flexSandbox">
            {t('layout.tab.flexSandbox')}
          </TabsTrigger>
          <TabsTrigger value="gridSandbox">
            {t('layout.tab.gridSandbox')}
          </TabsTrigger>
        </TabsList>

        {/* Flex Gap 计算器 */}
        <TabsContent value="flexGap" className="mt-5">
          <div className="space-y-4">
            <InfoSection title={t('layout.flexGap.about')}>
              <p>{t('layout.flexGap.aboutDesc')}</p>
            </InfoSection>
            <FlexGapCalculator />
          </div>
        </TabsContent>

        {/* Grid Column 计算器 */}
        <TabsContent value="gridCalc" className="mt-5">
          <div className="space-y-4">
            <InfoSection title={t('layout.grid.about')}>
              <p>{t('layout.grid.aboutDesc')}</p>
            </InfoSection>
            <GridColumnCalculator />
          </div>
        </TabsContent>

        {/* 布局模板 */}
        <TabsContent value="templates" className="mt-5">
          <div className="space-y-4">
            <InfoSection title={t('layout.tpl.about')}>
              <p>{t('layout.tpl.aboutDesc')}</p>
            </InfoSection>
            <LayoutTemplates />
          </div>
        </TabsContent>

        {/* Flexbox 沙盒 */}
        <TabsContent value="flexSandbox" className="mt-5">
          <div className="space-y-4">
            <InfoSection title={t('layout.sandbox.flexAbout')}>
              <p>{t('layout.sandbox.flexAboutDesc')}</p>
            </InfoSection>
            <FlexSandbox />
          </div>
        </TabsContent>

        {/* Grid 沙盒 */}
        <TabsContent value="gridSandbox" className="mt-5">
          <div className="space-y-4">
            <InfoSection title={t('layout.sandbox.gridAbout')}>
              <p>{t('layout.sandbox.gridAboutDesc')}</p>
            </InfoSection>
            <GridSandbox />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
