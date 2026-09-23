import { PRACTICAL_TOOLS } from '@/lib/practical-tool-catalog';
import { resetFavorites, useFavorites } from '@/hooks/useFavorites';
import { setAuthGuest, useAuthSession } from '@/hooks/useAuthSession';
import { useOptionalAuthMutation } from '@/hooks/useOptionalAuth';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { assertSessionActive } from '@/lib/optional-auth';
import { queryClient } from '@/lib/query-client';
import { getToolShell } from '@/lib/tool-shells';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRoute,
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import Fuse from 'fuse.js';
import {
  PencilRuler,
  Frame,
  Tags,
  ContactRound,
  Armchair,
  Calculator,
  Languages,
  UsersRound,
  CalendarDays,
  Grid2X2,
  BookOpenCheck,
  Backpack,
  CreditCard,
  PackageOpen,
  Music2,
  Trophy,
  Scale,
  Scissors,
  Sofa,
  Tally5,
  Gamepad2,
  ScrollText,
  Printer,
  Timer,
  Headphones,
  Activity,
  AudioLines,
  ArrowLeftRight,
  Binary,
  Braces,
  CalendarClock,
  CaseSensitive,
  Captions,
  ChevronRight,
  CircleUserRound,
  Clock,
  Code2,
  Contrast,
  Cookie,
  Database,
  Dices,
  FileCode,
  FileCode2,
  FileArchive,
  FileStack,
  FileText,
  Fingerprint,
  Flower2,
  Globe,
  Hash,
  Heart,
  Home,
  House,
  ImageIcon,
  Images,
  Keyboard,
  KeyRound,
  Landmark,
  Layers,
  Link as LinkIcon,
  ListOrdered,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MonitorSmartphone,
  Moon,
  Network,
  Paintbrush,
  Palette,
  QrCode,
  Ratio,
  Regex as RegexIcon,
  RotateCw,
  Ruler,
  Search,
  Send,
  Share2,
  Smile,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  Sparkles,
  SquareAsterisk,
  Star,
  Sun,
  Table,
  Tag,
  Terminal,
  Thermometer,
  Type,
  Video,
  Wallet,
  Wind,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LangSwitcher } from '../components/lang-switcher';
import { Button } from '../components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../components/ui/hover-card';
import { Input } from '../components/ui/input';
import { Toaster } from '../components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

export const Route = createRootRoute({
  component: RootDocument,
});

// ─── 主题切换按钮 ──────────────────────────────────────────

function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const label = t(dark ? 'shell.lightMode' : 'shell.darkMode');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleTheme}
          aria-label={label}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── 类型 ──────────────────────────────────────────────────

type NavItem = {
  to: string;
  icon: React.ReactNode;
  labelKey: string;
  keywords?: string;
};

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
    keywords:
      'json jsonld jsonlogic JSON-LD JSONLogic format minify schema typescript zod interface jsonpath jq jsonata transform aggregate graph visualize ndjson patch 格式化 类型 关系图 规则',
  },
  {
    to: '/html',
    icon: <FileCode className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.html',
    keywords:
      'html css selector xpath visual accessibility axe aria a11y 选择器 可视化 无障碍 检查 ax tree accessibility 无障碍树',
  },
  {
    to: '/css',
    icon: <Paintbrush className="w-4 h-4 text-violet-500" />,
    labelKey: 'nav.css',
    keywords: 'cascade layer 层叠',
  },
  {
    to: '/js',
    icon: <FileCode2 className="w-4 h-4 text-yellow-500" />,
    labelKey: 'nav.js',
    keywords:
      'javascript typescript ast babel 语法树 html css sandbox playground live preview event inspector keyboard pointer clipboard 沙箱 在线编程 运行 实时预览 事件 检查器',
  },
  {
    to: '/xml',
    icon: <Tag className="w-4 h-4 text-orange-500" />,
    labelKey: 'nav.xml',
    keywords:
      'xml xpath xsd schema validation plist apple binary property list 格式化 转换 校验',
  },
  {
    to: '/markdown',
    icon: <FileText className="w-4 h-4 text-teal-500" />,
    labelKey: 'nav.markdown',
    keywords:
      'markdown mermaid diagram flowchart sequence svg png toc table of contents 图表 流程图 目录',
  },
  {
    to: '/sql',
    icon: <Database className="w-4 h-4 text-cyan-500" />,
    labelKey: 'nav.sql',
    keywords:
      'sql explain postgres postgresql mysql ddl er dependencies plan 表依赖 关系图 执行计划',
  },
  {
    to: '/sql-playground',
    icon: <Database className="w-4 h-4 text-emerald-500" />,
    labelKey: 'nav.sqlPlayground',
    keywords: 'sqlite sql playground practice query database wasm opfs',
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
    keywords: 'base64 base32 encode decode 编码 解码',
  },
  {
    to: '/url-encode',
    icon: <LinkIcon className="w-4 h-4 text-sky-500" />,
    labelKey: 'nav.urlEncode',
    keywords: 'url safe links redirect unwrap decode 跳转 链接 还原',
  },
  {
    to: '/unicode',
    icon: <Globe className="w-4 h-4 text-indigo-500" />,
    labelKey: 'nav.unicode',
    keywords: 'unicode utf8 utf16 codepoint 转义 码位',
  },
  {
    to: '/regex',
    icon: <RegexIcon className="w-4 h-4 text-fuchsia-500" />,
    labelKey: 'nav.regex',
  },
];

