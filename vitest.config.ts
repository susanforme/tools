import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // GraphQL 的 schema 与 Inspector 必须使用同一模块实例。
    server: { deps: { inline: ['graphql', '@graphql-inspector/core'] } },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) },
  },
});
