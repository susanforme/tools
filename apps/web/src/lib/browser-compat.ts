import type { Feature, PackedFeature } from 'caniuse-lite';
import {
  COMPAT_DATA_DATE,
  COMPAT_DATA_VERSION,
  COMPAT_FEATURES,
} from './browser-compat-catalog';
export interface CompatRequest {
  query: string;
  feature: string;
}
export interface CompatResult {
  coverage: number;
  version: string;
  date: string;
  feature: string;
  title: string;
  rows: {
    browser: string;
    version: string;
    coverage: number;
    flags: string;
    status: 'supported' | 'partial' | 'unsupported' | 'unknown';
  }[];
}
export function supportStatus(
  flags: string,
): CompatResult['rows'][number]['status'] {
  const parts = flags.split(' ');
  if (
    parts.includes('a') ||
    (parts.includes('y') && (parts.includes('x') || parts.includes('d')))
  )
    return 'partial';
  if (parts.includes('y')) return 'supported';
  if (parts.includes('n') || parts.includes('p')) return 'unsupported';
  return 'unknown';
}
export async function analyzeCompatibility(
  request: CompatRequest,
  loadFeature?: (id: string) => Promise<Feature>,
): Promise<CompatResult> {
  if (request.query.length > 2000 || request.query.split(/[,\n]/).length > 40)
    throw new Error('LIMIT');
  if (
    /\b(node|electron|extends|supports)\b/i.test(request.query) ||
    /\bin\s+(?:[a-z]{2}|my\s+stats)\b/i.test(request.query)
  )
    throw new Error('QUERY_UNSUPPORTED');
  const entry = COMPAT_FEATURES.find((item) => item.id === request.feature);
  if (!entry) throw new Error('FEATURE');
  const { default: browserslist } = await import('browserslist');
  const targets = browserslist(request.query || 'defaults', {
    path: false,
    ignoreUnknownVersions: false,
  });
  if (targets.length > 1000) throw new Error('LIMIT');
  let feature: Feature;
  if (loadFeature) feature = await loadFeature(entry.id);
  else {
    const url = `https://cdn.jsdelivr.net/npm/caniuse-lite@${COMPAT_DATA_VERSION}/data/features/${entry.id}.js/+esm`;
    const [packed, unpacker] = await Promise.all([
      import(/* @vite-ignore */ url) as Promise<{ default: PackedFeature }>,
      import('caniuse-lite/dist/unpacker/feature'),
    ]);
    feature = unpacker.default(packed.default);
  }
  return {
    version: COMPAT_DATA_VERSION,
    date: COMPAT_DATA_DATE,
    coverage: browserslist.coverage(targets),
    feature: entry.id,
    title: feature.title,
    rows: targets.map((target) => {
      const [browser, version] = target.split(' ') as [string, string];
      const flags = feature.stats[browser]?.[version] ?? 'u';
      return {
        browser,
        version,
        coverage: browserslist.coverage([target]),
        flags,
        status: supportStatus(flags),
      };
    }),
  };
}
