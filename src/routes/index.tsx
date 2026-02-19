import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Braces, FileCode, FileCode2, Paintbrush, ShieldCheck, Tag, FileText, Database, FileStack, Binary, Link as LinkIcon, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/')({ component: HomePage })

const formatterTools = [
  {
    to: '/json' as const,
    icon: <Braces className="w-8 h-8 text-amber-500" />,
    titleKey: 'home.tools.json.title',
    descKey: 'home.tools.json.desc',
    tagKeys: ['home.tools.json.tagFormat', 'home.tools.json.tagMinify', 'home.tools.json.tagValidate'],
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
    tagKeys: ['home.tools.css.tagFormat', 'home.tools.css.tagMinify', 'home.tools.css.tagScss'],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  {
    to: '/js' as const,
    icon: <FileCode2 className="w-8 h-8 text-yellow-500" />,
    titleKey: 'home.tools.js.title',
    descKey: 'home.tools.js.desc',
    tagKeys: ['home.tools.js.tagFormat', 'home.tools.js.tagMinify', 'home.tools.js.tagObfuscate'],
    gradient: 'hover:bg-yellow-50 dark:hover:bg-yellow-950/20',
    border: 'hover:border-yellow-300 dark:hover:border-yellow-700',
  },
  {
    to: '/xml' as const,
    icon: <Tag className="w-8 h-8 text-orange-500" />,
    titleKey: 'home.tools.xml.title',
    descKey: 'home.tools.xml.desc',
    tagKeys: ['home.tools.xml.tagFormat', 'home.tools.xml.tagValidate', 'home.tools.xml.tagMinify'],
    gradient: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    border: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  {
    to: '/markdown' as const,
    icon: <FileText className="w-8 h-8 text-teal-500" />,
    titleKey: 'home.tools.markdown.title',
    descKey: 'home.tools.markdown.desc',
    tagKeys: ['home.tools.markdown.tagBeautify', 'home.tools.markdown.tagPreview'],
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
    tagKeys: ['home.tools.yaml.tagFormat', 'home.tools.yaml.tagValidate', 'home.tools.yaml.tagToJson'],
    gradient: 'hover:bg-green-50 dark:hover:bg-green-950/20',
    border: 'hover:border-green-300 dark:hover:border-green-700',
  },
]

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
    tagKeys: ['home.tools.urlEncode.tagEncode', 'home.tools.urlEncode.tagDecode', 'home.tools.urlEncode.tagParse'],
    gradient: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
    border: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
  {
    to: '/unicode' as const,
    icon: <Globe className="w-8 h-8 text-indigo-500" />,
    titleKey: 'home.tools.unicode.title',
    descKey: 'home.tools.unicode.desc',
    tagKeys: ['home.tools.unicode.tagEscape', 'home.tools.unicode.tagUtf8', 'home.tools.unicode.tagCodepoints'],
    gradient: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
    border: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
]

type ToolConfig = {
  to: string
  icon: React.ReactNode
  titleKey: string
  descKey: string
  tagKeys: string[]
  gradient: string
  border: string
}

function ToolCard({ tool, t }: { tool: ToolConfig; t: (key: string) => string }) {
  return (
    <Link key={tool.to} to={tool.to} className="group">
      <Card className={`h-full cursor-pointer transition-all duration-200 ${tool.gradient} ${tool.border}`}>
        <CardHeader>
          <div className="mb-2 transition-transform duration-200 group-hover:scale-110 w-fit">
            {tool.icon}
          </div>
          <CardTitle className="text-lg">{t(tool.titleKey)}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">{t(tool.descKey)}</CardDescription>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {tool.tagKeys.map((key) => (
              <Badge key={key} variant="secondary" className="text-xs">{t(key)}</Badge>
            ))}
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}

function HomePage() {
  const { t } = useTranslation()

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

      <div className="space-y-8">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t('home.groupFormat')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {formatterTools.map((tool) => (
              <ToolCard key={tool.to} tool={tool} t={t} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t('home.groupEncode')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {encodeTools.map((tool) => (
              <ToolCard key={tool.to} tool={tool} t={t} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