const cryptoNavItems: NavItem[] = [
  {
    to: '/oauth',
    icon: <ShieldPlus className="h-4 w-4 text-blue-500" />,
    labelKey: 'nav.oauth',
    keywords: 'oauth oidc pkce authorization callback state nonce 授权 登录',
  },
  {
    to: '/certificate-tool',
    icon: <KeyRound className="h-4 w-4 text-teal-500" />,
    labelKey: 'nav.certificateTool',
    keywords:
      'x509 pem jwk csr certificate ssh openssh fingerprint 证书 公钥 指纹 域名 有效期 转换 pkcs12 pfx p12',
  },
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
    to: '/totp',
    icon: <ShieldCheck className="w-4 h-4 text-cyan-500" />,
    labelKey: 'nav.totp',
  },
  {
    to: '/jwt',
    icon: <Fingerprint className="w-4 h-4 text-purple-500" />,
    labelKey: 'nav.jwt',
    keywords:
      'jwt jwk pem signature verify public key 公钥 签名 验证 jwe paseto',
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
    to: '/dns',
    icon: <Network className="h-4 w-4 text-sky-500" />,
    labelKey: 'nav.dns',
    keywords: 'dns doh domain record cname mx txt ns 域名 解析',
  },
  {
    to: '/webrtc-diagnostics',
    icon: <Network className="h-4 w-4 text-indigo-500" />,
    labelKey: 'nav.webrtcDiagnostics',
    keywords: 'webrtc ice stun turn camera microphone codec candidate',
  },
  {
    to: '/realtime-debugger',
    icon: <Network className="h-4 w-4 text-cyan-500" />,
    labelKey: 'nav.realtimeDebugger',
    keywords: 'websocket sse eventsource realtime debug 实时 调试',
  },
  {
    to: '/http-request',
    icon: <Send className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.httpRequest',
  },
  {
    to: '/curl-converter',
    icon: <Terminal className="w-4 h-4 text-slate-600" />,
    labelKey: 'nav.curlConverter',
    keywords: 'curl fetch axios http converter 转换',
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
    to: '/cidr',
    icon: <Network className="h-4 w-4 text-emerald-500" />,
    labelKey: 'nav.cidr',
    keywords: 'cidr ipv4 subnet mask broadcast range 子网 掩码 广播',
  },
  {
    to: '/ipv6',
    icon: <Network className="h-4 w-4 text-sky-500" />,
    labelKey: 'nav.ipv6',
    keywords: 'ipv6 cidr compress expand ula 网络 地址',
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
    keywords:
      'csv tsv json sql profile data quality duplicate 空值 重复 数据体检',
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
    to: '/emoji-picker',
    icon: <Smile className="h-4 w-4 text-amber-500" />,
    labelKey: 'nav.emojiPicker',
    keywords: 'emoji picker smiley symbol 表情 选择器 符号',
  },
  {
    to: '/pdf-toolkit',
    icon: <FileText className="h-4 w-4 text-red-500" />,
    labelKey: 'nav.pdfToolkit',
    keywords:
      'pdf merge split rotate reorder watermark metadata images signature byte range 合并 拆分 水印 签名',
  },
  {
    to: '/batch-files',
    icon: <FileStack className="h-4 w-4 text-amber-500" />,
    labelKey: 'nav.batchFiles',
    keywords:
      '批量 文件 重命名 扩展名 hash manifest split merge chunk rename files 大文件 拆分 合并 分片',
  },
  {
    to: '/text-to-speech',
    icon: <AudioLines className="h-4 w-4 text-violet-500" />,
    labelKey: 'nav.textToSpeech',
    keywords: '文本 朗读 语音 tts speech synthesis voice',
  },
  {
    to: '/diff',
    icon: <ArrowLeftRight className="w-4 h-4 text-orange-500" />,
    labelKey: 'nav.diff',
    keywords:
      'diff compare text json code difference comparison git patch unified 补丁',
  },
  {
    to: '/text',
    icon: <CaseSensitive className="w-4 h-4 text-lime-600" />,
    labelKey: 'nav.text',
    keywords:
      'text phone libphonenumber lorem ipsum ascii art 文本 手机号 占位文本 字符画',
  },
  {
    to: '/datetime',
    icon: <Clock className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.datetime',
    keywords: 'date time stopwatch lap timer 日期 时间 秒表 计次',
  },
  {
    to: '/password',
    icon: <ShieldPlus className="w-4 h-4 text-emerald-600" />,
    labelKey: 'nav.password',
    keywords: 'password bip39 mnemonic seed entropy 密码 助记词 校验和',
  },
  {
    to: '/qrcode',
    icon: <QrCode className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.qrcode',
  },
];

const frontendNavItems: NavItem[] = [
  {
    to: '/image-collage',
    icon: <Images className="h-4 w-4 text-teal-500" />,
    labelKey: 'imageCollage.title',
    keywords: '长图 拼图 九宫格 合并 collage stitch grid',
  },
  {
    to: '/document-scanner',
    icon: <FileText className="h-4 w-4 text-teal-500" />,
    labelKey: 'documentScanner.title',
    keywords: '扫描 文档 透视 校正 证件 PDF scan document',
  },
  {
    to: '/design-tokens',
    icon: <Palette className="h-4 w-4 text-primary" />,
    labelKey: 'nav.designTokens',
    keywords: 'design tokens dtcg css variables 设计 变量 令牌',
  },
  {
    to: '/gradient-studio',
    icon: <Palette className="h-4 w-4 text-fuchsia-500" />,
    labelKey: 'nav.gradientStudio',
    keywords: 'gradient css linear radial conic mesh pattern noise 渐变',
  },
  {
    to: '/svg-toolkit',
    icon: <FileCode2 className="h-4 w-4 text-orange-500" />,
    labelKey: 'nav.svgToolkit',
    keywords: 'svg path optimize data uri react jsx sprite 路径 编辑 测量',
  },
  {
    to: '/font',
    icon: <Type className="w-4 h-4 text-emerald-500" />,
    labelKey: 'nav.font',
    keywords: 'font glyph ttf otf woff woff2 typeface typography',
  },
  {
    to: '/css-unit',
    icon: <Ruler className="w-4 h-4 text-violet-500" />,
    labelKey: 'nav.cssUnit',
    keywords: 'px rem vw css',
  },
  {
    to: '/color-converter',
    icon: <Palette className="w-4 h-4 text-pink-500" />,
    labelKey: 'nav.colorConverter',
  },
  {
    to: '/contrast',
    icon: <Contrast className="w-4 h-4 text-blue-500" />,
    labelKey: 'nav.contrast',
    keywords:
      'wcag contrast color blindness protanopia deuteranopia tritanopia 色盲 色觉',
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
    to: '/css-shadow',
    icon: <Wind className="w-4 h-4 text-stone-500" />,
    labelKey: 'nav.cssShadow',
    keywords: 'box-shadow border-radius 阴影 圆角 css',
  },
  {
    to: '/css-tailwind',
    icon: <SquareAsterisk className="w-4 h-4 text-cyan-600" />,
    labelKey: 'nav.cssTailwind',
    keywords: 'tailwind css class converter 转换',
  },
  {
    to: '/aspect-ratio',
    icon: <Ratio className="w-4 h-4 text-teal-500" />,
    labelKey: 'nav.aspectRatio',
    keywords: 'aspect ratio safe area 宽高比 安全区',
  },
  {
    to: '/og-preview',
    icon: <Share2 className="w-4 h-4 text-sky-600" />,
    labelKey: 'nav.ogPreview',
    keywords: 'og open graph meta twitter preview 分享 预览',
  },
  {
    to: '/image',
    icon: <ImageIcon className="w-4 h-4 text-sky-500" />,
    labelKey: 'nav.imageTool',
  },
  {
    to: '/image-compare',
    icon: <Images className="h-4 w-4 text-rose-500" />,
    labelKey: 'nav.imageCompare',
    keywords: 'image compare diff heatmap slider blink 图片 对比 差异',
  },
  {
    to: '/pwa-icons',
    icon: <MonitorSmartphone className="h-4 w-4 text-blue-500" />,
    labelKey: 'nav.pwaIcons',
    keywords: 'pwa favicon icon manifest maskable apple touch',
  },
  {
    to: '/image-palette',
    icon: <Palette className="h-4 w-4 text-fuchsia-500" />,
    labelKey: 'nav.imagePalette',
    keywords:
      '图片 取色 调色板 占位符 placeholder thumbhash blurhash palette color tailwind css contrast',
  },
  {
    to: '/id-photo',
    icon: <ImageIcon className="h-4 w-4 text-blue-500" />,
    labelKey: 'nav.idPhoto',
    keywords: '证件照 背景 换色 一寸 二寸 passport photo a4',
  },
  {
    to: '/image-privacy',
    icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
    labelKey: 'nav.imagePrivacy',
    keywords: '图片 隐私 exif gps metadata image privacy',
  },
  {
    to: '/webp-gif',
    icon: <ArrowLeftRight className="w-4 h-4 text-lime-500" />,
    labelKey: 'nav.webpGif',
    keywords: 'webp gif image convert converter',
  },
];

