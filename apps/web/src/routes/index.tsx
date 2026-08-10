import { useFavorites } from '@/hooks/useFavorites';
import { detectToolSuggestions } from '@/lib/advanced-tools';
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
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
  Activity,
  AlignLeft,
  AudioLines,
  ArrowRight,
  ArrowLeftRight,
  Binary,
  Braces,
  CalendarClock,
  CaseSensitive,
  Captions,
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
  House,
  ImageIcon,
  Images,
  KeyRound,
  Landmark,
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
  Ratio,
  Regex as RegexIcon,
  RotateCw,
  Ruler,
  Scissors,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  Shuffle,
  Sparkles,
  SquareAsterisk,
  Star,
  Table,
  Tag,
  Terminal,
  Thermometer,
  Type,
  Upload,
  Video,
  Wallet,
  Wind,
} from 'lucide-react';
import React from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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
      'home.tools.json.tagSchema',
      'home.tools.json.tagPath',
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
    to: '/sql-playground' as const,
    icon: <Database className="w-8 h-8 text-emerald-500" />,
    titleKey: 'home.tools.sqlPlayground.title',
    descKey: 'home.tools.sqlPlayground.desc',
    tagKeys: [
      'home.tools.sqlPlayground.tagSqlite',
      'home.tools.sqlPlayground.tagWasm',
      'home.tools.sqlPlayground.tagOpfs',
    ],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
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

