import app from '../../apps/api/src/index';
import { handle } from 'hono/cloudflare-pages';

export const onRequest = handle(app);
