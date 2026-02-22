import { useFavorites } from '@/hooks/useFavorites';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import {
  AlignLeft,
  ArrowLeftRight,
  Binary,
  Braces,
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Contrast,
  Cookie,
  Database,
  Dices,
  Ellipsis,
  FileCode,
  FileCode2,
  FileStack,
  FileText,
  Fingerprint,
  Globe,
  Hash,
  ImageIcon,
  KeyRound,
  Layers,
  Link as LinkIcon,
  ListOrdered,
  Lock,
  MapPin,
  Menu,
  MonitorSmartphone,
  Moon,
  Network,
  Paintbrush,
  Palette,
  QrCode,
  Regex as RegexIcon,
  RotateCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  Shuffle,
  Sparkles,
  Star,
  Sun,
  Table,
  Tag,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { LangSwitcher } from '../components/lang-switcher';
import { Toaster } from '../components/ui/sonner';
import { TooltipProvider } from '../components/ui/tooltip';

export const Route = createRootRoute({
  component: RootDocument,
});

// ─── 主题 Hook ────────────────────────────────────────────

function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

// ─── 主题切换按钮 ──────────────────────────────────────────

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={dark ? '切换为浅色模式' : '切换为深色模式'}
      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

// ─── 类型 ──────────────────────────────────────────────────

type NavItem = { to: string; icon: React.ReactNode; labelKey: string };

type CategoryDef = {
  labelKey: string;
  icon: React.ReactNode;
  items: NavItem[];
};

// ─── 导航数据 ──────────────────────────────────────────────

const formatterNavItems: NavItem[] = [
  {
    to: '/json',
    icon: <Braces className="w-4 h-4 text-amber-500" />,
    labelKey: 'nav.json',
  },
  {
    to: '/html',
    icon: <FileCode className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.html',
  },
  {
    to: '/css',
    icon: <Paintbrush className="w-4 h-4 text-violet-500" />,
    labelKey: 'nav.css',
  },
  {
    to: '/js',
    icon: <FileCode2 className="w-4 h-4 text-yellow-500" />,
    labelKey: 'nav.js',
  },
  {
    to: '/xml',
    icon: <Tag className="w-4 h-4 text-orange-500" />,
    labelKey: 'nav.xml',
  },
  {
    to: '/markdown',
    icon: <FileText className="w-4 h-4 text-teal-500" />,
    labelKey: 'nav.markdown',
  },
  {
    to: '/sql',
    icon: <Database className="w-4 h-4 text-cyan-500" />,
    labelKey: 'nav.sql',
  },
  {
    to: '/yaml',
    icon: <FileStack className="w-4 h-4 text-green-500" />,
    labelKey: 'nav.yaml',
  },
];

const encodeNavItems: NavItem[] = [
  {
    to: '/base64',
    icon: <Binary className="w-4 h-4 text-rose-500" />,
    labelKey: 'nav.base64',
  },
  {
    to: '/url-encode',
    icon: <LinkIcon className="w-4 h-4 text-sky-500" />,
    labelKey: 'nav.urlEncode',
  },
  {
    to: '/unicode',
    icon: <Globe className="w-4 h-4 text-indigo-500" />,
    labelKey: 'nav.unicode',
  },
  {
    to: '/regex',
    icon: <RegexIcon className="w-4 h-4 text-fuchsia-500" />,
    labelKey: 'nav.regex',
  },
];

const cryptoNavItems: NavItem[] = [
  {
    to: '/hash',
    icon: <Hash className="w-4 h-4 text-emerald-500" />,
    labelKey: 'nav.hash',
  },
  {
    to: '/cipher',
    icon: <Lock className="w-4 h-4 text-red-500" />,
    labelKey: 'nav.cipher',
  },
  {
    to: '/hmac',
    icon: <KeyRound className="w-4 h-4 text-orange-500" />,
    labelKey: 'nav.hmac',
  },
  {
    to: '/jwt',
    icon: <Fingerprint className="w-4 h-4 text-purple-500" />,
    labelKey: 'nav.jwt',
  },
  {
    to: '/uuid',
    icon: <Dices className="w-4 h-4 text-pink-500" />,
    labelKey: 'nav.uuid',
  },
  {
    to: '/rot13',
    icon: <RotateCw className="w-4 h-4 text-lime-500" />,
    labelKey: 'nav.rot13',
  },
];

const networkNavItems: NavItem[] = [
  {
    to: '/http-request',
    icon: <Send className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.httpRequest',
  },
  {
    to: '/cors',
    icon: <ShieldAlert className="w-4 h-4 text-orange-500" />,
    labelKey: 'nav.cors',
  },
  {
    to: '/cookie',
    icon: <Cookie className="w-4 h-4 text-amber-500" />,
    labelKey: 'nav.cookie',
  },
  {
    to: '/ip-lookup',
    icon: <MapPin className="w-4 h-4 text-red-500" />,
    labelKey: 'nav.ipLookup',
  },
  {
    to: '/http-status',
    icon: <ListOrdered className="w-4 h-4 text-teal-500" />,
    labelKey: 'nav.httpStatus',
  },
  {
    to: '/user-agent',
    icon: <MonitorSmartphone className="w-4 h-4 text-violet-500" />,
    labelKey: 'nav.userAgent',
  },
];

const convertNavItems: NavItem[] = [
  {
    to: '/csv-convert',
    icon: <Database className="w-4 h-4 text-cyan-600" />,
    labelKey: 'nav.csvConvert',
  },
  {
    to: '/xml-json',
    icon: <ArrowLeftRight className="w-4 h-4 text-orange-600" />,
    labelKey: 'nav.xmlJson',
  },
  {
    to: '/table-convert',
    icon: <Table className="w-4 h-4 text-emerald-600" />,
    labelKey: 'nav.tableConvert',
  },
  {
    to: '/number-base',
    icon: <Binary className="w-4 h-4 text-violet-600" />,
    labelKey: 'nav.numberBase',
  },
];

const textNavItems: NavItem[] = [
  {
    to: '/text',
    icon: <CaseSensitive className="w-4 h-4 text-lime-600" />,
    labelKey: 'nav.text',
  },
  {
    to: '/datetime',
    icon: <Clock className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.datetime',
  },
  {
    to: '/password',
    icon: <ShieldPlus className="w-4 h-4 text-emerald-600" />,
    labelKey: 'nav.password',
  },
  {
    to: '/qrcode',
    icon: <QrCode className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.qrcode',
  },
];

const frontendNavItems: NavItem[] = [
  {
    to: '/color-converter',
    icon: <Palette className="w-4 h-4 text-pink-500" />,
    labelKey: 'nav.colorConverter',
  },
  {
    to: '/contrast',
    icon: <Contrast className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.contrast',
  },
  {
    to: '/css-layout',
    icon: <Layers className="w-4 h-4 text-indigo-500" />,
    labelKey: 'nav.layout',
  },
  {
    to: '/css-animation',
    icon: <Sparkles className="w-4 h-4 text-violet-500" />,
    labelKey: 'nav.cssAnimation',
  },
  {
    to: '/image',
    icon: <ImageIcon className="w-4 h-4 text-sky-500" />,
    labelKey: 'nav.imageTool',
  },
];

const ALL_CATEGORIES: CategoryDef[] = [
  {
    labelKey: 'nav.catFormatter',
    icon: <AlignLeft className="w-4 h-4" />,
    items: formatterNavItems,
  },
  {
    labelKey: 'nav.catEncode',
    icon: <Shuffle className="w-4 h-4" />,
    items: encodeNavItems,
  },
  {
    labelKey: 'nav.catCrypto',
    icon: <ShieldCheck className="w-4 h-4" />,
    items: cryptoNavItems,
  },
  {
    labelKey: 'nav.catNetwork',
    icon: <Network className="w-4 h-4" />,
    items: networkNavItems,
  },
  {
    labelKey: 'nav.catConvert',
    icon: <ArrowLeftRight className="w-4 h-4" />,
    items: convertNavItems,
  },
  {
    labelKey: 'nav.catFrontend',
    icon: <Palette className="w-4 h-4" />,
    items: frontendNavItems,
  },
  {
    labelKey: 'nav.catOther',
    icon: <Layers className="w-4 h-4" />,
    items: textNavItems,
  },
];

// ─── 所有导航项的扁平查找表（路径 → NavItem） ──────────────

const ALL_NAV_ITEMS_MAP: Record<string, NavItem> = Object.fromEntries(
  [
    ...formatterNavItems,
    ...encodeNavItems,
    ...cryptoNavItems,
    ...networkNavItems,
    ...convertNavItems,
    ...frontendNavItems,
    ...textNavItems,
  ].map((item) => [item.to, item]),
);

// ─── 收藏分类 Hook ─────────────────────────────────────────

function useFavoriteCategory(): CategoryDef | null {
  const { favoritePaths, ready } = useFavorites();
  if (!ready || favoritePaths.length === 0) return null;

  const items: NavItem[] = favoritePaths
    .map((path) => ALL_NAV_ITEMS_MAP[path])
    .filter((item): item is NavItem => item !== undefined);

  if (items.length === 0) return null;

  return {
    labelKey: 'nav.catFavorites',
    icon: <Star className="w-4 h-4 text-yellow-400" />,
    items,
  };
}

// ─── 普通分类下拉菜单 ──────────────────────────────────────

function CategoryMenu({ labelKey, icon, items }: CategoryDef) {
  const { t } = useTranslation();
  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer select-none whitespace-nowrap">
        {icon}
        <span>{t(labelKey)}</span>
        <ChevronDown className="w-3 h-3 opacity-60 transition-transform duration-200 group-hover:rotate-180" />
      </button>
      <div
        className="
        absolute top-[calc(100%+4px)] left-0
        min-w-[180px] rounded-xl border bg-background/95 backdrop-blur-md shadow-lg
        py-1.5 z-50
        opacity-0 invisible translate-y-1
        group-hover:opacity-100 group-hover:visible group-hover:translate-y-0
        transition-all duration-150 ease-out
      "
      >
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mx-1 rounded-lg"
            activeProps={{
              className:
                'flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground bg-accent mx-1 rounded-lg',
            }}
          >
            {item.icon}
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── 溢出"更多"菜单（纵向分类列表 + 向右展开子菜单） ──────

function OverflowMenu({ categories }: { categories: CategoryDef[] }) {
  const { t } = useTranslation();

  return (
    <div className="relative group/more">
      {/* 触发按钮 */}
      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer select-none">
        <Ellipsis className="w-4 h-4" />
        <ChevronDown className="w-3 h-3 opacity-60 transition-transform duration-200 group-hover/more:rotate-180" />
      </button>

      {/* 第一级：纵向分类列表 */}
      <div
        className="
        absolute top-[calc(100%+4px)] right-0
        min-w-[180px] rounded-xl border bg-background/95 backdrop-blur-md shadow-lg
        py-1.5 z-50
        opacity-0 invisible translate-y-1
        group-hover/more:opacity-100 group-hover/more:visible group-hover/more:translate-y-0
        transition-all duration-150 ease-out
      "
      >
        {categories.map((cat) => (
          <OverflowCategoryRow key={cat.labelKey} cat={cat} t={t} />
        ))}
      </div>
    </div>
  );
}

/**
 * 溢出菜单里的单行分类。
 * hover 时子菜单向右弹出（flyout）。
 * 用真实 DOM 测量子菜单宽度，判断右侧空间是否充足，不足则向左弹出。
 */
function OverflowCategoryRow({
  cat,
  t,
}: {
  cat: CategoryDef;
  t: (k: string) => string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [flyLeft, setFlyLeft] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    const submenu = submenuRef.current;
    if (!row || !submenu) return;

    const check = () => {
      const rowRect = row.getBoundingClientRect();
      // 使用子菜单的真实渲染宽度（即使不可见时也能读到 offsetWidth）
      const submenuW = submenu.offsetWidth;
      setFlyLeft(rowRect.right + submenuW > window.innerWidth);
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div ref={rowRef} className="relative group/row mx-1">
      {/* 分类行 */}
      <div className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-default select-none transition-colors">
        {cat.icon}
        <span className="flex-1">{t(cat.labelKey)}</span>
        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
      </div>

      {/* 第二级：子菜单（向右或向左弹出） */}
      <div
        ref={submenuRef}
        className={`
          absolute top-0
          ${flyLeft ? 'right-full mr-1' : 'left-full ml-1'}
          min-w-[180px] rounded-xl border bg-background/95 backdrop-blur-md shadow-lg
          py-1.5 z-50
          opacity-0 invisible translate-x-1
          group-hover/row:opacity-100 group-hover/row:visible group-hover/row:translate-x-0
          transition-all duration-150 ease-out
        `}
      >
        {cat.items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mx-1 rounded-lg"
            activeProps={{
              className:
                'flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground bg-accent mx-1 rounded-lg',
            }}
          >
            {item.icon}
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── 自适应导航容器（桌面端） ──────────────────────────────

function AdaptiveNav() {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLDivElement>(null);
  // 初始为 null，表示尚未完成首次测量，此时隐藏导航避免闪动
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  // 收藏分类（有收藏时排在最前面）
  const favoriteCategory = useFavoriteCategory();
  const categories = favoriteCategory
    ? [favoriteCategory, ...ALL_CATEGORIES]
    : ALL_CATEGORIES;

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    const moreBtn = moreBtnRef.current;
    if (!container || !measure || !moreBtn) return;

    const recalc = () => {
      const available = container.offsetWidth;
      const children = Array.from(measure.children) as HTMLElement[];
      // 用真实 DOM 测量"更多"按钮的实际渲染宽度
      const moreBtnW = moreBtn.offsetWidth;
      let used = 0;
      let count = 0;
      for (const child of children) {
        const w = child.offsetWidth;
        // 如果还剩余分类未放入，需要预留"更多"按钮的空间
        const needMore = count < categories.length - 1;
        const budget = needMore ? available - moreBtnW : available;
        if (used + w > budget) break;
        used += w;
        count++;
      }
      setVisibleCount(count);
    };

    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    const raf = requestAnimationFrame(recalc);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [categories.length]);

  // visibleCount 为 null 表示首次测量尚未完成，用 ?? 兜底避免 TS 报错
  const resolvedCount = visibleCount ?? 0;
  const visible = categories.slice(0, resolvedCount);
  const overflow = categories.slice(resolvedCount);

  return (
    <div
      ref={containerRef}
      // 首次测量完成前保持不可见，防止全部展开再收缩的闪动
      className={`flex items-center gap-0.5 min-w-0 flex-1 ${visibleCount === null ? 'invisible' : ''}`}
    >
      {/* 不可见测量层（测量所有分类按钮的真实宽度） */}
      <div
        ref={measureRef}
        aria-hidden
        className="flex items-center gap-0.5 absolute opacity-0 pointer-events-none"
        style={{ visibility: 'hidden' }}
      >
        {categories.map((cat) => (
          <div
            key={cat.labelKey}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm whitespace-nowrap"
          >
            {cat.icon}
            <MeasureLabel labelKey={cat.labelKey} />
            <ChevronDown className="w-3 h-3" />
          </div>
        ))}
      </div>

      {/* 不可见"更多"按钮（用于测量其真实宽度） */}
      <div
        ref={moreBtnRef}
        aria-hidden
        className="flex items-center gap-1 px-2.5 py-1.5 text-sm whitespace-nowrap absolute opacity-0 pointer-events-none"
        style={{ visibility: 'hidden' }}
      >
        <Ellipsis className="w-4 h-4" />
        <ChevronDown className="w-3 h-3" />
      </div>

      {/* 可见菜单 */}
      {visible.map((cat) => (
        <CategoryMenu key={cat.labelKey} {...cat} />
      ))}

      {/* 溢出菜单 */}
      {overflow.length > 0 && <OverflowMenu categories={overflow} />}
    </div>
  );
}

function MeasureLabel({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <span>{t(labelKey)}</span>;
}

// ─── 移动端抽屉导航 ────────────────────────────────────────

function MobileNav() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // 收藏分类（有收藏时排在最前面）
  const favoriteCategory = useFavoriteCategory();
  const categories = favoriteCategory
    ? [favoriteCategory, ...ALL_CATEGORIES]
    : ALL_CATEGORIES;

  // 打开时锁定 html 元素滚动（比锁 body 更可靠，兼容移动端 Safari）
  useEffect(() => {
    const html = document.documentElement;
    if (open) {
      // 保存当前滚动位置，防止 iOS 弹回
      const scrollY = window.scrollY;
      html.style.overflow = 'hidden';
      html.style.position = 'fixed';
      html.style.width = '100%';
      html.style.top = `-${scrollY}px`;
    } else {
      const top = html.style.top;
      html.style.overflow = '';
      html.style.position = '';
      html.style.width = '';
      html.style.top = '';
      // 恢复滚动位置
      if (top) {
        window.scrollTo(0, -parseInt(top, 10));
      }
    }
    return () => {
      html.style.overflow = '';
      html.style.position = '';
      html.style.width = '';
      html.style.top = '';
    };
  }, [open]);

  const toggleCat = (key: string) => {
    setExpandedCat((prev) => (prev === key ? null : key));
  };

  const close = () => {
    setOpen(false);
    setExpandedCat(null);
  };

  // 遮罩 + 抽屉用 Portal 渲染到 document.body，
  // 避免被 header 的 sticky/backdrop-filter 创建的 stacking context 裁剪
  const drawer = createPortal(
    <>
      {/* 遮罩 */}
      <div
        className={`
          fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm
          transition-opacity duration-300
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={close}
      />

      {/* 抽屉 */}
      <div
        className={`
          fixed top-0 left-0 h-full w-72 max-w-[85vw] z-[101]
          bg-background border-r shadow-xl
          flex flex-col
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 抽屉头部 */}
        <div className="flex items-center justify-between px-4 h-14 border-b shrink-0">
          <Link
            to="/"
            onClick={close}
            className="flex items-center gap-2 font-bold text-lg"
          >
            <Code2 className="w-5 h-5 text-primary" />
            <span>Dev Tools</span>
          </Link>
          <button
            onClick={close}
            aria-label="关闭导航菜单"
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 分类列表（可滚动） */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-2">
          {categories.map((cat) => {
            const isExpanded = expandedCat === cat.labelKey;
            return (
              <div key={cat.labelKey}>
                {/* 分类标题行 */}
                <button
                  onClick={() => toggleCat(cat.labelKey)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors select-none"
                >
                  {cat.icon}
                  <span className="flex-1 text-left">{t(cat.labelKey)}</span>
                  <ChevronRight
                    className={`w-3.5 h-3.5 opacity-50 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* 子项列表（展开/收起） */}
                {isExpanded && (
                  <div className="bg-accent/30">
                    {cat.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={close}
                        className="flex items-center gap-2.5 pl-10 pr-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        activeProps={{
                          className:
                            'flex items-center gap-2.5 pl-10 pr-4 py-2 text-sm text-foreground bg-accent',
                        }}
                      >
                        {item.icon}
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  );

  return (
    <>
      {/* 汉堡按钮（保留在 header 内正常流） */}
      <button
        onClick={() => setOpen(true)}
        aria-label="打开导航菜单"
        className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* 遮罩 + 抽屉挂载到 body */}
      {drawer}
    </>
  );
}

// ─── 根文档 ────────────────────────────────────────────────

function RootDocument() {
  return (
    <div>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <header className="border-b sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
            <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
              {/* 移动端：汉堡菜单按钮 */}
              <div className="md:hidden shrink-0">
                <MobileNav />
              </div>

              {/* Logo */}
              <Link
                to="/"
                className="flex items-center gap-2 font-bold text-lg shrink-0"
              >
                <Code2 className="w-5 h-5 text-primary" />
                <span className="hidden sm:inline">Dev Tools</span>
              </Link>

              {/* 桌面端：自适应导航 */}
              <div className="hidden md:flex min-w-0 flex-1">
                <AdaptiveNav />
              </div>

              <div className="shrink-0 flex items-center gap-1 ml-auto md:ml-0">
                <ThemeToggle />
                <LangSwitcher />
              </div>
            </nav>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </TooltipProvider>
      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[{ name: 'Router', render: <TanStackRouterDevtoolsPanel /> }]}
      />
      <Toaster />
    </div>
  );
}
