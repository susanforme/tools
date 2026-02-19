# AGENTS.md — Dev Tools 项目索引

供 AI 编码 Agent 使用的项目规范文档。本文件综合自
`.github/copilot-instructions.md` 及代码库实际分析。

---

## 技术栈

| 层面       | 技术                                         |
| ---------- | -------------------------------------------- |
| 语言       | TypeScript 5.7（严格模式）                   |
| UI 框架    | React 19                                     |
| 全栈框架   | TanStack Start（`@tanstack/react-start`）    |
| 路由       | TanStack Router v1.132（文件系统路由）       |
| 样式       | Tailwind CSS v4 + shadcn/ui（New York 风格） |
| 代码编辑器 | Monaco Editor（`@monaco-editor/react`）      |
| 国际化     | i18next + react-i18next（中/英双语）         |
| 构建工具   | Vite 7                                       |
| 包管理器   | Bun                                          |
| 测试框架   | Vitest 3 + @testing-library/react            |
| 开发代理   | portless（HTTPS）                            |

---

## 目录结构

```
src/
├── router.tsx              # createRouter 配置
├── routeTree.gen.ts        # 自动生成，禁止手动编辑
├── start.ts                # TanStack Start 入口
├── styles.css              # 全局样式（Tailwind v4 @import + CSS 变量）
├── components/
│   ├── code-panel.tsx      # 通用输入/输出双栏 Monaco 面板
│   ├── lang-switcher.tsx   # 语言切换组件
│   └── ui/                 # shadcn 组件（禁止直接修改结构）
├── i18n/
│   ├── index.ts            # i18next 初始化
│   └── locales/
│       ├── en.ts           # 英文翻译
│       └── zh.ts           # 中文翻译
├── lib/
│   └── utils.ts            # cn() 工具函数（clsx + tailwind-merge）
└── routes/
    ├── __root.tsx          # 根布局（HTML shell）
    ├── -client.tsx         # 客户端根组件（导航栏 + TooltipProvider）
    ├── index.tsx           # 首页工具卡片列表
    └── *.tsx               # 各工具页面（一文件一路由）
```

---

## 构建 / 开发 / 测试命令

```bash
bun dev        # 启动开发服务器（portless HTTPS 代理 + Vite HMR）
bun build      # 生产构建（输出到 dist/）
bun preview    # 预览生产构建
bun test       # 运行所有测试（vitest run）
```

### 运行单个测试

```bash
# 运行单个测试文件
bun vitest run src/path/to/file.test.ts

# 按测试名称过滤（支持正则）
bun vitest run -t "测试名称关键词"

# 监听模式运行单个文件
bun vitest src/path/to/file.test.ts
```

> 注意：项目当前尚无测试文件，但 Vitest / @testing-library/react /
> jsdom 已完整配置。

### 格式化

项目使用 Prettier，无独立 lint 脚本。Prettier 通过
`prettier-plugin-organize-imports` 自动整理导入顺序。

---

## 路由规范

- 每个工具页面放在 `src/routes/` 下，**文件名即 URL 路径段**（`json.tsx` →
  `/json`）
- 每个路由文件必须以 `createFileRoute` 导出 `Route`：
  ```tsx
  export const Route = createFileRoute('/your-path')({ component: YourPage });
  ```
- **禁止手动修改** `src/routeTree.gen.ts`，由 `@tanstack/router-plugin` 自动生成
- 导航链接统一在 `src/routes/-client.tsx` 的 `<nav>` 中添加

---

## 新增工具页面模板

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/your-tool')({ component: YourToolPage });

function YourToolPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const process = () => {
    setError(null);
    try {
      // 处理逻辑
      setOutput(/* result */);
    } catch (e) {
      setError(`处理失败：${(e as Error).message}`);
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">工具名称</h1>
        <p className="text-muted-foreground text-sm mt-1">工具描述</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={process}>
          处理
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          清空
        </Button>
      </div>
      <CodePanel
        input={input}
        output={output}
        onInputChange={setInput}
        inputPlaceholder="在此粘贴内容..."
        error={error}
        language="plaintext"
      />
    </div>
  );
}
```

---

## CodePanel Props

公共双栏面板（基于 Monaco Editor）：

| Prop               | 类型                  | 说明                                          |
| ------------------ | --------------------- | --------------------------------------------- |
| `input`            | `string`              | 输入内容                                      |
| `output`           | `string`              | 输出内容（只读）                              |
| `onInputChange`    | `(v: string) => void` | 输入变更回调                                  |
| `inputPlaceholder` | `string?`             | 占位符（Monaco 中暂不生效）                   |
| `error`            | `string \| null?`     | 错误信息（红色提示条）                        |
| `language`         | `string?`             | Monaco 语言标识（`json` / `html` / `css` 等） |
| `outputLanguage`   | `string?`             | 输出面板单独语言，默认同 `language`           |

---

## TypeScript 规范

- **严格模式**，禁止 `any`，所有类型必须显式声明
- `verbatimModuleSyntax` 启用，类型导入必须使用 `type` 关键字：
  ```ts
  import type { Foo } from './foo';
  // 或行内
  import { cva, type VariantProps } from 'class-variance-authority';
  ```
- 路径别名：`@/*` → `./src/*`（tsconfig paths + vite-tsconfig-paths）
- 禁止未使用的变量和参数（`noUnusedLocals` / `noUnusedParameters`）
- 用 `as const` 收窄字面量数组类型：
  ```ts
  const TABS = ['params', 'headers', 'body'] as const;
  type Tab = (typeof TABS)[number];
  ```
- 使用 `string | null` 表示"无"状态（不用 `undefined`）
- 错误类型断言：`(e as Error).message`（禁止 `any`）

---

## 命名规范

| 类型          | 规范                  | 示例                                        |
| ------------- | --------------------- | ------------------------------------------- |
| React 组件    | PascalCase            | `JsonPage`、`CodePanel`、`HashPage`         |
| 普通函数      | camelCase             | `formatCss`、`computeAllHashes`、`bufToHex` |
| 自定义 Hook   | camelCase，`use` 前缀 | `useTool`                                   |
| 常量/配置数组 | UPPER_SNAKE_CASE      | `HASH_LABELS`、`ALG_OPTIONS`、`TABS`        |
| 类型 / 接口   | PascalCase            | `HashResult`、`JwtDecoded`、`KVPair`        |
| 文件名        | kebab-case            | `code-panel.tsx`、`http-request.tsx`        |
| CSS 变量      | kebab-case            | `--color-background`、`--muted-foreground`  |
| i18n key      | camelCase 嵌套        | `'json.formatError'`、`'hash.computing'`    |

---

## 导入风格

```ts
// 外部库：命名导入或默认导入
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// 类型导入：必须用 import type
import type { Foo } from './foo';

// 内部组件：相对路径
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';

// shadcn 内部：使用 @/* 别名
import { cn } from '@/lib/utils';

// 大型依赖：动态导入（必须）
const prettier = await import('prettier/standalone');
const sass = await import('sass');
const CryptoJS = (await import('crypto-js')).default;
```

> `prettier-plugin-organize-imports` 会自动排序导入，无需手动维护顺序。

---

## 错误处理规范

```ts
// 同步错误
const process = () => {
  setError(null);
  try {
    setOutput(doWork(input));
  } catch (e) {
    setError(`操作描述失败：${(e as Error).message}`);
  }
};

// 异步错误（需 loading 状态）
const processAsync = async () => {
  setLoading(true);
  setError(null);
  try {
    setOutput(await doAsyncWork(input));
  } catch (e) {
    setError(`操作描述失败：${(e as Error).message}`);
  } finally {
    setLoading(false);
  }
};
```

错误 UI 展示：

```tsx
{
  error && (
    <div className="text-destructive text-sm bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
      {error}
    </div>
  );
}
```

---

## 样式规范

- 使用 Tailwind CSS v4 原子类，**不要**写内联 `style` 或额外 CSS 文件
- 颜色使用语义化 token：`text-foreground`、`text-muted-foreground`、`bg-background`、`text-destructive`
- 响应式布局优先使用 `md:` 前缀
- 图标使用 `lucide-react`，尺寸统一：`w-4 h-4` / `w-5 h-5` / `w-8 h-8`
- 禁止修改 `src/components/ui/` 下 shadcn 组件的源码结构

---

## 代码格式（Prettier）

```json
{
  "semi": true,
  "tabWidth": 2,
  "singleQuote": true,
  "printWidth": 80,
  "trailingComma": "all",
  "proseWrap": "always"
}
```

> shadcn 生成的组件文件可能使用双引号，保持原样即可。

---

## 注释风格

- **中文注释**为主，英文用于纯逻辑说明
- 视觉分隔符用于复杂文件的区块分割：
  ```ts
  // ─── shared types ─────────────────────────────────────────────────
  // ─── helpers ──────────────────────────────────────────────────────
  // ─── components ───────────────────────────────────────────────────
  ```
- JSX 中使用中文注释：`{/* 格式化工具 */}`

---

## 重型依赖（动态导入）

以下库体积大，**必须**使用 `await import()` 按需加载：

| 库                              | 用途                                |
| ------------------------------- | ----------------------------------- |
| `prettier/standalone` + plugins | 格式化 HTML/CSS/JS                  |
| `sass`                          | 编译 SCSS                           |
| `crypto-js`                     | AES/DES 等加密                      |
| `@monaco-editor/react`          | 代码编辑器（已在 CodePanel 内处理） |

---

## UI 文案规范

- 所有用户可见文案使用**简体中文**
- 错误/提示信息格式：`操作描述失败：${(e as Error).message}`
- 新工具的翻译 key 需同时添加到 `src/i18n/locales/zh.ts` 和
  `src/i18n/locales/en.ts`
