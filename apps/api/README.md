# Tools API

Cloudflare Pages Functions + Hono + D1。路由类型通过 `AppType` 暴露，可用
`@tools/api/client` 的 `createApiClient()` 获得 Hono RPC 客户端。

## 本地运行

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
bun db:migrate:local
bun dev:api
```

API 路径统一以 `/api` 开头，本地 GitHub OAuth callback URL 为
`http://localhost:8787/api/auth/github/callback`。

## Cloudflare Pages 部署

Pages 构建设置：

```text
Root directory: 留空（仓库根目录）
Build command: bun run build
Build output directory: apps/web/dist
```

```bash
bunx wrangler d1 create tools-db
# 将返回的 database_id 写入 apps/api/wrangler.jsonc
bun db:migrate:remote
```

在 Pages 项目的 Bindings 中将 D1 数据库以 `DB` 为变量名绑定，并配置：

```text
APP_ORIGIN=https://spring-breeze-tools.pages.dev
GITHUB_CALLBACK_URL=https://spring-breeze-tools.pages.dev/api/auth/github/callback
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

GitHub OAuth App 的 callback URL 必须与 `GITHUB_CALLBACK_URL` 完全一致。
生产环境默认使用当前域名，不需要配置 `VITE_API_URL`。
