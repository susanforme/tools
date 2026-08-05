import { hc, type InferResponseType } from 'hono/client';
import type { AppType } from './index';

export function createApiClient(baseUrl: string) {
  return hc<AppType>(baseUrl, {
    init: { credentials: 'include' },
  }).api;
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type AuthUser = InferResponseType<
  ApiClient['auth']['me']['$get'],
  200
>['user'];
