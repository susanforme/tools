import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Braces, FileCode, Paintbrush, ShieldCheck } from 'lucide-react'

export const Route = createFileRoute('/')({ component: HomePage })

const tools = [
  {
    to: '/json' as const,
    icon: <Braces className="w-8 h-8 text-amber-500" />,
    title: 'JSON 工具',
    description: 'JSON 格式化、压缩与语法验证',
    tags: ['格式化', '压缩', '验证'],
    gradient: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    to: '/html' as const,
    icon: <FileCode className="w-8 h-8 text-blue-500" />,
    title: 'HTML 工具',
    description: 'HTML 代码格式化与压缩',
    tags: ['格式化', '压缩'],
    gradient: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    border: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  {
    to: '/css' as const,
    icon: <Paintbrush className="w-8 h-8 text-violet-500" />,
    title: 'CSS / SCSS 工具',
    description: 'CSS 格式化、压缩，SCSS 编译为 CSS',
    tags: ['格式化', '压缩', 'SCSS→CSS'],
    gradient: 'hover:bg-violet-50 dark:hover:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
]

function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-12 text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">开发工具集</h1>
        <p className="text-muted-foreground text-lg">
          常用前端开发辅助工具，所有处理均在本地完成，不上传任何数据
        </p>
        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span>本地处理，数据安全</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link key={tool.to} to={tool.to} className="group">
            <Card
              className={`h-full cursor-pointer transition-all duration-200 ${tool.gradient} ${tool.border}`}
            >
              <CardHeader>
                <div className="mb-2 transition-transform duration-200 group-hover:scale-110 w-fit">
                  {tool.icon}
                </div>
                <CardTitle className="text-lg">{tool.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {tool.description}
                </CardDescription>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {tool.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
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