const developerExtraTools = [
  {
    to: '/trace-context' as const,
    icon: <Network className="h-8 w-8 text-sky-500" />,
    titleKey: 'home.tools.traceContext.title',
    descKey: 'home.tools.traceContext.desc',
    tagKeys: [
      'home.tools.traceContext.tagTraceparent',
      'home.tools.traceContext.tagTracestate',
    ],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
  {
    to: '/pipeline' as const,
    icon: <Share2 className="h-8 w-8 text-violet-500" />,
    titleKey: 'home.tools.pipeline.title',
    descKey: 'home.tools.pipeline.desc',
    tagKeys: [
      'home.tools.pipeline.tagRecipe',
      'home.tools.pipeline.tagTransform',
    ],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/har-analyzer' as const,
    icon: <Activity className="h-8 w-8 text-cyan-500" />,
    titleKey: 'home.tools.harAnalyzer.title',
    descKey: 'home.tools.harAnalyzer.desc',
    tagKeys: [
      'home.tools.harAnalyzer.tagWaterfall',
      'home.tools.harAnalyzer.tagTiming',
    ],
    gradient: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    to: '/hex-inspector' as const,
    icon: <Binary className="h-8 w-8 text-lime-500" />,
    titleKey: 'home.tools.hexInspector.title',
    descKey: 'home.tools.hexInspector.desc',
    tagKeys: [
      'home.tools.hexInspector.tagHex',
      'home.tools.hexInspector.tagEndian',
    ],
    gradient: 'hover:bg-lime-50 dark:hover:bg-lime-950/20',
    border: 'hover:border-lime-300 dark:hover:border-lime-700',
  },
  {
    to: '/docker-compose' as const,
    icon: <Terminal className="h-8 w-8 text-blue-500" />,
    titleKey: 'home.tools.dockerCompose.title',
    descKey: 'home.tools.dockerCompose.desc',
    tagKeys: [
      'home.tools.dockerCompose.tagRun',
      'home.tools.dockerCompose.tagCompose',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/webauthn-debugger' as const,
    icon: <Fingerprint className="h-8 w-8 text-purple-500" />,
    titleKey: 'home.tools.webauthnDebugger.title',
    descKey: 'home.tools.webauthnDebugger.desc',
    tagKeys: [
      'home.tools.webauthnDebugger.tagPasskey',
      'home.tools.webauthnDebugger.tagCredential',
    ],
    gradient: 'hover:bg-purple-50 dark:hover:bg-purple-950/20',
    border: 'hover:border-purple-300 dark:hover:border-purple-700',
  },
  {
    to: '/email-headers' as const,
    icon: <FileText className="h-8 w-8 text-teal-500" />,
    titleKey: 'home.tools.emailHeaders.title',
    descKey: 'home.tools.emailHeaders.desc',
    tagKeys: [
      'home.tools.emailHeaders.tagReceived',
      'home.tools.emailHeaders.tagAuth',
    ],
    gradient: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',
    border: 'hover:border-teal-300 dark:hover:border-teal-700',
  },
  {
    to: '/openapi' as const,
    icon: <FileCode2 className="h-8 w-8 text-blue-500" />,
    titleKey: 'home.tools.openapi.title',
    descKey: 'home.tools.openapi.desc',
    tagKeys: [
      'home.tools.openapi.tagEndpoints',
      'home.tools.openapi.tagSchema',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/cron' as const,
    icon: <Clock className="h-8 w-8 text-violet-500" />,
    titleKey: 'home.tools.cron.title',
    descKey: 'home.tools.cron.desc',
    tagKeys: ['home.tools.cron.tagParse', 'home.tools.cron.tagPreview'],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/env' as const,
    icon: <FileText className="h-8 w-8 text-emerald-500" />,
    titleKey: 'home.tools.envTool.title',
    descKey: 'home.tools.envTool.desc',
    tagKeys: ['home.tools.envTool.tagSort', 'home.tools.envTool.tagDiff'],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/mock-data' as const,
    icon: <Dices className="h-8 w-8 text-pink-500" />,
    titleKey: 'home.tools.mockData.title',
    descKey: 'home.tools.mockData.desc',
    tagKeys: ['home.tools.mockData.tagFaker', 'home.tools.mockData.tagJson'],
    gradient: 'hover:bg-pink-50 dark:hover:bg-pink-950/20',
    border: 'hover:border-pink-300 dark:hover:border-pink-700',
  },
  {
    to: '/sql-data' as const,
    icon: <Database className="h-8 w-8 text-cyan-500" />,
    titleKey: 'home.tools.sqlData.title',
    descKey: 'home.tools.sqlData.desc',
    tagKeys: ['home.tools.sqlData.tagCreate', 'home.tools.sqlData.tagInsert'],
    gradient: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    to: '/csp' as const,
    icon: <ShieldAlert className="h-8 w-8 text-red-500" />,
    titleKey: 'home.tools.cspTool.title',
    descKey: 'home.tools.cspTool.desc',
    tagKeys: ['home.tools.cspTool.tagPolicy', 'home.tools.cspTool.tagHeader'],
    gradient: 'hover:bg-red-50 dark:hover:bg-red-950/20',
    border: 'hover:border-red-300 dark:hover:border-red-700',
  },
  {
    to: '/unix-permissions' as const,
    icon: <Terminal className="h-8 w-8 text-slate-500" />,
    titleKey: 'home.tools.unixPermissions.title',
    descKey: 'home.tools.unixPermissions.desc',
    tagKeys: [
      'home.tools.unixPermissions.tagOctal',
      'home.tools.unixPermissions.tagSpecial',
    ],
    gradient: 'hover:bg-slate-50 dark:hover:bg-slate-950/20',
    border: 'hover:border-slate-300 dark:hover:border-slate-700',
  },
  {
    to: '/seo-files' as const,
    icon: <Globe className="h-8 w-8 text-green-500" />,
    titleKey: 'home.tools.seoFiles.title',
    descKey: 'home.tools.seoFiles.desc',
    tagKeys: [
      'home.tools.seoFiles.tagRobots',
      'home.tools.seoFiles.tagSitemap',
    ],
    gradient: 'hover:bg-green-50 dark:hover:bg-green-950/20',
    border: 'hover:border-green-300 dark:hover:border-green-700',
  },
  {
    to: '/git-tool' as const,
    icon: <Code2 className="h-8 w-8 text-orange-500" />,
    titleKey: 'home.tools.gitTool.title',
    descKey: 'home.tools.gitTool.desc',
    tagKeys: ['home.tools.gitTool.tagIgnore', 'home.tools.gitTool.tagCommit'],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/bundle-inspector' as const,
    icon: <Activity className="h-8 w-8 text-indigo-500" />,
    titleKey: 'home.tools.bundleInspector.title',
    descKey: 'home.tools.bundleInspector.desc',
    tagKeys: [
      'home.tools.bundleInspector.tagMap',
      'home.tools.bundleInspector.tagSize',
    ],
    gradient: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
    border: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
];

const cryptoTools = [
  {
    to: '/oauth' as const,
    icon: <ShieldPlus className="h-8 w-8 text-blue-500" />,
    titleKey: 'home.tools.oauth.title',
    descKey: 'home.tools.oauth.desc',
    tagKeys: ['home.tools.oauth.tagPkce', 'home.tools.oauth.tagCallback'],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/certificate-tool' as const,
    icon: <KeyRound className="h-8 w-8 text-teal-500" />,
    titleKey: 'home.tools.certificateTool.title',
    descKey: 'home.tools.certificateTool.desc',
    tagKeys: [
      'home.tools.certificateTool.tagX509',
      'home.tools.certificateTool.tagCsr',
    ],
    gradient: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',
    border: 'hover:border-teal-300 dark:hover:border-teal-700',
  },
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
    to: '/totp' as const,
    icon: <ShieldCheck className="w-8 h-8 text-cyan-500" />,
    titleKey: 'home.tools.totp.title',
    descKey: 'home.tools.totp.desc',
    tagKeys: ['home.tools.totp.tag2fa', 'home.tools.totp.tagShare'],
    gradient: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    to: '/jwt' as const,
    icon: <Fingerprint className="w-8 h-8 text-purple-500" />,
    titleKey: 'home.tools.jwt.title',
    descKey: 'home.tools.jwt.desc',
    tagKeys: [
      'home.tools.jwt.tagDecode',
      'home.tools.jwt.tagExpiry',
      'home.tools.jwt.tagJwk',
    ],
    gradient: 'hover:bg-purple-50 dark:hover:bg-purple-950/20',
    border: 'hover:border-purple-300 dark:hover:border-purple-700',
  },
  {
    to: '/uuid' as const,
    icon: <Dices className="w-8 h-8 text-pink-500" />,
    titleKey: 'home.tools.uuid.title',
    descKey: 'home.tools.uuid.desc',
    tagKeys: [
      'home.tools.uuid.tagV4',
      'home.tools.uuid.tagNanoid',
      'home.tools.uuid.tagUlid',
    ],
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
    to: '/dns' as const,
    icon: <Network className="h-8 w-8 text-sky-500" />,
    titleKey: 'home.tools.dns.title',
    descKey: 'home.tools.dns.desc',
    tagKeys: ['home.tools.dns.tagDoh', 'home.tools.dns.tagRecords'],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
  {
    to: '/webrtc-diagnostics' as const,
    icon: <Network className="h-8 w-8 text-indigo-500" />,
    titleKey: 'home.tools.webrtcDiagnostics.title',
    descKey: 'home.tools.webrtcDiagnostics.desc',
    tagKeys: [
      'home.tools.webrtcDiagnostics.tagIce',
      'home.tools.webrtcDiagnostics.tagDevices',
    ],
    gradient: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
    border: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
  {
    to: '/realtime-debugger' as const,
    icon: <Network className="h-8 w-8 text-cyan-500" />,
    titleKey: 'home.tools.realtimeDebugger.title',
    descKey: 'home.tools.realtimeDebugger.desc',
    tagKeys: [
      'home.tools.realtimeDebugger.tagWebSocket',
      'home.tools.realtimeDebugger.tagSse',
    ],
    gradient: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
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
    to: '/curl-converter' as const,
    icon: <Terminal className="w-8 h-8 text-slate-600" />,
    titleKey: 'home.tools.curlConverter.title',
    descKey: 'home.tools.curlConverter.desc',
    tagKeys: [
      'home.tools.curlConverter.tagCurl',
      'home.tools.curlConverter.tagFetch',
    ],
    gradient: 'hover:bg-slate-50 dark:hover:bg-slate-950/20',
    border: 'hover:border-slate-300 dark:hover:border-slate-700',
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
    to: '/cidr' as const,
    icon: <Network className="h-8 w-8 text-emerald-500" />,
    titleKey: 'home.tools.cidr.title',
    descKey: 'home.tools.cidr.desc',
    tagKeys: ['home.tools.cidr.tagSubnet', 'home.tools.cidr.tagRange'],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/ipv6' as const,
    icon: <Network className="h-8 w-8 text-sky-500" />,
    titleKey: 'home.tools.ipv6.title',
    descKey: 'home.tools.ipv6.desc',
    tagKeys: ['home.tools.ipv6.tagCidr', 'home.tools.ipv6.tagUla'],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
  {
    to: '/ip-lookup' as const,
    icon: <MapPin className="w-8 h-8 text-red-500" />,
    titleKey: 'home.tools.ipLookup.title',
    descKey: 'home.tools.ipLookup.desc',
    tagKeys: [
      'home.tools.ipLookup.tagGeo',
      'home.tools.ipLookup.tagCidr',
      'home.tools.ipLookup.tagExtract',
    ],
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
    to: '/pdf-toolkit' as const,
    icon: <FileText className="h-8 w-8 text-red-500" />,
    titleKey: 'home.tools.pdfToolkit.title',
    descKey: 'home.tools.pdfToolkit.desc',
    tagKeys: [
      'home.tools.pdfToolkit.tagPages',
      'home.tools.pdfToolkit.tagMetadata',
    ],
    gradient: 'hover:bg-red-50 dark:hover:bg-red-950/20',
    border: 'hover:border-red-300 dark:hover:border-red-700',
  },
  {
    to: '/batch-files' as const,
    icon: <FileStack className="h-8 w-8 text-amber-500" />,
    titleKey: 'home.tools.batchFiles.title',
    descKey: 'home.tools.batchFiles.desc',
    tagKeys: [
      'home.tools.batchFiles.tagRename',
      'home.tools.batchFiles.tagHash',
    ],
    gradient: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    to: '/text-to-speech' as const,
    icon: <AudioLines className="h-8 w-8 text-violet-500" />,
    titleKey: 'home.tools.textToSpeech.title',
    descKey: 'home.tools.textToSpeech.desc',
    tagKeys: [
      'home.tools.textToSpeech.tagVoice',
      'home.tools.textToSpeech.tagSpeed',
    ],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/diff' as const,
    icon: <ArrowLeftRight className="w-8 h-8 text-orange-500" />,
    titleKey: 'home.tools.diff.title',
    descKey: 'home.tools.diff.desc',
    tagKeys: [
      'home.tools.diff.tagText',
      'home.tools.diff.tagJson',
      'home.tools.diff.tagCode',
    ],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/text' as const,
    icon: <CaseSensitive className="w-8 h-8 text-lime-600" />,
    titleKey: 'home.tools.text.title',
    descKey: 'home.tools.text.desc',
    tagKeys: [
      'home.tools.text.tagDedupe',
      'home.tools.text.tagSort',
      'home.tools.text.tagZh',
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
    to: '/gradient-studio' as const,
    icon: <Palette className="h-8 w-8 text-fuchsia-500" />,
    titleKey: 'home.tools.gradientStudio.title',
    descKey: 'home.tools.gradientStudio.desc',
    tagKeys: [
      'home.tools.gradientStudio.tagGradient',
      'home.tools.gradientStudio.tagLayers',
    ],
    gradient: 'hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20',
    border: 'hover:border-fuchsia-300 dark:hover:border-fuchsia-700',
  },
  {
    to: '/svg-toolkit' as const,
    icon: <FileCode2 className="h-8 w-8 text-orange-500" />,
    titleKey: 'home.tools.svgToolkit.title',
    descKey: 'home.tools.svgToolkit.desc',
    tagKeys: [
      'home.tools.svgToolkit.tagOptimize',
      'home.tools.svgToolkit.tagSprite',
    ],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/font' as const,
    icon: <Type className="w-8 h-8 text-emerald-500" />,
    titleKey: 'home.tools.fontTool.title',
    descKey: 'home.tools.fontTool.desc',
    tagKeys: [
      'home.tools.fontTool.tagGlyphs',
      'home.tools.fontTool.tagPreview',
      'home.tools.fontTool.tagWorker',
    ],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/css-unit' as const,
    icon: <Ruler className="w-8 h-8 text-violet-500" />,
    titleKey: 'css.convertTitle',
    descKey: 'css.convertHint',
    tagKeys: ['css.px', 'css.rem', 'css.vw'],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
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
    to: '/css-shadow' as const,
    icon: <Wind className="w-8 h-8 text-stone-500" />,
    titleKey: 'home.tools.cssShadow.title',
    descKey: 'home.tools.cssShadow.desc',
    tagKeys: [
      'home.tools.cssShadow.tagShadow',
      'home.tools.cssShadow.tagRadius',
    ],
    gradient: 'hover:bg-stone-50 dark:hover:bg-stone-950/20',
    border: 'hover:border-stone-300 dark:hover:border-stone-700',
  },
  {
    to: '/css-tailwind' as const,
    icon: <SquareAsterisk className="w-8 h-8 text-cyan-600" />,
    titleKey: 'home.tools.cssTailwind.title',
    descKey: 'home.tools.cssTailwind.desc',
    tagKeys: [
      'home.tools.cssTailwind.tagToCss',
      'home.tools.cssTailwind.tagToTw',
    ],
    gradient: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    to: '/aspect-ratio' as const,
    icon: <Ratio className="w-8 h-8 text-teal-500" />,
    titleKey: 'home.tools.aspectRatio.title',
    descKey: 'home.tools.aspectRatio.desc',
    tagKeys: [
      'home.tools.aspectRatio.tagRatio',
      'home.tools.aspectRatio.tagSafe',
    ],
    gradient: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',
    border: 'hover:border-teal-300 dark:hover:border-teal-700',
  },
  {
    to: '/og-preview' as const,
    icon: <Share2 className="w-8 h-8 text-sky-600" />,
    titleKey: 'home.tools.ogPreview.title',
    descKey: 'home.tools.ogPreview.desc',
    tagKeys: [
      'home.tools.ogPreview.tagMeta',
      'home.tools.ogPreview.tagPreview',
    ],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
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
  {
    to: '/image-compare' as const,
    icon: <Images className="h-8 w-8 text-rose-500" />,
    titleKey: 'home.tools.imageCompare.title',
    descKey: 'home.tools.imageCompare.desc',
    tagKeys: [
      'home.tools.imageCompare.tagDiff',
      'home.tools.imageCompare.tagHeatmap',
    ],
    gradient: 'hover:bg-rose-50 dark:hover:bg-rose-950/20',
    border: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    to: '/pwa-icons' as const,
    icon: <MonitorSmartphone className="h-8 w-8 text-blue-500" />,
    titleKey: 'home.tools.pwaIcons.title',
    descKey: 'home.tools.pwaIcons.desc',
    tagKeys: [
      'home.tools.pwaIcons.tagIcons',
      'home.tools.pwaIcons.tagManifest',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/image-palette' as const,
    icon: <Palette className="h-8 w-8 text-fuchsia-500" />,
    titleKey: 'home.tools.imagePalette.title',
    descKey: 'home.tools.imagePalette.desc',
    tagKeys: [
      'home.tools.imagePalette.tagPalette',
      'home.tools.imagePalette.tagCss',
    ],
    gradient: 'hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/20',
    border: 'hover:border-fuchsia-300 dark:hover:border-fuchsia-700',
  },
  {
    to: '/id-photo' as const,
    icon: <ImageIcon className="h-8 w-8 text-blue-500" />,
    titleKey: 'home.tools.idPhoto.title',
    descKey: 'home.tools.idPhoto.desc',
    tagKeys: ['home.tools.idPhoto.tagSize', 'home.tools.idPhoto.tagSheet'],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/image-privacy' as const,
    icon: <ShieldCheck className="h-8 w-8 text-emerald-500" />,
    titleKey: 'home.tools.imagePrivacy.title',
    descKey: 'home.tools.imagePrivacy.desc',
    tagKeys: [
      'home.tools.imagePrivacy.tagExif',
      'home.tools.imagePrivacy.tagGps',
      'home.tools.imagePrivacy.tagClean',
    ],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/webp-gif' as const,
    icon: <ArrowLeftRight className="w-8 h-8 text-lime-500" />,
    titleKey: 'home.tools.webpGif.title',
    descKey: 'home.tools.webpGif.desc',
    tagKeys: [
      'home.tools.webpGif.tagWebp',
      'home.tools.webpGif.tagGif',
      'home.tools.webpGif.tagLocal',
    ],
    gradient: 'hover:bg-lime-50 dark:hover:bg-lime-950/20',
    border: 'hover:border-lime-300 dark:hover:border-lime-700',
  },
];

const videoTools = [
  {
    to: '/audio-recorder' as const,
    icon: <AudioLines className="h-8 w-8 text-emerald-500" />,
    titleKey: 'home.tools.audioRecorder.title',
    descKey: 'home.tools.audioRecorder.desc',
    tagKeys: [
      'home.tools.audioRecorder.tagMic',
      'home.tools.audioRecorder.tagRecords',
    ],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/screen-recorder' as const,
    icon: <Video className="h-8 w-8 text-red-500" />,
    titleKey: 'home.tools.screenRecorder.title',
    descKey: 'home.tools.screenRecorder.desc',
    tagKeys: [
      'home.tools.screenRecorder.tagCapture',
      'home.tools.screenRecorder.tagOpfs',
      'home.tools.screenRecorder.tagLocal',
    ],
    gradient: 'hover:bg-red-50 dark:hover:bg-red-950/20',
    border: 'hover:border-red-300 dark:hover:border-red-700',
  },
  {
    to: '/video-trimmer' as const,
    icon: <Scissors className="h-8 w-8 text-rose-500" />,
    titleKey: 'home.tools.videoTrimmer.title',
    descKey: 'home.tools.videoTrimmer.desc',
    tagKeys: [
      'home.tools.videoTrimmer.tagTrim',
      'home.tools.videoTrimmer.tagMediabunny',
      'home.tools.videoTrimmer.tagWorker',
    ],
    gradient: 'hover:bg-rose-50 dark:hover:bg-rose-950/20',
    border: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    to: '/video-editor' as const,
    icon: <Video className="h-8 w-8 text-orange-500" />,
    titleKey: 'home.tools.videoEditor.title',
    descKey: 'home.tools.videoEditor.desc',
    tagKeys: [
      'home.tools.videoEditor.tagMerge',
      'home.tools.videoEditor.tagAudio',
      'home.tools.videoEditor.tagTransform',
    ],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/video-animation' as const,
    icon: <Images className="h-8 w-8 text-lime-500" />,
    titleKey: 'home.tools.videoAnimation.title',
    descKey: 'home.tools.videoAnimation.desc',
    tagKeys: [
      'home.tools.videoAnimation.tagGif',
      'home.tools.videoAnimation.tagWebp',
    ],
    gradient: 'hover:bg-lime-50 dark:hover:bg-lime-950/20',
    border: 'hover:border-lime-300 dark:hover:border-lime-700',
  },
  {
    to: '/audio-editor' as const,
    icon: <AudioLines className="h-8 w-8 text-violet-500" />,
    titleKey: 'home.tools.audioEditor.title',
    descKey: 'home.tools.audioEditor.desc',
    tagKeys: [
      'home.tools.audioEditor.tagTrim',
      'home.tools.audioEditor.tagMerge',
      'home.tools.audioEditor.tagWaveform',
    ],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/subtitle-editor' as const,
    icon: <Captions className="h-8 w-8 text-sky-500" />,
    titleKey: 'home.tools.subtitleEditor.title',
    descKey: 'home.tools.subtitleEditor.desc',
    tagKeys: [
      'home.tools.subtitleEditor.tagSrt',
      'home.tools.subtitleEditor.tagVtt',
      'home.tools.subtitleEditor.tagBurn',
    ],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
];

const lifeTools = [
  {
    to: '/rmb-uppercase' as const,
    icon: <Wallet className="h-8 w-8 text-red-500" />,
    titleKey: 'home.tools.rmbUppercase.title',
    descKey: 'home.tools.rmbUppercase.desc',
    tagKeys: [
      'home.tools.rmbUppercase.tagAmount',
      'home.tools.rmbUppercase.tagChinese',
    ],
    gradient: 'hover:bg-red-50 dark:hover:bg-red-950/20',
    border: 'hover:border-red-300 dark:hover:border-red-700',
  },
  {
    to: '/finance-calculator' as const,
    icon: <Landmark className="h-8 w-8 text-green-500" />,
    titleKey: 'home.tools.financeCalculator.title',
    descKey: 'home.tools.financeCalculator.desc',
    tagKeys: [
      'home.tools.financeCalculator.tagCompound',
      'home.tools.financeCalculator.tagInflation',
    ],
    gradient: 'hover:bg-green-50 dark:hover:bg-green-950/20',
    border: 'hover:border-green-300 dark:hover:border-green-700',
  },
  {
    to: '/home-energy' as const,
    icon: <Activity className="h-8 w-8 text-yellow-500" />,
    titleKey: 'home.tools.homeEnergy.title',
    descKey: 'home.tools.homeEnergy.desc',
    tagKeys: [
      'home.tools.homeEnergy.tagAppliance',
      'home.tools.homeEnergy.tagCost',
    ],
    gradient: 'hover:bg-yellow-50 dark:hover:bg-yellow-950/20',
    border: 'hover:border-yellow-300 dark:hover:border-yellow-700',
  },
  {
    to: '/geometry-calculator' as const,
    icon: <Ruler className="h-8 w-8 text-indigo-500" />,
    titleKey: 'home.tools.geometryCalculator.title',
    descKey: 'home.tools.geometryCalculator.desc',
    tagKeys: [
      'home.tools.geometryCalculator.tagArea',
      'home.tools.geometryCalculator.tagMaterial',
    ],
    gradient: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
    border: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
  {
    to: '/date-calculator' as const,
    icon: <CalendarClock className="h-8 w-8 text-blue-500" />,
    titleKey: 'home.tools.dateCalculator.title',
    descKey: 'home.tools.dateCalculator.desc',
    tagKeys: [
      'home.tools.dateCalculator.tagAge',
      'home.tools.dateCalculator.tagCountdown',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/salary-tax' as const,
    icon: <Landmark className="h-8 w-8 text-amber-500" />,
    titleKey: 'home.tools.salaryTax.title',
    descKey: 'home.tools.salaryTax.desc',
    tagKeys: ['home.tools.salaryTax.tagTax', 'home.tools.salaryTax.tagNet'],
    gradient: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    to: '/travel-cost' as const,
    icon: <MapPin className="h-8 w-8 text-emerald-500" />,
    titleKey: 'home.tools.travelCost.title',
    descKey: 'home.tools.travelCost.desc',
    tagKeys: [
      'home.tools.travelCost.tagFuel',
      'home.tools.travelCost.tagElectric',
    ],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/pace-calculator' as const,
    icon: <Activity className="h-8 w-8 text-orange-500" />,
    titleKey: 'home.tools.paceCalculator.title',
    descKey: 'home.tools.paceCalculator.desc',
    tagKeys: [
      'home.tools.paceCalculator.tagPace',
      'home.tools.paceCalculator.tagSpeed',
    ],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/recipe-scale' as const,
    icon: <ListOrdered className="h-8 w-8 text-rose-500" />,
    titleKey: 'home.tools.recipeScale.title',
    descKey: 'home.tools.recipeScale.desc',
    tagKeys: [
      'home.tools.recipeScale.tagServings',
      'home.tools.recipeScale.tagRatio',
    ],
    gradient: 'hover:bg-rose-50 dark:hover:bg-rose-950/20',
    border: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    to: '/size-converter' as const,
    icon: <Ruler className="h-8 w-8 text-violet-500" />,
    titleKey: 'home.tools.sizeConverter.title',
    descKey: 'home.tools.sizeConverter.desc',
    tagKeys: [
      'home.tools.sizeConverter.tagShoe',
      'home.tools.sizeConverter.tagClothing',
    ],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/meeting-planner' as const,
    icon: <Globe className="h-8 w-8 text-cyan-500" />,
    titleKey: 'home.tools.meetingPlanner.title',
    descKey: 'home.tools.meetingPlanner.desc',
    tagKeys: [
      'home.tools.meetingPlanner.tagCities',
      'home.tools.meetingPlanner.tagTimezones',
    ],
    gradient: 'hover:bg-cyan-50 dark:hover:bg-cyan-950/20',
    border: 'hover:border-cyan-300 dark:hover:border-cyan-700',
  },
  {
    to: '/ics-generator' as const,
    icon: <FileText className="h-8 w-8 text-indigo-500" />,
    titleKey: 'home.tools.icsGenerator.title',
    descKey: 'home.tools.icsGenerator.desc',
    tagKeys: [
      'home.tools.icsGenerator.tagIcs',
      'home.tools.icsGenerator.tagCalendar',
    ],
    gradient: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
    border: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
  {
    to: '/random-picker' as const,
    icon: <Dices className="h-8 w-8 text-pink-500" />,
    titleKey: 'home.tools.randomPicker.title',
    descKey: 'home.tools.randomPicker.desc',
    tagKeys: [
      'home.tools.randomPicker.tagGroup',
      'home.tools.randomPicker.tagDraw',
    ],
    gradient: 'hover:bg-pink-50 dark:hover:bg-pink-950/20',
    border: 'hover:border-pink-300 dark:hover:border-pink-700',
  },
  {
    to: '/bill-split' as const,
    icon: <ArrowLeftRight className="h-8 w-8 text-teal-500" />,
    titleKey: 'home.tools.billSplit.title',
    descKey: 'home.tools.billSplit.desc',
    tagKeys: ['home.tools.billSplit.tagSplit', 'home.tools.billSplit.tagTip'],
    gradient: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',
    border: 'hover:border-teal-300 dark:hover:border-teal-700',
  },
  {
    to: '/home-budget' as const,
    icon: <House className="h-8 w-8 text-lime-500" />,
    titleKey: 'home.tools.homeBudget.title',
    descKey: 'home.tools.homeBudget.desc',
    tagKeys: [
      'home.tools.homeBudget.tagArea',
      'home.tools.homeBudget.tagBudget',
    ],
    gradient: 'hover:bg-lime-50 dark:hover:bg-lime-950/20',
    border: 'hover:border-lime-300 dark:hover:border-lime-700',
  },
  {
    to: '/world-clock' as const,
    icon: <Clock className="h-8 w-8 text-sky-500" />,
    titleKey: 'home.tools.worldClock.title',
    descKey: 'home.tools.worldClock.desc',
    tagKeys: [
      'home.tools.worldClock.tagUtc',
      'home.tools.worldClock.tagCities',
      'home.tools.worldClock.tagDst',
    ],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
  {
    to: '/gushi-namer' as const,
    icon: <Flower2 className="h-8 w-8 text-rose-500" />,
    titleKey: 'home.tools.gushiNamer.title',
    descKey: 'home.tools.gushiNamer.desc',
    tagKeys: [
      'home.tools.gushiNamer.tagPoetry',
      'home.tools.gushiNamer.tagSource',
      'home.tools.gushiNamer.tagLocal',
    ],
    gradient: 'hover:bg-rose-50 dark:hover:bg-rose-950/20',
    border: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    to: '/social-insurance' as const,
    icon: <Landmark className="h-8 w-8 text-violet-500" />,
    titleKey: 'home.tools.socialInsurance.title',
    descKey: 'home.tools.socialInsurance.desc',
    tagKeys: [
      'home.tools.socialInsurance.tagCities',
      'home.tools.socialInsurance.tagRates',
    ],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/mortgage' as const,
    icon: <House className="h-8 w-8 text-blue-500" />,
    titleKey: 'home.tools.mortgage.title',
    descKey: 'home.tools.mortgage.desc',
    tagKeys: [
      'home.tools.mortgage.tagPayment',
      'home.tools.mortgage.tagPrincipal',
    ],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/bmi' as const,
    icon: <Activity className="h-8 w-8 text-emerald-500" />,
    titleKey: 'home.tools.bmi.title',
    descKey: 'home.tools.bmi.desc',
    tagKeys: ['home.tools.bmi.tagBmi', 'home.tools.bmi.tagChina'],
    gradient: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    to: '/temperature' as const,
    icon: <Thermometer className="h-8 w-8 text-orange-500" />,
    titleKey: 'home.tools.temperature.title',
    descKey: 'home.tools.temperature.desc',
    tagKeys: [
      'home.tools.temperature.tagCelsius',
      'home.tools.temperature.tagFahrenheit',
      'home.tools.temperature.tagKelvin',
    ],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/unit-converter' as const,
    icon: <Ruler className="h-8 w-8 text-teal-500" />,
    titleKey: 'home.tools.unitConverter.title',
    descKey: 'home.tools.unitConverter.desc',
    tagKeys: [
      'home.tools.unitConverter.tagUnits',
      'home.tools.unitConverter.tagData',
      'home.tools.unitConverter.tagLocal',
    ],
    gradient: 'hover:bg-teal-50 dark:hover:bg-teal-950/20',
    border: 'hover:border-teal-300 dark:hover:border-teal-700',
  },
  {
    to: '/archive' as const,
    icon: <FileArchive className="h-8 w-8 text-amber-500" />,
    titleKey: 'home.tools.archive.title',
    descKey: 'home.tools.archive.desc',
    tagKeys: [
      'home.tools.archive.tagZip',
      'home.tools.archive.tagSevenZip',
      'home.tools.archive.tagLocal',
    ],
    gradient: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
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
          className={`h-full cursor-pointer rounded-2xl py-0 shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${tool.gradient} ${tool.border}`}
        >
          <CardHeader className="gap-2 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/70 transition-transform duration-200 group-hover:scale-105">
              {tool.icon}
            </div>
            <CardTitle className="mt-1 text-base">{t(tool.titleKey)}</CardTitle>
            <CardDescription className="line-clamp-1 text-xs leading-relaxed">
              {t(tool.descKey)}
            </CardDescription>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tool.tagKeys.map((key) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="rounded-full px-2 text-[11px] font-normal"
                >
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
  ...videoTools,
  ...lifeTools,
  ...developerExtraTools,
];

const HOME_CATEGORIES = [
  { value: 'recommended', labelKey: 'home.recommended', icon: Star },
  {
    value: 'developer',
    labelKey: 'shell.developerTools',
    icon: Code2,
  },
  {
    value: 'conversion',
    labelKey: 'shell.textAndConversion',
    icon: ArrowLeftRight,
  },
  { value: 'design', labelKey: 'shell.designTools', icon: Palette },
  { value: 'image', labelKey: 'shell.imageTools', icon: ImageIcon },
  { value: 'video', labelKey: 'shell.videoTools', icon: Video },
  { value: 'life', labelKey: 'shell.lifeTools', icon: Flower2 },
  { value: 'all', labelKey: 'home.allTools', icon: Layers },
] as const;

type HomeCategory = (typeof HOME_CATEGORIES)[number]['value'] | 'favorites';

const RECOMMENDED_TOOLS: ToolConfig[] = [
  formatterTools[0]!,
  formatterTools[1]!,
  formatterTools[2]!,
  formatterTools[3]!,
  encodeTools[0]!,
  encodeTools[1]!,
  textTools[0]!,
  frontendTools.at(-2)!,
];

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-muted-foreground">
      {icon}
      <p className="text-sm">{label}</p>
    </div>
  );
}

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
  const [category, setCategory] = useQueryParam<HomeCategory>(
    'category',
    StringParam,
    'recommended',
  );
  const isDeveloperCategory = category === 'developer';
  const isConversionCategory = category === 'conversion';
  const isDesignCategory = category === 'design';
  const isImageCategory = category === 'image';
  const isVideoCategory = category === 'video';
  const isLifeCategory = category === 'life';
  const visibleConvertTools =
    category === 'all'
      ? convertTools
      : convertTools.filter((tool) =>
          isDeveloperCategory
            ? tool.to !== '/number-base'
            : tool.to === '/number-base',
        );
  // 本地乐观顺序：拖拽时立即更新，避免等 DB 回写再渲染产生闪动
  const [localOrder, setLocalOrder] = React.useState<string[]>(favoritePaths);
  // 当前正在拖拽的工具路径（用于 DragOverlay）
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [smartInput, setSmartInput] = React.useState('');
  const smartSuggestions = detectToolSuggestions(smartInput);

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
    <div className="mx-auto max-w-[1480px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      {category === 'recommended' && (
        <section className="relative min-h-[250px] overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-sky-50/80 to-indigo-50 px-7 py-10 dark:border-blue-950 dark:from-blue-950/35 dark:via-sky-950/20 dark:to-indigo-950/25 sm:px-12">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
              {t('home.title')}
            </h1>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-300 sm:text-lg">
              {t('home.heroSubtitle')}
            </p>
            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-700 dark:text-slate-300">
              {[
                ['home.browserOnly', Globe],
                ['home.noInstall', Upload],
                ['home.localProcessing', ShieldCheck],
                ['home.privacySafe', Fingerprint],
              ].map(([labelKey, Icon]) => (
                <span
                  key={labelKey as string}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4 text-blue-600" />
                  {t(labelKey as string)}
                </span>
              ))}
            </div>
          </div>
          <div className="absolute -right-8 top-1/2 hidden h-48 w-80 -translate-y-1/2 rotate-3 items-center justify-center rounded-[2.5rem] border border-white/80 bg-gradient-to-br from-blue-400/90 to-blue-600/90 shadow-2xl shadow-blue-500/25 lg:flex">
            <Code2 className="h-24 w-24 -rotate-3 text-white drop-shadow-lg" />
            <div className="absolute -left-10 bottom-5 h-20 w-16 rounded-2xl border border-white/80 bg-white/75 shadow-lg backdrop-blur">
              <FileCode2 className="m-auto mt-5 h-9 w-9 text-blue-500" />
            </div>
          </div>
        </section>
      )}

      {category === 'recommended' && (
        <div className="flex flex-wrap gap-2">
          {HOME_CATEGORIES.map(({ value, labelKey, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${category === value ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25' : 'bg-muted/70 text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>
      )}

      {category === 'recommended' && (
        <section className="space-y-3 rounded-2xl border p-4">
          <h2 className="font-semibold">{t('home.smart.title')}</h2>
          <textarea
            value={smartInput}
            onChange={(event) => setSmartInput(event.target.value)}
            className="h-24 w-full resize-none rounded-md border bg-background p-3 font-mono text-sm"
            placeholder={t('home.smart.placeholder')}
          />
          {smartSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {smartSuggestions.map((suggestion) => (
                <a
                  key={suggestion.path}
                  href={suggestion.path}
                  className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {t(`home.smart.tools.${suggestion.code}`)}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="space-y-8">
        {category === 'favorites' && favoriteTools.length === 0 && (
          <EmptyState
            icon={<Star className="size-8" />}
            label={t('home.emptyFavorites')}
          />
        )}

        {category === 'recommended' && (
          <section>
            <h2 className="mb-4 text-xl font-bold">{t('home.recommended')}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {RECOMMENDED_TOOLS.map((tool) => (
                <ToolCard
                  key={tool.to}
                  tool={tool}
                  t={t}
                  isFavorite={isFavorite(tool.to)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <Button
                variant="secondary"
                className="rounded-xl px-8 text-blue-600"
                onClick={() => setCategory('all')}
              >
                {t('home.viewMore')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {/* 我的收藏（有收藏时才显示；ready 守卫已在 HomePage 完成） */}
        {(category === 'favorites' || category === 'all') &&
          favoriteTools.length > 0 && (
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
        {(isDeveloperCategory || category === 'all') && (
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
        )}

        {/* 编码 / 转换 */}
        {(isDeveloperCategory || category === 'all') && (
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
        )}

        {/* 加密 / 安全 */}
        {(isDeveloperCategory || category === 'all') && (
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
        )}

        {/* 网络 / 请求 */}
        {(isDeveloperCategory || category === 'all') && (
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
        )}

        {/* 数据转换 / 互转 */}
        {(isDeveloperCategory || category === 'all') && (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                <Code2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-none">
                  {t('home.groupDeveloper')}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('home.developerSubtitle')}
                </p>
              </div>
              <div className="ml-2 h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {developerExtraTools.map((tool) => (
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
        )}

        {/* 数据转换 / 互转 */}
        {(isDeveloperCategory ||
          isConversionCategory ||
          category === 'all') && (
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
              {visibleConvertTools.map((tool) => (
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
        )}

        {/* 其他 */}
        {(isConversionCategory || category === 'all') && (
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
        )}

        {/* 设计工具 */}
        {(isDesignCategory || category === 'all') && (
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
              {frontendTools
                .filter(
                  (tool) =>
                    tool.to !== '/image' &&
                    tool.to !== '/image-compare' &&
                    tool.to !== '/pwa-icons' &&
                    tool.to !== '/image-palette' &&
                    tool.to !== '/id-photo' &&
                    tool.to !== '/image-privacy' &&
                    tool.to !== '/webp-gif' &&
                    tool.to !== '/og-preview',
                )
                .map((tool) => (
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
        )}

        {/* 图片工具 */}
        {(isImageCategory || category === 'all') && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-none">
                  {t('home.groupImage')}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('home.imageSubtitle')}
                </p>
              </div>
              <div className="flex-1 h-px bg-border ml-2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {frontendTools
                .filter(
                  (tool) =>
                    tool.to === '/image' ||
                    tool.to === '/image-compare' ||
                    tool.to === '/pwa-icons' ||
                    tool.to === '/image-palette' ||
                    tool.to === '/id-photo' ||
                    tool.to === '/image-privacy' ||
                    tool.to === '/webp-gif' ||
                    tool.to === '/og-preview',
                )
                .map((tool) => (
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
        )}

        {/* 视频工具 */}
        {(isVideoCategory || category === 'all') && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-500">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-none">
                  {t('home.groupVideo')}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('home.videoSubtitle')}
                </p>
              </div>
              <div className="flex-1 h-px bg-border ml-2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {videoTools.map((tool) => (
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
        )}

        {/* 生活工具 */}
        {(isLifeCategory || category === 'all') && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500">
                <Flower2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-none">
                  {t('home.groupLife')}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('home.lifeSubtitle')}
                </p>
              </div>
              <div className="flex-1 h-px bg-border ml-2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {lifeTools.map((tool) => (
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
        )}
      </div>
    </div>
  );
}
