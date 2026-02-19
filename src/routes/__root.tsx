import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Link } from '@tanstack/react-router'
import { TooltipProvider } from '../components/ui/tooltip'
import {
  Code2,
  Braces,
  FileCode,
  Paintbrush,
  FileCode2,
  Tag,
  FileText,
  Database,
  FileStack,
  Binary,
  Link as LinkIcon,
  Globe,
  ChevronDown,
  AlignLeft,
  Shuffle,
} from 'lucide-react'
import '../i18n'
import { useTranslation } from 'react-i18next'
import { LangSwitcher } from '../components/lang-switcher'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Dev Tools' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  component: RootDocument,
})

type NavItem = { to: string; icon: React.ReactNode; labelKey: string }

const formatterNavItems: NavItem[] = [
  { to: '/json',     icon: <Braces className="w-4 h-4 text-amber-500" />,  labelKey: 'nav.json' },
  { to: '/html',     icon: <FileCode className="w-4 h-4 text-blue-500" />, labelKey: 'nav.html' },
  { to: '/css',      icon: <Paintbrush className="w-4 h-4 text-violet-500" />, labelKey: 'nav.css' },
  { to: '/js',       icon: <FileCode2 className="w-4 h-4 text-yellow-500" />, labelKey: 'nav.js' },
  { to: '/xml',      icon: <Tag className="w-4 h-4 text-orange-500" />,    labelKey: 'nav.xml' },
  { to: '/markdown', icon: <FileText className="w-4 h-4 text-teal-500" />, labelKey: 'nav.markdown' },
  { to: '/sql',      icon: <Database className="w-4 h-4 text-cyan-500" />, labelKey: 'nav.sql' },
  { to: '/yaml',     icon: <FileStack className="w-4 h-4 text-green-500" />, labelKey: 'nav.yaml' },
]

const encodeNavItems: NavItem[] = [
  { to: '/base64',    icon: <Binary className="w-4 h-4 text-rose-500" />,  labelKey: 'nav.base64' },
  { to: '/url-encode', icon: <LinkIcon className="w-4 h-4 text-sky-500" />, labelKey: 'nav.urlEncode' },
  { to: '/unicode',   icon: <Globe className="w-4 h-4 text-indigo-500" />, labelKey: 'nav.unicode' },
]

function RootDocument() {
  return (
      <div>
        <HeadContent />
        <TooltipProvider>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <header className="border-b sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
              <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
                  <Code2 className="w-5 h-5 text-primary" />
                  <span>Dev Tools</span>
                </Link>
                <div className="flex items-center gap-1">
                  <CategoryMenu
                    labelKey="nav.catFormatter"
                    icon={<AlignLeft className="w-4 h-4" />}
                    items={formatterNavItems}
                  />
                  <CategoryMenu
                    labelKey="nav.catEncode"
                    icon={<Shuffle className="w-4 h-4" />}
                    items={encodeNavItems}
                  />
                </div>
                <div className="ml-auto">
                  <LangSwitcher />
                </div>
              </nav>
            </header>
            <main className="flex-1"><Outlet /></main>
          </div>
        </TooltipProvider>
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[{ name: 'Router', render: <TanStackRouterDevtoolsPanel /> }]}
        />
        <Scripts />
      </div>
  )
}

function CategoryMenu({
  labelKey,
  icon,
  items,
}: {
  labelKey: string
  icon: React.ReactNode
  items: NavItem[]
}) {
  const { t } = useTranslation()
  return (
    <div className="relative group">
      {/* trigger */}
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer select-none">
        {icon}
        <span>{t(labelKey)}</span>
        <ChevronDown className="w-3 h-3 opacity-60 transition-transform duration-200 group-hover:rotate-180" />
      </button>

      {/* dropdown panel */}
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
            activeProps={{ className: 'flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground bg-accent mx-1 rounded-lg' }}
          >
            {item.icon}
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
