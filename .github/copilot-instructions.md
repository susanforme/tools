# 项目规范 — Dev Tools

## 技术栈

- **框架**：TanStack Start (`@tanstack/react-start`) + TanStack Router v1.132（文件系统路由）
- **UI**：React 19 + Tailwind CSS v4 + shadcn/ui（基于 `radix-ui`）
- **构建**：Vite 7 + TypeScript 5.7（严格模式）
- **运行时**：Bun
- **测试**：Vitest + @testing-library/react
- **开发代理**：portless（HTTPS）

## 目录结构

```
src/
├── router.tsx              # createRouter 配置
├── routeTree.gen.ts        # 自动生成，禁止手动编辑
├── styles.css              # 全局样式（Tailwind v4 @import）
├── components/
│   ├── code-panel.tsx      # 通用输入/输出双栏面板
│   └── ui/                 # shadcn 组件，禁止直接修改源码结构
└── routes/
    ├── __root.tsx          # 根布局（导航栏 + TooltipProvider）
    ├── index.tsx           # 首页工具卡片列表
    ├── json.tsx
    ├── html.tsx
    └── css.tsx
```

## 路由规范

- 每个页面文件放在 `src/routes/` 下，文件名即路径段（`json.tsx` → `/json`）
- 每个路由文件必须以 `createFileRoute` 导出 `Route`：
  ```tsx
  export const Route = createFileRoute('/your-path')({ component: YourPage })
  ```
- 不要手动修改 `src/routeTree.gen.ts`，由 `@tanstack/router-plugin` 自动生成
- 导航链接统一在 `src/routes/__root.tsx` 的 `<nav>` 中添加

## 组件规范

### 新增工具页面模板

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CodePanel } from '../components/code-panel'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/your-tool')({ component: YourToolPage })

function YourToolPage() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const process = () => {
    setError(null)
    try {
      // 处理逻辑
      setOutput(/* result */)
    } catch (e) {
      setError(`处理失败：${(e as Error).message}`)
    }
  }

  const clear = () => { setInput(''); setOutput(''); setError(null) }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">工具名称</h1>
        <p className="text-muted-foreground text-sm mt-1">工具描述</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={process}>处理</Button>
        <Button size="sm" variant="outline" onClick={clear}>清空</Button>
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        inputPlaceholder="在此粘贴内容..."
        error={error}
      />
    </div>
  )
}
```

### CodePanel

公共双栏面板，接受以下 props：

| Prop | 类型 | 说明 |
|------|------|------|
| `input` | `string` | 输入内容 |
| `output` | `string` | 输出内容（只读） |
| `onInputChange` | `(v: string) => void` | 输入变更回调 |
| `inputPlaceholder` | `string?` | 输入框占位文本 |
| `error` | `string \| null?` | 错误信息（红色提示条） |

## 样式规范

- 使用 Tailwind CSS v4 原子类，**不要** 写内联 style 或额外 CSS 文件
- 颜色使用语义化 token：`text-foreground`、`text-muted-foreground`、`bg-background`、`text-destructive` 等
- 响应式布局优先使用 `md:` 前缀
- 图标使用 `lucide-react`，尺寸统一用 `w-4 h-4` / `w-5 h-5` / `w-8 h-8`
- 工具卡片 hover 颜色规范（首页）：amber / blue / violet / green / rose / sky…

## TypeScript 规范

- **严格模式**，所有类型必须显式声明，禁止 `any`
- 使用 `verbatimModuleSyntax`，类型导入必须加 `type` 关键字：
  ```ts
  import type { Foo } from './foo'
  ```
- 路径别名：`@/*` → `./src/*`（tsconfig paths + `vite-tsconfig-paths`）
- 禁止未使用的变量和参数（`noUnusedLocals` / `noUnusedParameters`）

## 重型依赖（动态导入）

以下库体积较大，**必须**使用动态 `import()` 按需加载，避免影响首屏：

```ts
// prettier（格式化 HTML/CSS）
const prettier = await import('prettier/standalone')
const parser = await import('prettier/plugins/...')

// sass（SCSS 编译）
const sass = await import('sass')
```

## 代码习惯

- 工具页面的状态管理抽成自定义 hook（如 `useTool()`）避免重复
- 异步操作需有 `loading` 状态，处理中按钮应设 `disabled`
- 错误信息格式：`操作描述失败：${(e as Error).message}`
- 中文 UI 文案，错误/提示信息使用简体中文

## 脚本

```bash
bun dev        # 启动开发服务器（portless HTTPS + Vite）
bun build      # 生产构建
bun test       # 运行测试（Vitest）
```