const imageNavItems = frontendNavItems.filter(
  (item) =>
    item.to === '/image' ||
    item.to === '/image-compare' ||
    item.to === '/image-collage' ||
    item.to === '/document-scanner' ||
    item.to === '/pwa-icons' ||
    item.to === '/image-palette' ||
    item.to === '/id-photo' ||
    item.to === '/image-privacy' ||
    item.to === '/webp-gif' ||
    item.to === '/og-preview',
);
const designNavItems = frontendNavItems.filter(
  (item) =>
    item.to !== '/image' &&
    item.to !== '/image-compare' &&
    item.to !== '/image-collage' &&
    item.to !== '/document-scanner' &&
    item.to !== '/pwa-icons' &&
    item.to !== '/image-palette' &&
    item.to !== '/id-photo' &&
    item.to !== '/image-privacy' &&
    item.to !== '/webp-gif' &&
    item.to !== '/og-preview',
);
const developerToolNavItems: NavItem[] = [
  {
    to: '/chrome-coverage',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.chromeCoverage.title',
    keywords: 'coverage unused js css 覆盖 未使用 体积',
  },
  {
    to: '/react-profiler',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.reactProfiler.title',
    keywords: 'react profiler commit 渲染 组件 性能',
  },
  {
    to: '/pprof',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.pprof.title',
    keywords: 'pprof golang cpu memory flamegraph 采样',
  },
  {
    to: '/prometheus',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.prometheus.title',
    keywords: 'prometheus openmetrics promql 指标 监控',
  },
  {
    to: '/binary-data',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.binaryData.title',
    keywords: 'bson ejson mongodb amazon ion 二进制',
  },
  {
    to: '/arrow-viewer',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.arrowViewer.title',
    keywords: 'arrow ipc feather 数据 列',
  },
  {
    to: '/hcl-inspector',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.hclInspector.title',
    keywords: 'hcl terraform syntax 资源 配置',
  },
  {
    to: '/openpgp',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.openpgp.title',
    keywords: 'openpgp pgp gpg 加密 签名',
  },
  {
    to: '/pcap-viewer',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'communityNext.pcapViewer.title',
    keywords: 'pcap pcapng wireshark 抓包 协议',
  },

  {
    to: '/heap-snapshot',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityHeap',
    keywords: 'heap snapshot memory 内存 泄漏 对比',
  },
  {
    to: '/chrome-trace',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityTrace',
    keywords: 'chrome trace performance timeline 长任务 线程',
  },
  {
    to: '/netlog-viewer',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityNetlog',
    keywords: 'chrome netlog dns socket 网络 日志',
  },
  {
    to: '/playwright-trace',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityPlaywright',
    keywords: 'playwright trace zip test 测试 截图',
  },
  {
    to: '/asyncapi',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityAsyncapi',
    keywords: 'asyncapi schema event 消息 事件',
  },
  {
    to: '/cel',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityCel',
    keywords: 'cel expression rule 表达式 规则',
  },
  {
    to: '/spdx-expression',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communitySpdx',
    keywords: 'spdx license expression 许可证',
  },
  {
    to: '/mqtt-packet',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityMqtt',
    keywords: 'mqtt packet binary 报文 协议',
  },
  {
    to: '/feed-inspector',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityFeed',
    keywords: 'rss atom feed 订阅',
  },
  {
    to: '/gltf-inspector',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityModel',
    keywords: 'gltf glb 3d model 模型 三维',
  },
  {
    to: '/browser-capabilities',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.communityCapabilities',
    keywords: 'webgpu webcodecs codec gpu 编解码 能力',
  },
  {
    to: '/lighthouse-report',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.lighthouseReport',
    keywords: 'lighthouse lcp cls tbt performance 性能 报告 对比',
  },
  {
    to: '/otel-viewer',
    icon: <Network className="h-4 w-4 text-primary" />,
    labelKey: 'nav.otelViewer',
    keywords: 'opentelemetry otlp span trace waterfall 链路 瀑布图',
  },
  {
    to: '/rrweb-player',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.rrwebPlayer',
    keywords: 'rrweb replay session recording 回放 录制',
  },
  {
    to: '/sbom-viewer',
    icon: <ShieldAlert className="h-4 w-4 text-primary" />,
    labelKey: 'nav.sbomViewer',
    keywords: 'sbom cyclonedx spdx dependency license 组件 依赖 许可证',
  },
  {
    to: '/browser-compat',
    icon: <Globe className="h-4 w-4 text-primary" />,
    labelKey: 'nav.browserCompat',
    keywords:
      'browserslist caniuse compatibility browser css webapi 兼容 浏览器 支持',
  },
  {
    to: '/geojson',
    icon: <Globe className="h-4 w-4 text-primary" />,
    labelKey: 'nav.geojson',
    keywords: 'geojson geometry map coordinate 地理 坐标 地图',
  },

  {
    to: '/test-report',
    icon: <FileText className="h-4 w-4 text-primary" />,
    labelKey: 'nav.testReport',
    keywords: 'junit lcov coverage test report 测试 报告 覆盖率',
  },

  {
    to: '/sarif-viewer',
    icon: <ShieldAlert className="h-4 w-4 text-primary" />,
    labelKey: 'nav.sarifViewer',
    keywords: 'sarif security scan static findings 扫描 静态 检查 报告',
  },
  {
    to: '/graphql-diff',
    icon: <Network className="h-4 w-4 text-primary" />,
    labelKey: 'nav.graphqlDiff',
    keywords: 'graphql schema sdl introspection breaking diff 对比 破坏性',
  },
  {
    to: '/cpu-profile',
    icon: <Activity className="h-4 w-4 text-primary" />,
    labelKey: 'nav.cpuProfile',
    keywords:
      'cpu profile cpuprofile flamegraph performance 性能 火焰图 调用栈',
  },
  {
    to: '/i18n-checker',
    icon: <Globe className="h-4 w-4 text-muted-foreground" />,
    labelKey: 'nav.i18nChecker',
    keywords:
      'icu plural messageformat i18n translation locale placeholder 翻译 校验 多语言 复数',
  },
  {
    to: '/table-diff',
    icon: <Table className="h-4 w-4 text-muted-foreground" />,
    labelKey: 'nav.tableDiff',
    keywords: 'csv json diff key sku 表格 主键 对比',
  },
  {
    to: '/data-redactor',
    icon: <ShieldAlert className="h-4 w-4 text-muted-foreground" />,
    labelKey: 'nav.dataRedactor',
    keywords: 'redact pii secret token 脱敏 隐私',
  },
  {
    to: '/log-explorer',
    icon: <Activity className="h-4 w-4 text-muted-foreground" />,
    labelKey: 'nav.logExplorer',
    keywords: 'log jsonl ndjson error 日志 筛选',
  },
  {
    to: '/parquet-viewer',
    icon: <Database className="h-4 w-4 text-muted-foreground" />,
    labelKey: 'nav.parquetViewer',
    keywords: 'parquet arrow schema data 数据 列式',
  },
  {
    to: '/mcp-trace',
    icon: <Network className="h-4 w-4 text-muted-foreground" />,
    labelKey: 'nav.mcpTrace',
    keywords: 'mcp jsonrpc trace replay agent 记录 调用',
  },
  {
    to: '/ocr',
    icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    labelKey: 'nav.ocr',
    keywords: 'ocr image pdf text scan 文字 识别 扫描',
  },

  {
    to: '/trace-context',
    icon: <Network className="h-4 w-4 text-sky-500" />,
    labelKey: 'nav.traceContext',
    keywords: 'traceparent tracestate baggage opentelemetry tracing 链路追踪',
  },
  {
    to: '/pipeline',
    icon: <Share2 className="h-4 w-4 text-violet-500" />,
    labelKey: 'nav.pipeline',
    keywords: 'pipeline recipe transform encode decode hash 处理 管道',
  },
  {
    to: '/har-analyzer',
    icon: <Activity className="h-4 w-4 text-cyan-500" />,
    labelKey: 'nav.harAnalyzer',
    keywords: 'har network waterfall request timing size headers 网络 瀑布图',
  },
  {
    to: '/hex-inspector',
    icon: <Binary className="h-4 w-4 text-lime-500" />,
    labelKey: 'nav.hexInspector',
    keywords:
      'hex binary mime magic bytes endian strings avro wasm wat webassembly protobuf 二进制 十六进制',
  },
  {
    to: '/docker-compose',
    icon: <Terminal className="h-4 w-4 text-blue-500" />,
    labelKey: 'nav.dockerCompose',
    keywords: 'docker run compose yaml container 容器 转换',
  },
  {
    to: '/webauthn-debugger',
    icon: <Fingerprint className="h-4 w-4 text-purple-500" />,
    labelKey: 'nav.webauthnDebugger',
    keywords: 'webauthn passkey credential authenticator biometric 通行密钥',
  },
  {
    to: '/email-headers',
    icon: <FileText className="h-4 w-4 text-teal-500" />,
    labelKey: 'nav.emailHeaders',
    keywords:
      'email mail header received spf dkim dmarc mime 邮件头 dmarc aggregate 聚合报告',
  },
  {
    to: '/openapi',
    icon: <FileCode2 className="h-4 w-4 text-blue-500" />,
    labelKey: 'nav.openapi',
    keywords:
      'openapi swagger endpoint schema curl mock response example 接口 响应示例',
  },
  {
    to: '/cron',
    icon: <Clock className="h-4 w-4 text-violet-500" />,
    labelKey: 'nav.cron',
    keywords: 'cron crontab schedule expression 定时 表达式',
  },
  {
    to: '/env',
    icon: <FileText className="h-4 w-4 text-emerald-500" />,
    labelKey: 'nav.envTool',
    keywords: 'env dotenv environment diff example secret 环境变量 示例',
  },
  {
    to: '/mock-data',
    icon: <Dices className="h-4 w-4 text-pink-500" />,
    labelKey: 'nav.mockData',
    keywords: 'mock faker fake data json 测试数据',
  },
  {
    to: '/sql-data',
    icon: <Database className="h-4 w-4 text-cyan-500" />,
    labelKey: 'nav.sqlData',
    keywords: 'sql insert create table mock seed 测试数据',
  },
  {
    to: '/csp',
    icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
    labelKey: 'nav.cspTool',
    keywords:
      'content security policy csp header 安全策略 violation report 违规报告',
  },
  {
    to: '/unix-permissions',
    icon: <Terminal className="h-4 w-4 text-slate-500" />,
    labelKey: 'nav.unixPermissions',
    keywords: 'unix linux chmod permissions rwx 755 setuid sticky 权限',
  },
  {
    to: '/seo-files',
    icon: <Globe className="h-4 w-4 text-green-500" />,
    labelKey: 'nav.seoFiles',
    keywords: 'seo robots.txt sitemap.xml crawler search engine 检查',
  },
  {
    to: '/git-tool',
    icon: <Code2 className="h-4 w-4 text-orange-500" />,
    labelKey: 'nav.gitTool',
    keywords:
      'glob pattern matching 匹配 gitignore conventional commit semver version git package.json dependencies dependency diff lockfile bun.lock pnpm-lock.yaml package-lock.json 锁文件 依赖 对比 editorconfig 匹配',
  },
  {
    to: '/bundle-inspector',
    icon: <Activity className="h-4 w-4 text-indigo-500" />,
    labelKey: 'nav.bundleInspector',
    keywords: 'bundle sourcemap size module build 体积 模块',
  },
];
const developerNavItems = [
  ...formatterNavItems,
  ...encodeNavItems,
  ...convertNavItems.filter((item) => item.to !== '/number-base'),
  ...networkNavItems,
  ...cryptoNavItems,
  ...developerToolNavItems,
];
const conversionNavItems = [
  ...convertNavItems.filter((item) => item.to === '/number-base'),
  ...textNavItems,
];
const videoNavItems: NavItem[] = [
  {
    to: '/audio-recorder',
    icon: <AudioLines className="h-4 w-4 text-emerald-500" />,
    labelKey: 'nav.audioRecorder',
    keywords: 'audio recorder microphone voice record 录音 麦克风',
  },
  {
    to: '/screen-recorder',
    icon: <Video className="h-4 w-4 text-red-500" />,
    labelKey: 'nav.screenRecorder',
    keywords: 'screen recorder capture video recording 录屏',
  },
  {
    to: '/video-editor',
    icon: <Video className="h-4 w-4 text-orange-500" />,
    labelKey: 'nav.videoEditor',
    keywords:
      '视频 合并 旋转 裁剪 静音 音轨 封面 媒体信息 编码 码率 帧率 metadata merge rotate',
  },
  {
    to: '/streaming-manifest',
    icon: <ListOrdered className="h-4 w-4 text-orange-500" />,
    labelKey: 'nav.streamingManifest',
    keywords: 'HLS DASH m3u8 MPD 流媒体 清单 播放列表 manifest',
  },
  {
    to: '/video-animation',
    icon: <Images className="h-4 w-4 text-lime-500" />,
    labelKey: 'nav.videoAnimation',
    keywords: '视频 gif webp 动图 animation',
  },
  {
    to: '/audio-editor',
    icon: <AudioLines className="h-4 w-4 text-violet-500" />,
    labelKey: 'nav.audioEditor',
    keywords: '音频 裁剪 合并 波形 audio trim merge waveform',
  },
  {
    to: '/subtitle-editor',
    icon: <Captions className="h-4 w-4 text-sky-500" />,
    labelKey: 'nav.subtitleEditor',
    keywords: '字幕 srt vtt 烧录 subtitle captions',
  },
];
const lifeNavItems: NavItem[] = [
  ...PRACTICAL_TOOLS.map(({ id, icon: Icon, color }) => ({
    to: `/${id}` as const,
    icon: <Icon className={`h-4 w-4 ${color}`} />,
    labelKey: `studio20.tools.${id}.title`,
    keywords: id.replaceAll('-', ' '),
  })),
  {
    to: '/math',
    icon: <Calculator className="h-4 w-4 text-blue-500" />,
    labelKey: 'mathTools.title',
    keywords:
      '数学 分数 百分比 公因数 公倍数 质数 科学计数 舍入 幂 开方 对数 方程 矩阵 统计 排列 组合 概率 分布 置信区间 样本 三角形 数列 math fraction percentage gcd lcm prime scientific rounding power root logarithm quadratic linear matrix statistics permutation combination probability binomial z-score confidence sample triangle sequence',
  },
  {
    to: '/screenshot-annotator',
    icon: <PencilRuler className="h-4 w-4 text-blue-500" />,
    labelKey: 'screenshotAnnotator.title',
    keywords: '截图 标注 箭头 遮挡 screenshot annotate',
  },
  {
    to: '/photo-frame',
    icon: <Frame className="h-4 w-4 text-amber-500" />,
    labelKey: 'photoFrame.title',
    keywords: '照片 边框 摄影 水印 EXIF photo frame',
  },
  {
    to: '/label-maker',
    icon: <Tags className="h-4 w-4 text-emerald-500" />,
    labelKey: 'labelMaker.title',
    keywords: '标签 姓名贴 席卡 打印 label nametag',
  },
  {
    to: '/resume-builder',
    icon: <ContactRound className="h-4 w-4 text-indigo-500" />,
    labelKey: 'resumeBuilder.title',
    keywords: '简历 履历 求职 PDF resume cv',
  },
  {
    to: '/seating-chart',
    icon: <Armchair className="h-4 w-4 text-teal-500" />,
    labelKey: 'seatingChart.title',
    keywords: '座位 教室 排座 过道 seating chart',
  },
  {
    to: '/math-worksheet',
    icon: <Calculator className="h-4 w-4 text-orange-500" />,
    labelKey: 'mathWorksheet.title',
    keywords: '口算 数学 练习 出题 竖式 math worksheet',
  },
  {
    to: '/pinyin-annotator',
    icon: <Languages className="h-4 w-4 text-sky-500" />,
    labelKey: 'pinyinAnnotator.title',
    keywords: '拼音 注音 多音字 中文 pinyin',
  },
  {
    to: '/kinship',
    icon: <UsersRound className="h-4 w-4 text-rose-500" />,
    labelKey: 'kinship.title',
    keywords: '亲戚 称谓 关系 辈分 kinship family',
  },
  {
    to: '/shift-calendar',
    icon: <CalendarDays className="h-4 w-4 text-violet-500" />,
    labelKey: 'shiftCalendar.title',
    keywords: '倒班 排班 工时 班表 shift calendar',
  },
  {
    to: '/bead-pattern',
    icon: <Grid2X2 className="h-4 w-4 text-fuchsia-500" />,
    labelKey: 'beadPattern.title',
    keywords: '拼豆 十字绣 图纸 材料 beads cross stitch',
  },
  {
    to: '/flashcards',
    icon: <BookOpenCheck className="h-4 w-4 text-cyan-500" />,
    labelKey: 'flashcards.title',
    keywords: '闪卡 单词 复习 填空 flashcards recall',
  },
  {
    to: '/packing-list',
    icon: <Backpack className="h-4 w-4 text-lime-500" />,
    labelKey: 'packingList.title',
    keywords: '行李 旅行 出差 露营 重量 packing luggage',
  },
  {
    to: '/subscription-tracker',
    icon: <CreditCard className="h-4 w-4 text-purple-500" />,
    labelKey: 'subscriptionTracker.title',
    keywords: '订阅 会员 续费 费用 subscription renewal',
  },
  {
    to: '/home-inventory',
    icon: <PackageOpen className="h-4 w-4 text-green-500" />,
    labelKey: 'homeInventory.title',
    keywords: '库存 临期 到期 补货 收纳 pantry inventory',
  },
  {
    to: '/tuner',
    icon: <Music2 className="h-4 w-4 text-yellow-500" />,
    labelKey: 'tuner.title',
    keywords: '调音 音高 音分 吉他 tuner pitch',
  },
  {
    to: '/tournament-bracket',
    icon: <Trophy className="h-4 w-4 text-red-500" />,
    labelKey: 'tournamentBracket.title',
    keywords: '比赛 淘汰赛 循环赛 对阵 赛程 tournament bracket',
  },
  {
    to: '/decision-matrix',
    icon: <Scale className="h-4 w-4 text-slate-500" />,
    labelKey: 'decisionMatrix.title',
    keywords: '决策 比较 加权 评分 decision matrix',
  },
  {
    to: '/cut-planner',
    icon: <Scissors className="h-4 w-4 text-pink-500" />,
    labelKey: 'cutPlanner.title',
    keywords: '裁切 板材 布料 排版 利用率 cut planner',
  },
  {
    to: '/room-planner',
    icon: <Sofa className="h-4 w-4 text-stone-500" />,
    labelKey: 'roomPlanner.title',
    keywords: '房间 家具 摆放 布局 尺寸 room planner',
  },
  {
    to: '/knitting-counter',
    icon: <Tally5 className="h-4 w-4 text-zinc-500" />,
    labelKey: 'knittingCounter.title',
    keywords: '编织 针数 行数 花样 计数 knitting crochet',
  },
  {
    to: '/typing-practice',
    icon: <Keyboard className="h-4 w-4 text-blue-500" />,
    labelKey: 'typingPractice.title',
    keywords: '打字 练习 测速 中文 英文 typing practice wpm',
  },
  {
    to: '/printable-paper',
    icon: <Printer className="h-4 w-4 text-amber-500" />,
    labelKey: 'printablePaper.title',
    keywords: '打印 方格 点阵 田字格 字帖 康奈尔 paper handwriting',
  },
  {
    to: '/unit-price',
    icon: <Tag className="h-4 w-4 text-emerald-500" />,
    labelKey: 'unitPrice.title',
    keywords: '购物 单价 优惠 比价 买赠 price shopping discount',
  },
  {
    to: '/metronome',
    icon: <AudioLines className="h-4 w-4 text-violet-500" />,
    labelKey: 'metronome.title',
    keywords: '节拍器 音乐 节奏 拍号 BPM metronome tap tempo',
  },
  {
    to: '/ebook-reader',
    icon: <FileText className="h-4 w-4 text-indigo-500" />,
    labelKey: 'ebookReader.title',
    keywords: '阅读器 电子书 EPUB TXT 书签 ebook reader',
  },
  {
    to: '/rmb-uppercase',
    icon: <Wallet className="h-4 w-4 text-red-500" />,
    labelKey: 'nav.rmbUppercase',
    keywords: '人民币 大写 金额 rmb uppercase chinese money',
  },
  {
    to: '/finance-calculator',
    icon: <Landmark className="h-4 w-4 text-green-500" />,
    labelKey: 'nav.financeCalculator',
    keywords:
      '复利 定投 储蓄 提前还贷 通胀 理财 iban bank card luhn finance compound investment 银行卡',
  },
  {
    to: '/home-energy',
    icon: <Activity className="h-4 w-4 text-yellow-500" />,
    labelKey: 'nav.homeEnergy',
    keywords: '家庭 用电 电器 电费 功率 energy electricity appliance',
  },
  {
    to: '/geometry-calculator',
    icon: <Ruler className="h-4 w-4 text-indigo-500" />,
    labelKey: 'nav.geometryCalculator',
    keywords: '几何 面积 体积 坡度 角度 材料 geometry area volume slope',
  },
  {
    to: '/date-calculator',
    icon: <CalendarClock className="h-4 w-4 text-blue-500" />,
    labelKey: 'nav.dateCalculator',
    keywords: '日期 年龄 间隔 倒计时 工作日 date age countdown workday',
  },
  {
    to: '/salary-tax',
    icon: <Landmark className="h-4 w-4 text-amber-500" />,
    labelKey: 'nav.salaryTax',
    keywords: '个税 工资 到手 salary tax income',
  },
  {
    to: '/travel-cost',
    icon: <MapPin className="h-4 w-4 text-emerald-500" />,
    labelKey: 'nav.travelCost',
    keywords: '油耗 电费 旅行 成本 fuel electric travel cost',
  },
  {
    to: '/pace-calculator',
    icon: <Activity className="h-4 w-4 text-orange-500" />,
    labelKey: 'nav.paceCalculator',
    keywords: '跑步 配速 时间 距离 pace running',
  },
  {
    to: '/recipe-scale',
    icon: <ListOrdered className="h-4 w-4 text-rose-500" />,
    labelKey: 'nav.recipeScale',
    keywords: '食谱 比例 份数 recipe servings scale',
  },
  {
    to: '/size-converter',
    icon: <Ruler className="h-4 w-4 text-violet-500" />,
    labelKey: 'nav.sizeConverter',
    keywords: '衣服 鞋码 尺码 size shoe clothing',
  },
  {
    to: '/ics-generator',
    icon: <FileText className="h-4 w-4 text-indigo-500" />,
    labelKey: 'nav.icsGenerator',
    keywords:
      'ics rrule calendar event inspect validate recurrence exdate timezone dst 日历 事件 检查 重复 时区 夏令时',
  },
  {
    to: '/random-picker',
    icon: <Dices className="h-4 w-4 text-pink-500" />,
    labelKey: 'nav.randomPicker',
    keywords: '随机 分组 抽签 转盘 random group draw wheel',
  },
  {
    to: '/bill-split',
    icon: <ArrowLeftRight className="h-4 w-4 text-teal-500" />,
    labelKey: 'nav.billSplit',
    keywords: 'aa 分账 小费 bill split tip',
  },
  {
    to: '/home-budget',
    icon: <House className="h-4 w-4 text-lime-500" />,
    labelKey: 'nav.homeBudget',
    keywords: '房屋 面积 公摊 装修 预算 home area renovation budget',
  },
  {
    to: '/world-clock',
    icon: <Clock className="h-4 w-4 text-sky-500" />,
    labelKey: 'nav.worldClock',
    keywords: '世界时间 时区 城市 utc time timezone world clock',
  },
  {
    to: '/gushi-namer',
    icon: <Flower2 className="h-4 w-4 text-rose-500" />,
    labelKey: 'nav.gushiNamer',
    keywords: '古诗 取名 姓名 诗经 楚辞 唐诗 宋词 name poetry',
  },
  {
    to: '/social-insurance',
    icon: <Landmark className="h-4 w-4 text-violet-500" />,
    labelKey: 'nav.socialInsurance',
    keywords: '五险一金 社保 公积金 工资 social insurance housing fund',
  },
  {
    to: '/mortgage',
    icon: <House className="h-4 w-4 text-blue-500" />,
    labelKey: 'nav.mortgage',
    keywords: '房贷 贷款 等额本息 等额本金 mortgage loan',
  },
  {
    to: '/bmi',
    icon: <Activity className="h-4 w-4 text-emerald-500" />,
    labelKey: 'nav.bmi',
    keywords: 'bmi 体重 身高 健康 body mass index',
  },
  {
    to: '/temperature',
    icon: <Thermometer className="h-4 w-4 text-orange-500" />,
    labelKey: 'nav.temperature',
    keywords: '温度 摄氏 华氏 开尔文 celsius fahrenheit kelvin',
  },
  {
    to: '/screen-test',
    icon: <MonitorSmartphone className="h-4 w-4 text-cyan-500" />,
    labelKey: 'screenTest.title',
    keywords: '屏幕 坏点 漏光 灰阶 渐变 screen monitor dead pixel display',
  },
  {
    to: '/gamepad-test',
    icon: <Gamepad2 className="h-4 w-4 text-purple-500" />,
    labelKey: 'gamepad.title',
    keywords:
      '手柄 游戏 摇杆 漂移 按键 xbox playstation nintendo gamepad controller drift',
  },
  {
    to: '/teleprompter',
    icon: <ScrollText className="h-4 w-4 text-rose-500" />,
    labelKey: 'teleprompter.title',
    keywords: '提词器 演讲 口播 镜像 teleprompter script speech',
  },
  {
    to: '/poster-print',
    icon: <Printer className="h-4 w-4 text-orange-500" />,
    labelKey: 'posterPrint.title',
    keywords: '海报 大图 分页 打印 A4 poster print tile paper',
  },
  {
    to: '/ambient-sound',
    icon: <Wind className="h-4 w-4 text-sky-500" />,
    labelKey: 'ambientSound.title',
    keywords: '白噪音 环境音 雨声 风声 咖啡馆 专注 ambient noise rain cafe',
  },
  {
    to: '/focus-timer',
    icon: <Timer className="h-4 w-4 text-red-500" />,
    labelKey: 'focusTimer.title',
    keywords: '番茄钟 计时器 倒计时 秒表 专注 做饭 timer stopwatch pomodoro',
  },
  {
    to: '/screen-ruler',
    icon: <Ruler className="h-4 w-4 text-lime-500" />,
    labelKey: 'screenRuler.title',
    keywords: '直尺 校准 厘米 英寸 ruler calibration inches cm',
  },
  {
    to: '/device-check',
    icon: <Headphones className="h-4 w-4 text-pink-500" />,
    labelKey: 'deviceCheck.title',
    keywords:
      '开会 摄像头 麦克风 耳机 左右声道 试音 camera microphone audio meeting headphones',
  },
  {
    to: '/keyboard-mouse-test',
    icon: <Keyboard className="h-4 w-4 text-slate-500" />,
    labelKey: 'nav.inputTester',
    keywords:
      '键盘 鼠标 灵敏 按键 检测 测试 keyboard mouse sensitivity input tester',
  },
  {
    to: '/unit-converter',
    icon: <Ruler className="h-4 w-4 text-teal-500" />,
    labelKey: 'nav.unitConverter',
    keywords: '单位 转换 长度 面积 重量 容量 速度 数据 unit converter',
  },
  {
    to: '/archive',
    icon: <FileArchive className="h-4 w-4 text-amber-500" />,
    labelKey: 'nav.archive',
    keywords: '压缩 解压 zip gzip deflate 7z archive',
  },
];

