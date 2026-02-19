# 项目索引

## 项目类型

TanStack Start（基于 React 的 SSR 全栈框架）

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | TanStack Start + TanStack Router v1.132 |
| UI | React 19 + Tailwind CSS v4 + shadcn/ui (radix-ui) |
| 构建 | Vite 7 + TypeScript 5.7 |
| 运行时 | Bun |
| 测试 | Vitest + Testing Library |
| 开发代理 | portless（HTTPS） |

## 目录结构

```
src/
├── router.tsx          # 路由器配置（TanStack Router）
├── routeTree.gen.ts    # 自动生成的路由树
├── styles.css          # 全局样式（Tailwind）
├── components/
│   └── ui/button.tsx   # shadcn Button 组件
├── lib/utils.ts        # 工具函数（cn）
└── routes/
    ├── __root.tsx      # 根布局（HTML shell + DevTools）
    └── index.tsx       # 首页（功能展示页）
```

## 路由

| 路径 | 文件 | 说明 |
|------|------|------|
| `/` | `src/routes/index.tsx` | 首页，展示 6 个 TanStack Start 特性卡片 |

## 脚本

| 命令 | 说明 |
|------|------|
| `bun dev` | 启动开发服务器（portless HTTPS 代理 + Vite） |
| `bun build` | 生产构建 |
| `bun preview` | 预览生产构建 |
| `bun test` | 运行测试（Vitest） |

## 依赖概览

### 生产依赖

- `@tanstack/react-router` — 文件系统路由
- `@tanstack/react-start` — SSR 全栈框架
- `tailwindcss` + `@tailwindcss/vite` — 原子化 CSS
- `radix-ui` — 无障碍 UI 原语
- `lucide-react` — 图标库
- `class-variance-authority` + `clsx` + `tailwind-merge` — 样式工具

### 开发依赖

- `vite` + `@vitejs/plugin-react` — 构建工具
- `typescript` — 类型系统
- `vitest` + `@testing-library/react` — 单元测试
- `shadcn` — UI 组件生成器
- `portless` — HTTPS 本地代理
