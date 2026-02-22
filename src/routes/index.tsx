import { useFavorites } from '@/hooks/useFavorites';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, createFileRoute } from '@tanstack/react-router';
import {
  AlignLeft,
  ArrowLeftRight,
  Binary,
  Braces,
  CaseSensitive,
  Clock,
  Contrast,
  Cookie,
  Database,
  Dices,
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
  MonitorSmartphone,
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
  Table,
  Tag,
} from 'lucide-react';
import React from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';

export const Route = createFileRoute('/')({ component: HomePage });

const formatterTools = [
  {
    to: '/json' as const,
    icon: <Braces className="w-8 h-8 text-amber-500" />,
    titleKey: 'home.tools.json.title',
    descKey: 'home.tools.json.desc',
    tagKeys: [
      'home.tools.json.tagFormat',
      'home.tools.json.tagMinify',
      'home.tools.json.tagValidate',
    ],
    gradient: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    to: '/html' as const,
    icon: <FileCode className="w-8 h-8 text-blue-500" />,
    titleKey: 'home.tools.html.title',
    descKey: 'home.tools.html.desc',
    tagKeys: ['home.tools.html.tagFormat', 'home.tools.html.tagMinify'],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/css' as const,
    icon: <Paintbrush className="w-8 h-8 text-violet-500" />,
    titleKey: 'home.tools.css.title',
    descKey: 'home.tools.css.desc',
    tagKeys: [
      'home.tools.css.tagFormat',
      'home.tools.css.tagMinify',
      'home.tools.css.tagScss',
    ],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/js' as const,
    icon: <FileCode2 className="w-8 h-8 text-yellow-500" />,
    titleKey: 'home.tools.js.title',
    descKey: 'home.tools.js.desc',
    tagKeys: [
      'home.tools.js.tagFormat',
      'home.tools.js.tagMinify',
      'home.tools.js.tagObfuscate',
    ],
    gradient: 'hover:bg-yellow-50 dark:hover:bg-yellow-950/20',
    border: 'hover:border-yellow-300 dark:hover:border-yellow-700',
  },
  {
    to: '/xml' as const,
    icon: <Tag className="w-8 h-8 text-orange-500" />,
    titleKey: 'home.tools.xml.title',
    descKey: 'home.tools.xml.desc',
    tagKeys: [
      'home.tools.xml.tagFormat',
      'home.tools.xml.tagValidate',
      'home.tools.xml.tagMinify',
    ],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/markdown' as const,
    icon: <FileText className="w-8 h-8 text-teal-500" />,
    titleKey: 'home.tools.markdown.title',
    descKey: 'home.tools.markdown.desc',
    tagKeys: [
      'home.tools.markdown.tagBeautify',
      'home.tools.markdown.tagPreview',
    ],
    gradient: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',
    border: 'hover:border-teal-300 dark:hover:border-teal-700',
  },
  {
    to: '/sql' as const,
    icon: <Database className="w-8 h-8 text-cyan-500" />,
    titleKey: 'home.tools.sql.title',
    descKey: 'home.tools.sql.desc',
    tagKeys: ['home.tools.sql.tagFormat', 'home.tools.sql.tagMinify'],
    gradient: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    to: '/yaml' as const,
    icon: <FileStack className="w-8 h-8 text-green-500" />,
    titleKey: 'home.tools.yaml.title',
    descKey: 'home.tools.yaml.desc',
    tagKeys: [
      'home.tools.yaml.tagFormat',
      'home.tools.yaml.tagValidate',
      'home.tools.yaml.tagToJson',
    ],
    gradient: 'hover:bg-green-50 dark:hover:bg-green-950/20',
    border: 'hover:border-green-300 dark:hover:border-green-700',
  },
];

