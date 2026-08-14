import { db } from './db';

const pendingAssets = new Map<string, Promise<Blob>>();

async function fetchCachedCdnAsset(
  url: string,
  mimeType: string,
): Promise<Blob> {
  const cached = await db.binaryCache.get(url).catch(() => undefined);
  if (cached?.data.size) return cached.data;

  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`CDN_ASSET_FAILED:${response.status}`);
  }
  const source = await response.blob();
  const data =
    source.type === mimeType ? source : new Blob([source], { type: mimeType });
  await db.binaryCache
    .put({
      key: url,
      sourceUrl: url,
      mimeType,
      data,
      createdAt: Date.now(),
    })
    .catch(() => undefined);
  return data;
}

export function loadCachedCdnAsset(
  url: string,
  mimeType: string,
): Promise<Blob> {
  let pending = pendingAssets.get(url);
  if (!pending) {
    pending = fetchCachedCdnAsset(url, mimeType).finally(() =>
      pendingAssets.delete(url),
    );
    pendingAssets.set(url, pending);
  }
  return pending;
}

export async function loadCachedCdnAssetUrl(
  url: string,
  mimeType: string,
): Promise<string> {
  return URL.createObjectURL(await loadCachedCdnAsset(url, mimeType));
}

export async function loadCachedCdnAssetBuffer(
  url: string,
  mimeType = 'application/wasm',
): Promise<ArrayBuffer> {
  return (await loadCachedCdnAsset(url, mimeType)).arrayBuffer();
}

export async function importCachedCdnModule<T>(url: string): Promise<T> {
  const objectUrl = await loadCachedCdnAssetUrl(url, 'text/javascript');
  try {
    return (await import(/* @vite-ignore */ objectUrl)) as T;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
