import { TanStackDevtools } from '@tanstack/react-devtools';
import { Link, Outlet } from '@tanstack/react-router';
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
  KeyRound,
  Layers,
  Link as LinkIcon,
  ListOrdered,
  Lock,
  MapPin,
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
  Sun,
  Table,
  Tag,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LangSwitcher } from '../components/lang-switcher';
import { TooltipProvider } from '../components/ui/tooltip';

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
 * 当右侧空间不足时自动切换到左侧弹出（通过 CSS right-full）。
 */
function OverflowCategoryRow({
  cat,
  t,
}: {
  cat: CategoryDef;
  t: (k: string) => string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  // 检测右侧是否有足够空间展开子菜单
  const [flyLeft, setFlyLeft] = useState(false);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const check = () => {
      const rect = el.getBoundingClientRect();
      // 子菜单预计宽度约 200px
      setFlyLeft(rect.right + 200 > window.innerWidth);
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

// ─── 自适应导航容器 ────────────────────────────────────────

function AdaptiveNav() {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(ALL_CATEGORIES.length);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    // "更多"按钮宽度预留（px）
    const MORE_BTN_W = 52;

    const recalc = () => {
      const available = container.offsetWidth;
      const children = Array.from(measure.children) as HTMLElement[];
      let used = 0;
      let count = 0;
      for (const child of children) {
        const w = child.offsetWidth;
        const needMore = count < ALL_CATEGORIES.length - 1;
        const budget = needMore ? available - MORE_BTN_W : available;
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
  }, []);

  const visible = ALL_CATEGORIES.slice(0, visibleCount);
  const overflow = ALL_CATEGORIES.slice(visibleCount);

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-0.5 min-w-0 flex-1"
    >
      {/* 不可见测量层 */}
      <div
        ref={measureRef}
        aria-hidden
        className="flex items-center gap-0.5 absolute opacity-0 pointer-events-none"
        style={{ visibility: 'hidden' }}
      >
        {ALL_CATEGORIES.map((cat) => (
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

// ─── 根文档 ────────────────────────────────────────────────

export default function RootDocument() {
  return (
    <div>
      <TooltipProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <header className="border-b sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
            <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
              <Link
                to="/"
                className="flex items-center gap-2 font-bold text-lg shrink-0"
              >
                <Code2 className="w-5 h-5 text-primary" />
                <span className="hidden sm:inline">Dev Tools</span>
              </Link>

              <AdaptiveNav />

              <div className="shrink-0 flex items-center gap-1">
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
    </div>
  );
}