const encodeTools = [
  {
    to: '/base64' as const,
    icon: <Binary className="w-8 h-8 text-rose-500" />,
    titleKey: 'home.tools.base64.title',
    descKey: 'home.tools.base64.desc',
    tagKeys: ['home.tools.base64.tagEncode', 'home.tools.base64.tagDecode'],
    gradient: 'hover:bg-rose-50 dark:hover:bg-rose-950/20',
    border: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    to: '/url-encode' as const,
    icon: <LinkIcon className="w-8 h-8 text-sky-500" />,
    titleKey: 'home.tools.urlEncode.title',
    descKey: 'home.tools.urlEncode.desc',
    tagKeys: [
      'home.tools.urlEncode.tagEncode',
      'home.tools.urlEncode.tagDecode',
      'home.tools.urlEncode.tagParse',
    ],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
  {
    to: '/unicode' as const,
    icon: <Globe className="w-8 h-8 text-indigo-500" />,
    titleKey: 'home.tools.unicode.title',
    descKey: 'home.tools.unicode.desc',
    tagKeys: [
      'home.tools.unicode.tagEscape',
      'home.tools.unicode.tagUtf8',
      'home.tools.unicode.tagCodepoints',
    ],
    gradient: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
    border: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
  {
    to: '/regex' as const,
    icon: <RegexIcon className="w-8 h-8 text-fuchsia-500" />,
    titleKey: 'home.tools.regex.title',
    descKey: 'home.tools.regex.desc',
    tagKeys: [
      'home.tools.regex.tagTest',
      'home.tools.regex.tagHighlight',
      'home.tools.regex.tagLibrary',
    ],
    gradient: 'hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20',
    border: 'hover:border-fuchsia-300 dark:hover:border-fuchsia-700',
  },
];

const cryptoTools = [
  {
    to: '/hash' as const,
    icon: <Hash className="w-8 h-8 text-emerald-500" />,
    titleKey: 'home.tools.hash.title',
    descKey: 'home.tools.hash.desc',
    tagKeys: [
      'home.tools.hash.tagMd5',
      'home.tools.hash.tagSha256',
      'home.tools.hash.tagSha512',
    ],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/cipher' as const,
    icon: <Lock className="w-8 h-8 text-red-500" />,
    titleKey: 'home.tools.cipher.title',
    descKey: 'home.tools.cipher.desc',
    tagKeys: [
      'home.tools.cipher.tagAES',
      'home.tools.cipher.tagDES',
      'home.tools.cipher.tagModes',
    ],
    gradient: 'hover:bg-red-50 dark:hover:bg-red-950/20',
    border: 'hover:border-red-300 dark:hover:border-red-700',
  },
  {
    to: '/hmac' as const,
    icon: <KeyRound className="w-8 h-8 text-orange-500" />,
    titleKey: 'home.tools.hmac.title',
    descKey: 'home.tools.hmac.desc',
    tagKeys: ['home.tools.hmac.tagSign', 'home.tools.hmac.tagVerify'],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/jwt' as const,
    icon: <Fingerprint className="w-8 h-8 text-purple-500" />,
    titleKey: 'home.tools.jwt.title',
    descKey: 'home.tools.jwt.desc',
    tagKeys: ['home.tools.jwt.tagDecode', 'home.tools.jwt.tagExpiry'],
    gradient: 'hover:bg-purple-50 dark:hover:bg-purple-950/20',
    border: 'hover:border-purple-300 dark:hover:border-purple-700',
  },
  {
    to: '/uuid' as const,
    icon: <Dices className="w-8 h-8 text-pink-500" />,
    titleKey: 'home.tools.uuid.title',
    descKey: 'home.tools.uuid.desc',
    tagKeys: ['home.tools.uuid.tagV4', 'home.tools.uuid.tagBatch'],
    gradient: 'hover:bg-pink-50 dark:hover:bg-pink-950/20',
    border: 'hover:border-pink-300 dark:hover:border-pink-700',
  },
  {
    to: '/rot13' as const,
    icon: <RotateCw className="w-8 h-8 text-lime-500" />,
    titleKey: 'home.tools.rot13.title',
    descKey: 'home.tools.rot13.desc',
    tagKeys: ['home.tools.rot13.tagRot13', 'home.tools.rot13.tagEntity'],
    gradient: 'hover:bg-lime-50 dark:hover:bg-lime-950/20',
    border: 'hover:border-lime-300 dark:hover:border-lime-700',
  },
];

const networkTools = [
  {
    to: '/http-request' as const,
    icon: <Send className="w-8 h-8 text-blue-500" />,
    titleKey: 'home.tools.httpRequest.title',
    descKey: 'home.tools.httpRequest.desc',
    tagKeys: [
      'home.tools.httpRequest.tagHeaders',
      'home.tools.httpRequest.tagBody',
      'home.tools.httpRequest.tagParams',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/cors' as const,
    icon: <ShieldAlert className="w-8 h-8 text-orange-500" />,
    titleKey: 'home.tools.cors.title',
    descKey: 'home.tools.cors.desc',
    tagKeys: ['home.tools.cors.tagPreflight', 'home.tools.cors.tagHeaders'],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/cookie' as const,
    icon: <Cookie className="w-8 h-8 text-amber-500" />,
    titleKey: 'home.tools.cookie.title',
    descKey: 'home.tools.cookie.desc',
    tagKeys: ['home.tools.cookie.tagInspect', 'home.tools.cookie.tagParse'],
    gradient: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    to: '/ip-lookup' as const,
    icon: <MapPin className="w-8 h-8 text-red-500" />,
    titleKey: 'home.tools.ipLookup.title',
    descKey: 'home.tools.ipLookup.desc',
    tagKeys: ['home.tools.ipLookup.tagGeo', 'home.tools.ipLookup.tagExtract'],
    gradient: 'hover:bg-red-50 dark:hover:bg-red-950/20',
    border: 'hover:border-red-300 dark:hover:border-red-700',
  },
  {
    to: '/http-status' as const,
    icon: <ListOrdered className="w-8 h-8 text-teal-500" />,
    titleKey: 'home.tools.httpStatus.title',
    descKey: 'home.tools.httpStatus.desc',
    tagKeys: [
      'home.tools.httpStatus.tagReference',
      'home.tools.httpStatus.tagSearch',
    ],
    gradient: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',
    border: 'hover:border-teal-300 dark:hover:border-teal-700',
  },
  {
    to: '/user-agent' as const,
    icon: <MonitorSmartphone className="w-8 h-8 text-violet-500" />,
    titleKey: 'home.tools.userAgent.title',
    descKey: 'home.tools.userAgent.desc',
    tagKeys: ['home.tools.userAgent.tagBrowser', 'home.tools.userAgent.tagOS'],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
];

const convertTools = [
  {
    to: '/csv-convert' as const,
    icon: <Database className="w-8 h-8 text-cyan-600" />,
    titleKey: 'home.tools.csvConvert.title',
    descKey: 'home.tools.csvConvert.desc',
    tagKeys: [
      'home.tools.csvConvert.tagCsv',
      'home.tools.csvConvert.tagTsv',
      'home.tools.csvConvert.tagSql',
    ],
    gradient: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    to: '/xml-json' as const,
    icon: <ArrowLeftRight className="w-8 h-8 text-orange-600" />,
    titleKey: 'home.tools.xmlJson.title',
    descKey: 'home.tools.xmlJson.desc',
    tagKeys: ['home.tools.xmlJson.tagXml', 'home.tools.xmlJson.tagJson'],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/table-convert' as const,
    icon: <Table className="w-8 h-8 text-emerald-600" />,
    titleKey: 'home.tools.tableConvert.title',
    descKey: 'home.tools.tableConvert.desc',
    tagKeys: [
      'home.tools.tableConvert.tagHtml',
      'home.tools.tableConvert.tagCsv',
      'home.tools.tableConvert.tagJson',
    ],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/number-base' as const,
    icon: <Binary className="w-8 h-8 text-violet-600" />,
    titleKey: 'home.tools.numberBase.title',
    descKey: 'home.tools.numberBase.desc',
    tagKeys: [
      'home.tools.numberBase.tagBinary',
      'home.tools.numberBase.tagDecimal',
      'home.tools.numberBase.tagHex',
    ],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
];

const textTools = [
  {
    to: '/text' as const,
    icon: <CaseSensitive className="w-8 h-8 text-lime-600" />,
    titleKey: 'home.tools.text.title',
    descKey: 'home.tools.text.desc',
    tagKeys: [
      'home.tools.text.tagDedupe',
      'home.tools.text.tagSort',
      'home.tools.text.tagDiff',
    ],
    gradient: 'hover:bg-lime-50 dark:hover:bg-lime-950/20',
    border: 'hover:border-lime-300 dark:hover:border-lime-700',
  },
  {
    to: '/datetime' as const,
    icon: <Clock className="w-8 h-8 text-blue-500" />,
    titleKey: 'home.tools.datetime.title',
    descKey: 'home.tools.datetime.desc',
    tagKeys: [
      'home.tools.datetime.tagUnix',
      'home.tools.datetime.tagTimezone',
      'home.tools.datetime.tagDiff',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/password' as const,
    icon: <ShieldPlus className="w-8 h-8 text-emerald-600" />,
    titleKey: 'home.tools.password.title',
    descKey: 'home.tools.password.desc',
    tagKeys: [
      'home.tools.password.tagGenerate',
      'home.tools.password.tagStrength',
      'home.tools.password.tagBatch',
    ],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/qrcode' as const,
    icon: <QrCode className="w-8 h-8 text-blue-500" />,
    titleKey: 'home.tools.qrcode.title',
    descKey: 'home.tools.qrcode.desc',
    tagKeys: [
      'home.tools.qrcode.tagGenerate',
      'home.tools.qrcode.tagDecode',
      'home.tools.qrcode.tagCustom',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
];

const frontendTools = [
  {
    to: '/color-converter' as const,
    icon: <Palette className="w-8 h-8 text-pink-500" />,
    titleKey: 'home.tools.colorConverter.title',
    descKey: 'home.tools.colorConverter.desc',
    tagKeys: [
      'home.tools.colorConverter.tagHex',
      'home.tools.colorConverter.tagRgb',
      'home.tools.colorConverter.tagHsl',
    ],
    gradient: 'hover:bg-pink-50 dark:hover:bg-pink-950/20',
    border: 'hover:border-pink-300 dark:hover:border-pink-700',
  },
  {
    to: '/contrast' as const,
    icon: <Contrast className="w-8 h-8 text-blue-500" />,
    titleKey: 'home.tools.contrast.title',
    descKey: 'home.tools.contrast.desc',
    tagKeys: [
      'home.tools.contrast.tagAA',
      'home.tools.contrast.tagAAA',
      'home.tools.contrast.tagWCAG',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/css-layout' as const,
    icon: <Layers className="w-8 h-8 text-indigo-500" />,
    titleKey: 'home.tools.layout.title',
    descKey: 'home.tools.layout.desc',
    tagKeys: [
      'home.tools.layout.tagFlex',
      'home.tools.layout.tagGrid',
      'home.tools.layout.tagTemplates',
    ],
    gradient: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
    border: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
  {
    to: '/css-animation' as const,
    icon: <Sparkles className="w-8 h-8 text-violet-500" />,
    titleKey: 'home.tools.cssAnimation.title',
    descKey: 'home.tools.cssAnimation.desc',
    tagKeys: [
      'home.tools.cssAnimation.tagTransition',
      'home.tools.cssAnimation.tagAnimation',
      'home.tools.cssAnimation.tagKeyframes',
    ],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/image' as const,
    icon: <ImageIcon className="w-8 h-8 text-sky-500" />,
    titleKey: 'home.tools.imageTool.title',
    descKey: 'home.tools.imageTool.desc',
    tagKeys: [
      'home.tools.imageTool.tagConvert',
      'home.tools.imageTool.tagBase64',
      'home.tools.imageTool.tagRetina',
      'home.tools.imageTool.tagSkeleton',
    ],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
];

type ToolConfig = {
  to: string;
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  tagKeys: string[];
  gradient: string;
  border: string;
};

function ToolCard({
  tool,
  t,
  isFavorite,
  onToggleFavorite,
}: {
  tool: ToolConfig;
  t: (key: string) => string;
  isFavorite?: boolean;
  onToggleFavorite?: (path: string) => void;
}) {
  return (
    <div className="relative group">
      <Link to={tool.to}>
        <Card
          className={`h-full cursor-pointer transition-all duration-200 ${tool.gradient} ${tool.border}`}
        >
          <CardHeader>
            <div className="mb-2 transition-transform duration-200 group-hover:scale-110 w-fit">
              {tool.icon}
            </div>
            <CardTitle className="text-lg">{t(tool.titleKey)}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t(tool.descKey)}
            </CardDescription>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {tool.tagKeys.map((key) => (
                <Badge key={key} variant="secondary" className="text-xs">
                  {t(key)}
                </Badge>
              ))}
            </div>
          </CardHeader>
        </Card>
      </Link>
      {/* 收藏星标按钮：始终可见 */}
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(tool.to);
          }}
          className={`absolute top-2 right-2 p-1 rounded-md transition-all duration-150 z-10 cursor-pointer
            ${
              isFavorite
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-muted-foreground/40 hover:text-yellow-400'
            }
            hover:bg-background/80`}
          aria-label={isFavorite ? t('home.unfavorite') : t('home.favorite')}
        >
          <Star
            className="w-4 h-4"
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </button>
      )}
    </div>
  );
}

// ─── 可拖拽排序的收藏卡片包装 ──────────────────────────────────────────────

function SortableToolCard({
  tool,
  t,
  onToggleFavorite,
}: {
  tool: ToolConfig;
  t: (key: string) => string;
  onToggleFavorite: (path: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tool.to });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // 拖拽中提升层级，避免被相邻卡片遮挡
    zIndex: isDragging ? 10 : undefined,
  };

  // 记录本次 pointer 按下的起始坐标，用于判断是否发生了实际拖拽
  const pointerStart = React.useRef<{ x: number; y: number } | null>(null);
  // 是否超过 5px 移动阈值（与 dnd-kit PointerSensor 保持一致）
  const didDrag = React.useRef(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="h-full relative group cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        didDrag.current = false;
        pointerStart.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e);
      }}
      onPointerMove={(e) => {
        if (pointerStart.current) {
          const dx = e.clientX - pointerStart.current.x;
          const dy = e.clientY - pointerStart.current.y;
          if (Math.hypot(dx, dy) > 5) {
            didDrag.current = true;
          }
        }
      }}
    >
      {/* 卡片主体：点击跳转，拖拽时阻止跳转 */}
      <Link
        to={tool.to}
        className="block h-full"
        onClick={(e) => {
          if (didDrag.current) {
            e.preventDefault();
            didDrag.current = false;
          }
        }}
      >
        <Card
          className={`h-full transition-all duration-200 ${tool.gradient} ${tool.border}`}
        >
          <CardHeader>
            <div className="mb-2 transition-transform duration-200 group-hover:scale-110 w-fit">
              {tool.icon}
            </div>
            <CardTitle className="text-lg">{t(tool.titleKey)}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t(tool.descKey)}
            </CardDescription>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {tool.tagKeys.map((key) => (
                <Badge key={key} variant="secondary" className="text-xs">
                  {t(key)}
                </Badge>
              ))}
            </div>
          </CardHeader>
        </Card>
      </Link>
      {/* 星标取消收藏按钮 — 阻止触发拖拽的 pointer 事件 */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite(tool.to);
        }}
        className="absolute top-2 right-2 p-1 rounded-md transition-all duration-150 z-10 cursor-pointer text-yellow-400 hover:text-yellow-500 hover:bg-background/80"
        aria-label={t('home.unfavorite')}
      >
        <Star className="w-4 h-4" fill="currentColor" />
      </button>
    </div>
  );
}

