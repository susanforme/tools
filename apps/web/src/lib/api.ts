import { createApiClient } from '@tools/api/client';

export const API_URL = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8787' : '')
).replace(/\/$/, '');

export const api = createApiClient(API_URL);
