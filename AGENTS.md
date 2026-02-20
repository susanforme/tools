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
├── hooks/
│   └── useQueryParams.ts   # URL query 状态同步 Hook（见下方规范）
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

## 组件

如果组件在本地不存在，可以查询 [shadcn/ui](https://ui.shadcn.com/)
是否有现成组件可用，**必须**使用 shadcn 组件库提供的组件来保持 UI 风格一致。

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

## URL 状态管理（useQueryParams）

**核心原则：凡是用户可能想分享或刷新后复现的状态，必须用 `useQueryParam` /
`useQueryParams` 而非 `useState`。**

### 必须使用 useQueryParam 的场景

| 状态类型           | 示例                      | 理由                       |
| ------------------ | ------------------------- | -------------------------- |
| 当前激活的 Tab     | `'format' \| 'minify'`    | 刷新/分享后保持选中 tab    |
| 模式 / 算法选择    | `'aes' \| 'des' \| 'rc4'` | 用户选择的处理模式可被分享 |
| 编码方向           | `'encode' \| 'decode'`    | 操作方向应反映在 URL 中    |
| 数字选项（进制等） | `16 \| 10 \| 2`           | 可序列化为 query param     |
| 多选过滤项         | `string[]`                | 当前勾选的选项集合         |

**不需要** `useQueryParam`
的场景：输入框内容、输出结果、loading 状态、临时错误信息——这些属于纯 UI 临时状态，用
`useState` 即可。

### 导入

```ts
import {
  StringParam,
  NumberParam,
  ArrayParam,
  useQueryParam,
  useQueryParams,
} from '@/hooks/useQueryParams';
```

### useQueryParam — 单个参数

```ts
// 带默认值（返回 T，不含 null/undefined）
const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'format');

// 无默认值（返回 T | null | undefined）
const [keyword, setKeyword] = useQueryParam('q', StringParam);
```

**Tab 切换标准写法**（参考 `src/routes/html.tsx`）：

```tsx
type TabType = 'format' | 'minify';

const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'format');

<Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
  <TabsTrigger value="format">格式化</TabsTrigger>
  <TabsTrigger value="minify">压缩</TabsTrigger>
</Tabs>;
```

### useQueryParams — 批量参数

当同一页面有多个可分享状态时，用 `useQueryParams` 批量管理，避免多次调用
`useQueryParam`：

```ts
type PageState = { tab: string; algo: string; bits: number };

const [query, setQuery] = useQueryParams<PageState>({
  tab: StringParam,
  algo: StringParam,
  bits: NumberParam,
});

// 读取
const { tab, algo, bits } = query;

// 更新单个字段（其他字段保留）
setQuery({ tab: 'decode' });

// 函数式更新
setQuery((prev) => ({ ...prev, bits: 256 }));
```

### 内置 Param 配置

| 配置          | 类型       | 适用场景                         |
| ------------- | ---------- | -------------------------------- |
| `StringParam` | `string`   | Tab、模式、算法名、编码方向      |
| `NumberParam` | `number`   | 数字选项（进制、位数、缩进量等） |
| `ArrayParam`  | `string[]` | 多选过滤、多值列表               |

### withDefault 高阶函数

当需要给现有配置附加默认值时使用（`useQueryParam`
第三参数已内置此逻辑，通常无需单独调用）：

```ts
import { withDefault, StringParam } from '@/hooks/useQueryParams';

const AlgoParam = withDefault(StringParam, 'aes');
const [algo] = useQueryParam('algo', AlgoParam);
// algo 的类型是 string，且永远不为 null/undefined
```

### UpdateType（历史记录策略）

`setValue` 第二参数（默认 `'replaceIn'`）：

| 值          | 行为                                              |
| ----------- | ------------------------------------------------- |
| `replaceIn` | 替换当前历史记录，保留其他 query 参数（**默认**） |
| `pushIn`    | 新增历史记录，保留其他 query 参数                 |
| `replace`   | 替换当前历史记录，清空其他 query 参数             |
| `push`      | 新增历史记录，清空其他 query 参数                 |

```ts
// Tab 切换通常不需要浏览器"后退"，使用默认 replaceIn 即可
setTab('minify');

// 需要支持后退导航时
setTab('minify', 'pushIn');
```

## 新增工具页面模板

```tsx
import { StringParam, useQueryParam } from '@/hooks/useQueryParams';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { CodePanel } from '../components/code-panel';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/your-tool')({ component: YourToolPage });

// 有多个 tab 时，用字面量联合类型约束
type TabType = 'tabA' | 'tabB';

function YourToolPage() {
  // ✅ 必须：tab 等可分享状态用 useQueryParam，而非 useState
  const [tab, setTab] = useQueryParam<TabType>('tab', StringParam, 'tabA');

  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const process = () => {
    setError(null);
    try {
      // 处理逻辑
      setOutput(/* result */ '');
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

## 图标库规范

项目使用两套图标库，适用场景不同：

### 1. lucide-react（UI 功能图标）

用于按钮、操作、状态等通用 UI 图标，颜色跟随 Tailwind 语义 token。

```tsx
import { Copy, Check, RefreshCw } from 'lucide-react';

<Copy className="w-4 h-4 text-muted-foreground" />
<Check className="w-4 h-4 text-green-500" />
```

### 2. @iconify/react + @iconify-json/simple-icons（品牌 / 第三方图标）

用于展示浏览器、操作系统、技术品牌等有专属颜色的图标。

**安装（已完成，无需重复）：**

```bash
bun add @iconify/react @iconify-json/simple-icons
```

**基本用法：**

```tsx
import { Icon } from '@iconify/react';

// icon 格式："{集合}:{slug}"
<Icon
  icon="simple-icons:googlechrome"
  width={20}
  height={20}
  style={{ color: '#4285F4' }}
/>;
```

**品牌色通过 `style={{ color }}`
传入**（不用 Tailwind 颜色类，因为是动态品牌色）。

**查表模式（推荐）：**

```tsx
// 定义映射表
const BROWSER_ICON_MAP: Array<{ match: string; icon: string; color: string }> =
  [
    { match: 'chrome', icon: 'simple-icons:googlechrome', color: '#4285F4' },
    { match: 'firefox', icon: 'simple-icons:firefoxbrowser', color: '#FF7139' },
    { match: 'safari', icon: 'simple-icons:safari', color: '#006CFF' },
    { match: 'edge', icon: 'simple-icons:microsoftedge', color: '#0078D4' },
  ];

// 组件：匹配 → 渲染，未识别兜底字母徽章
function BrowserIcon({ name }: { name: string }) {
  const entry = BROWSER_ICON_MAP.find(({ match }) =>
    name.toLowerCase().includes(match),
  );
  if (entry) {
    return (
      <Icon
        icon={entry.icon}
        width={20}
        height={20}
        style={{ color: entry.color }}
        className="shrink-0"
      />
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-muted-foreground/30 flex items-center justify-center text-foreground text-[10px] font-bold shrink-0">
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
```

**已确认可用的 Simple Icons slug：**

| 品牌              | slug               | 品牌色    |
| ----------------- | ------------------ | --------- |
| Google Chrome     | `googlechrome`     | `#4285F4` |
| Firefox           | `firefoxbrowser`   | `#FF7139` |
| Safari            | `safari`           | `#006CFF` |
| Microsoft Edge    | `microsoftedge`    | `#0078D4` |
| Opera             | `opera`            | `#FF1B2D` |
| Internet Explorer | `internetexplorer` | `#0076D6` |
| Samsung           | `samsung`          | `#1428A0` |
| Yandex            | `yandexcloud`      | `#FC3F1D` |
| Windows           | `windows`          | `#0078D4` |
| macOS             | `macos`            | `#555555` |
| Apple (iOS)       | `apple`            | `#555555` |
| Android           | `android`          | `#3DDC84` |
| Ubuntu            | `ubuntu`           | `#E95420` |
| Fedora            | `fedora`           | `#294172` |
| Debian            | `debian`           | `#A81D33` |
| Linux             | `linux`            | `#FCC624` |

> 注意：`samsunginternet`、`yandexbrowser`、`ucbrowser`、`chromeos` 等 slug
> **不存在**，需用替代 slug 或字母徽章兜底。

**尺寸建议：** 行内图标用 `width={16} height={16}`，卡片/列表图标用
`width={20} height={20}`，大型展示用 `width={32} height={32}`。

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