// ─── 所有工具的扁平列表，用于在收藏区查找完整配置 ───────────────────────────
const ALL_TOOLS = [
  ...formatterTools,
  ...encodeTools,
  ...cryptoTools,
  ...networkTools,
  ...convertTools,
  ...textTools,
  ...frontendTools,
];

function HomePage() {
  const { t } = useTranslation();
  const { ready, favoritePaths, isFavorite, toggleFavorite, reorderFavorites } =
    useFavorites();

  // DB 首次查询未完成时，整个页面不渲染，避免收藏区抖动
  if (!ready) return null;

  return (
    <HomePageContent
      t={t}
      favoritePaths={favoritePaths}
      isFavorite={isFavorite}
      toggleFavorite={toggleFavorite}
      reorderFavorites={reorderFavorites}
    />
  );
}

function HomePageContent({
  t,
  favoritePaths,
  isFavorite,
  toggleFavorite,
  reorderFavorites,
}: {
  t: (key: string) => string;
  favoritePaths: string[];
  isFavorite: (path: string) => boolean;
  toggleFavorite: (path: string) => Promise<void>;
  reorderFavorites: (orderedPaths: string[]) => Promise<void>;
}) {
  // 本地乐观顺序：拖拽时立即更新，避免等 DB 回写再渲染产生闪动
  const [localOrder, setLocalOrder] = React.useState<string[]>(favoritePaths);
  // 当前正在拖拽的工具路径（用于 DragOverlay）
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // 当 DB 数据变化时，同步到本地顺序（拖拽过程中不覆盖）
  React.useEffect(() => {
    if (activeId === null) {
      setLocalOrder(favoritePaths);
    }
  }, [favoritePaths, activeId]);

  // 用本地顺序驱动渲染，避免 DB 写入延迟导致的闪动
  const displayOrder = localOrder;

  // 按 sortOrder 顺序查找对应工具配置
  const favoriteTools = displayOrder
    .map((path) => ALL_TOOLS.find((tool) => tool.to === path))
    .filter((tool): tool is (typeof ALL_TOOLS)[number] => tool !== undefined);

  // 当前拖拽卡片的配置（给 DragOverlay 用）
  const activeTool = activeId ? ALL_TOOLS.find((t) => t.to === activeId) : null;

  // dnd-kit sensor：需拖动至少 5px 才触发，避免与点击冲突
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localOrder.indexOf(active.id as string);
      const newIndex = localOrder.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(localOrder, oldIndex, newIndex);
        // flushSync：先同步把新顺序写入 DOM，再清除 activeId
        // 这样 DragOverlay 消失时，下方卡片已在正确位置，不会先闪回原位
        flushSync(() => setLocalOrder(newOrder));
        reorderFavorites(newOrder);
      }
    }

    setActiveId(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="mb-12 text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">{t('home.title')}</h1>
        <p className="text-muted-foreground text-lg">{t('home.subtitle')}</p>
        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span>{t('home.localProcess')}</span>
        </div>
      </div>

      <div className="space-y-10">
        {/* 我的收藏（有收藏时才显示；ready 守卫已在 HomePage 完成） */}
        {favoriteTools.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-yellow-400/10 text-yellow-500">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-none">
                  {t('home.groupFavorites')}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('home.favoritesSubtitle')}
                </p>
              </div>
              <div className="flex-1 h-px bg-border ml-2" />
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayOrder}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {favoriteTools.map((tool) => (
                    <SortableToolCard
                      key={tool.to}
                      tool={tool}
                      t={t}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </SortableContext>
              {/* DragOverlay：拖拽时渲染一张跟随鼠标的"幽灵卡片"，
                  尺寸由 dnd-kit 自动 match 原节点，无需手动设置 */}
              <DragOverlay>
                {activeTool ? (
                  <div className="shadow-2xl cursor-grabbing w-full h-full rounded-xl overflow-hidden bg-transparent">
                    <Card
                      className={`h-full transition-none ${activeTool.gradient} ${activeTool.border}`}
                    >
                      <CardHeader>
                        <div className="mb-2 w-fit">{activeTool.icon}</div>
                        <CardTitle className="text-lg">
                          {t(activeTool.titleKey)}
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {t(activeTool.descKey)}
                        </CardDescription>
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {activeTool.tagKeys.map((key) => (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="text-xs"
                            >
                              {t(key)}
                            </Badge>
                          ))}
                        </div>
                      </CardHeader>
                    </Card>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {/* 格式化工具 */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500">
              <AlignLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-none">
                {t('home.groupFormat')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                JSON · HTML · CSS · JS · XML · Markdown · SQL · YAML
              </p>
            </div>
            <div className="flex-1 h-px bg-border ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {formatterTools.map((tool) => (
              <ToolCard
                key={tool.to}
                tool={tool}
                t={t}
                isFavorite={isFavorite(tool.to)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>

        {/* 编码 / 转换 */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500">
              <Shuffle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-none">
                {t('home.groupEncode')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Base64 · URL Encode · Unicode
              </p>
            </div>
            <div className="flex-1 h-px bg-border ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {encodeTools.map((tool) => (
              <ToolCard
                key={tool.to}
                tool={tool}
                t={t}
                isFavorite={isFavorite(tool.to)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>

        {/* 加密 / 安全 */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-none">
                {t('home.groupCrypto')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t('home.cryptoSubtitle')}
              </p>
            </div>
            <div className="flex-1 h-px bg-border ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cryptoTools.map((tool) => (
              <ToolCard
                key={tool.to}
                tool={tool}
                t={t}
                isFavorite={isFavorite(tool.to)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>

        {/* 网络 / 请求 */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-none">
                {t('home.groupNetwork')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t('home.networkSubtitle')}
              </p>
            </div>
            <div className="flex-1 h-px bg-border ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {networkTools.map((tool) => (
              <ToolCard
                key={tool.to}
                tool={tool}
                t={t}
                isFavorite={isFavorite(tool.to)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>

        {/* 数据转换 / 互转 */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-none">
                {t('home.groupConvert')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t('home.convertSubtitle')}
              </p>
            </div>
            <div className="flex-1 h-px bg-border ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {convertTools.map((tool) => (
              <ToolCard
                key={tool.to}
                tool={tool}
                t={t}
                isFavorite={isFavorite(tool.to)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>

        {/* 其他 */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-500/10 text-slate-500">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-none">
                {t('home.groupOther')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t('home.otherSubtitle')}
              </p>
            </div>
            <div className="flex-1 h-px bg-border ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {textTools.map((tool) => (
              <ToolCard
                key={tool.to}
                tool={tool}
                t={t}
                isFavorite={isFavorite(tool.to)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>

        {/* 前端工具 */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-500/10 text-pink-500">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-none">
                {t('home.groupFrontend')}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t('home.frontendSubtitle')}
              </p>
            </div>
            <div className="flex-1 h-px bg-border ml-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {frontendTools.map((tool) => (
              <ToolCard
                key={tool.to}
                tool={tool}
                t={t}
                isFavorite={isFavorite(tool.to)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