const ALL_CATEGORIES: CategoryDef[] = [
  {
    labelKey: 'shell.developerTools',
    icon: <Code2 className="w-4 h-4" />,
    items: developerNavItems,
  },
  {
    labelKey: 'shell.textAndConversion',
    icon: <ArrowLeftRight className="w-4 h-4" />,
    items: conversionNavItems,
  },
  {
    labelKey: 'shell.designTools',
    icon: <Palette className="w-4 h-4" />,
    items: designNavItems,
  },
  {
    labelKey: 'shell.imageTools',
    icon: <ImageIcon className="w-4 h-4" />,
    items: imageNavItems,
  },
  {
    labelKey: 'shell.videoTools',
    icon: <Video className="w-4 h-4" />,
    items: videoNavItems,
  },
  {
    labelKey: 'shell.lifeTools',
    icon: <Flower2 className="w-4 h-4" />,
    items: lifeNavItems,
  },
];

function ToolSearch() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const tools = React.useMemo(
    () =>
      ALL_CATEGORIES.flatMap((category) =>
        category.items.map((item) => ({
          ...item,
          category: t(category.labelKey),
          label: t(item.labelKey),
        })),
      ),
    [i18n.resolvedLanguage, t],
  );
  const fuse = React.useMemo(
    () =>
      new Fuse(tools, {
        ignoreLocation: true,
        keys: [
          { name: 'label', weight: 3 },
          { name: 'category', weight: 1 },
          { name: 'keywords', weight: 2 },
          { name: 'to', weight: 1 },
        ],
        threshold: 0.35,
      }),
    [tools],
  );
  const results = query.trim()
    ? fuse.search(query.trim(), { limit: 8 }).map((result) => result.item)
    : [];

  return (
    <div
      className="relative min-w-0 flex-1 max-w-2xl"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.placeholder')}
        aria-expanded={open && Boolean(query.trim())}
        aria-controls="tool-search-results"
        className="h-10 rounded-xl pl-9 text-sm bg-muted/25 shadow-none"
      />
      {open && query.trim() && (
        <div
          id="tool-search-results"
          className="absolute inset-x-0 top-full z-50 mt-2 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length ? (
            results.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                }}
                className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="text-xs text-muted-foreground">
                  {item.category}
                </span>
              </Link>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {t('search.noResults')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
    ...videoNavItems,
    ...lifeNavItems,
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
            <span>Breeze Tools</span>
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
        <div className="border-t p-3">
          <Link
            to="/settings"
            onClick={close}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            {t('shell.settings')}
          </Link>
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

const SIDEBAR_ITEMS = [
  { category: 'all', labelKey: 'shell.allTools', icon: Layers },
  { category: 'developer', labelKey: 'shell.developerTools', icon: Code2 },
  {
    category: 'conversion',
    labelKey: 'shell.textAndConversion',
    icon: ArrowLeftRight,
  },
  { category: 'design', labelKey: 'shell.designTools', icon: Palette },
  { category: 'image', labelKey: 'shell.imageTools', icon: ImageIcon },
  { category: 'video', labelKey: 'shell.videoTools', icon: Video },
  { category: 'life', labelKey: 'shell.lifeTools', icon: Flower2 },
] as const;

function DesktopSidebar() {
  const { t } = useTranslation();
  const location = useRouterState({
    select: (state) => ({
      category: (state.location.search as Record<string, unknown>).category,
      pathname: state.location.pathname,
    }),
  });
  const navClass = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/35 dark:text-blue-400' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`;
  const isHome = location.pathname === '/' && location.category == null;
  const activeCategory = location.category;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r bg-background lg:flex">
      <Link to="/" className="flex h-[68px] items-center gap-3 border-b px-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/25">
          <Code2 className="h-5 w-5" />
        </span>
        <span className="text-xl font-bold tracking-tight">Breeze Tools</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
        <Link to="/" search={{}} className={navClass(isHome)}>
          <Home className="h-5 w-5" />
          {t('shell.home')}
        </Link>
        {SIDEBAR_ITEMS.map(({ category, labelKey, icon: Icon }) => (
          <Link
            key={category}
            to="/"
            search={{ category }}
            className={navClass(
              location.pathname === '/' && activeCategory === category,
            )}
          >
            <Icon className="h-5 w-5" />
            {t(labelKey)}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t px-4 py-5">
        <Link
          to="/"
          search={{ category: 'favorites' }}
          className={navClass(
            location.pathname === '/' && location.category === 'favorites',
          )}
        >
          <Heart className="h-5 w-5" />
          {t('shell.favorites')}
        </Link>
        <Link
          to="/settings"
          className={navClass(
            location.pathname === '/settings' ||
              location.pathname === '/settings-preferences' ||
              location.pathname === '/settings-data',
          )}
        >
          <Settings className="h-5 w-5" />
          {t('shell.settings')}
        </Link>
      </div>
    </aside>
  );
}

// ─── 根文档 ────────────────────────────────────────────────

function AuthNav() {
  const { t } = useTranslation();
  const session = useAuthSession();
  const logoutMutation = useOptionalAuthMutation<void, void>({
    operation: () => ({
      local: async () => undefined,
      remote: async () => {
        const response = await api.auth.logout.$post();
        assertSessionActive(response);
        if (!response.ok) throw new Error('logout failed');
      },
    }),
    onReportError: () => toast.error(t('auth.logoutError')),
  });

  if (session.status === 'loading') {
    return <div className="w-8 h-8" aria-hidden="true" />;
  }

  if (session.status === 'guest') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon-sm" variant="ghost">
            <Link to="/login" aria-label={t('auth.navLogin')}>
              <LogIn />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {t('auth.navLogin')}
        </TooltipContent>
      </Tooltip>
    );
  }

  const user = session.user;

  const logout = async () => {
    const result = await logoutMutation.execute(undefined);
    if (result) {
      setAuthGuest();
      resetFavorites();
    }
  };

  return (
    <HoverCard openDelay={200} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={t('auth.accountDetails')}
          className="rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <CircleUserRound className="w-8 h-8 text-muted-foreground" />
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="space-y-3">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <CircleUserRound className="w-10 h-10 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {t('auth.userId')}: {user.id}
            </p>
          </div>
        </div>
        <Button
          asChild
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
        >
          <Link to="/settings">
            <Settings />
            {t('settingsPage.title')}
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          disabled={logoutMutation.isPending}
          onClick={logout}
        >
          <LogOut />
          {t('auth.logout')}
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
}

function RootDocument() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}

function RootContent() {
  const { t } = useTranslation();
  const shell = useRouterState({
    select: (state) => getToolShell(state.location.pathname),
  });
  const immersive = shell === 'immersive';

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <TooltipProvider>
          {immersive ? (
            <main className="min-h-screen bg-zinc-950 text-zinc-100">
              <Outlet />
            </main>
          ) : (
            <div className="min-h-screen bg-background text-foreground">
              <DesktopSidebar />
              <header className="fixed left-0 right-0 top-0 z-50 h-[68px] border-b bg-background/90 backdrop-blur-xl lg:left-64">
                <nav className="flex h-full items-center gap-2 px-4 sm:gap-4 lg:px-8">
                  <div className="shrink-0 lg:hidden">
                    <MobileNav />
                  </div>
                  <Link
                    to="/"
                    className="flex shrink-0 items-center gap-2 font-bold lg:hidden"
                  >
                    <Code2 className="h-5 w-5 text-blue-600" />
                    <span className="hidden sm:inline">Breeze Tools</span>
                  </Link>
                  <ToolSearch />
                  <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to="/"
                          search={{ category: 'favorites' }}
                          aria-label={t('shell.favorites')}
                          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
                        >
                          <Star className="h-4 w-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6}>
                        {t('shell.favorites')}
                      </TooltipContent>
                    </Tooltip>
                    <ThemeToggle />
                    <LangSwitcher />
                    <AuthNav />
                  </div>
                </nav>
              </header>
              <main className="min-h-screen pt-[68px] lg:pl-64">
                <Outlet />
              </main>
            </div>
          )}
        </TooltipProvider>
        {!immersive && (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              { name: 'Router', render: <TanStackRouterDevtoolsPanel /> },
            ]}
          />
        )}
        {!immersive && <Toaster />}
      </div>
    </QueryClientProvider>
  );
}
