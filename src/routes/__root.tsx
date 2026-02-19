import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Link } from '@tanstack/react-router'
import { TooltipProvider } from '../components/ui/tooltip'
import { Code2, Braces, FileCode, Paintbrush, FileCode2, Tag, FileText, Database, FileStack, Binary, Link as LinkIcon, Globe } from 'lucide-react'
import '../i18n'
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
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                  <NavLink to="/json" icon={<Braces className="w-4 h-4" />} label="JSON" />
                  <NavLink to="/html" icon={<FileCode className="w-4 h-4" />} label="HTML" />
                  <NavLink to="/css" icon={<Paintbrush className="w-4 h-4" />} label="CSS / SCSS" />
                  <NavLink to="/js" icon={<FileCode2 className="w-4 h-4" />} label="JS" />
                  <NavLink to="/xml" icon={<Tag className="w-4 h-4" />} label="XML" />
                  <NavLink to="/markdown" icon={<FileText className="w-4 h-4" />} label="Markdown" />
                  <NavLink to="/sql" icon={<Database className="w-4 h-4" />} label="SQL" />
                  <NavLink to="/yaml" icon={<FileStack className="w-4 h-4" />} label="YAML" />
                  <NavLink to="/base64" icon={<Binary className="w-4 h-4" />} label="Base64" />
                  <NavLink to="/url-encode" icon={<LinkIcon className="w-4 h-4" />} label="URL" />
                  <NavLink to="/unicode" icon={<Globe className="w-4 h-4" />} label="Unicode" />
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

function NavLink({
  to,
  icon,
  label,
}: {
  to: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      activeProps={{ className: 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-foreground bg-accent' }}
    >
      {icon}
      {label}
    </Link>
  )
}
