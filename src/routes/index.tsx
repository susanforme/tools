import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Braces, FileCode, Paintbrush, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/')({ component: HomePage })

const toolConfigs = [
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
]

function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-12 text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">{t('home.title')}</h1>
        <p className="text-muted-foreground text-lg">{t('home.subtitle')}</p>
        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span>{t('home.localProcess')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {toolConfigs.map((tool) => (
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
        ))}
      </div>
    </div>
  )
}
