import { createFileRoute, Link } from '@tanstack/react-router';
import {
  AlignLeft,
  ArrowLeftRight,
  Binary,
  Braces,
  CaseSensitive,
  Clock,
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
  Table,
  Tag,
} from 'lucide-react';
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
}: {
  tool: ToolConfig;
  t: (key: string) => string;
}) {
  return (
    <Link key={tool.to} to={tool.to} className="group">
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
  );
}

function HomePage() {
  const { t } = useTranslation();

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
              <ToolCard key={tool.to} tool={tool} t={t} />
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
              <ToolCard key={tool.to} tool={tool} t={t} />
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
              <ToolCard key={tool.to} tool={tool} t={t} />
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
              <ToolCard key={tool.to} tool={tool} t={t} />
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
              <ToolCard key={tool.to} tool={tool} t={t} />
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
              <ToolCard key={tool.to} tool={tool} t={t} />
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
              <ToolCard key={tool.to} tool={tool} t={t} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
