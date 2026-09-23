import type { WorkbenchTool } from '@/components/multi-tool-workbench';
import yaml from 'js-yaml';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createMergePatch(before: unknown, after: unknown): unknown {
  if (!record(after)) return after;
  const source = record(before) ? before : {};
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(source)) if (!(key in after)) patch[key] = null;
  for (const [key, value] of Object.entries(after)) {
    if (key in source && JSON.stringify(source[key]) === JSON.stringify(value))
      continue;
    if (value === null)
      throw new Error('JSON Merge Patch cannot set an object property to null');
    if (!(key in source)) patch[key] = createMergePatch(undefined, value);
    else {
      const diff = createMergePatch(source[key], value);
      if (
        !record(source[key]) ||
        !record(value) ||
        !record(diff) ||
        Object.keys(diff).length
      )
        patch[key] = diff;
    }
  }
  return patch;
}

export function inspectComposeGraph(source: string): Record<string, unknown> {
  const parsed: unknown = yaml.load(source);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('Invalid Compose document');
  const services = (parsed as Record<string, unknown>).services;
  if (!services || typeof services !== 'object' || Array.isArray(services))
    throw new Error('Missing services');
  const names = Object.keys(services);
  if (names.length > 100) throw new Error('Too many services');
  const dependencies = Object.fromEntries(
    names.map((name) => {
      const value = (services as Record<string, unknown>)[name];
      const depends =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>).depends_on
          : null;
      return [
        name,
        Array.isArray(depends)
          ? depends.filter((item): item is string => typeof item === 'string')
          : depends && typeof depends === 'object'
            ? Object.keys(depends)
            : [],
      ];
    }),
  ) as Record<string, string[]>;
  const order: string[] = [];
  const active = new Set<string>();
  const done = new Set<string>();
  const visit = (name: string): void => {
    if (!(name in dependencies)) throw new Error(`Unknown service: ${name}`);
    if (active.has(name)) throw new Error(`Dependency cycle: ${name}`);
    if (done.has(name)) return;
    active.add(name);
    for (const dependency of dependencies[name]!) visit(dependency);
    active.delete(name);
    done.add(name);
    order.push(name);
  };
  names.forEach(visit);
  return { services: names.length, dependencies, startupOrder: order };
}

export function buildCampaignUrl(
  base: string,
  source: string,
  medium: string,
  campaign: string,
): string {
  const url = new URL(base.trim());
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error('HTTP/HTTPS URL required');
  for (const [key, value] of [
    ['utm_source', source],
    ['utm_medium', medium],
    ['utm_campaign', campaign],
  ]) {
    if (value.trim()) url.searchParams.set(key, value.trim());
  }
  return url.toString();
}

export function canonicalizeUrl(input: string): string {
  const url = new URL(input.trim());
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error('HTTP/HTTPS URL required');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (
      /^utm_/i.test(key) ||
      ['gclid', 'fbclid', 'msclkid'].includes(key.toLowerCase())
    )
      url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export function retrySchedule(
  baseSeconds: number,
  attempts: number,
  capSeconds: number,
): Array<Record<string, number>> {
  if (
    !Number.isFinite(baseSeconds) ||
    baseSeconds <= 0 ||
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > 20 ||
    !Number.isFinite(capSeconds) ||
    capSeconds < baseSeconds ||
    capSeconds > 86_400
  )
    throw new Error('Invalid retry settings');
  let elapsed = 0;
  return Array.from({ length: attempts }, (_, index) => {
    const delaySeconds = Math.min(capSeconds, baseSeconds * 2 ** index);
    elapsed += delaySeconds;
    return {
      attempt: index + 1,
      delaySeconds,
      elapsedSeconds: elapsed,
      jitterMinSeconds: Number((delaySeconds * 0.8).toFixed(2)),
      jitterMaxSeconds: Number((delaySeconds * 1.2).toFixed(2)),
    };
  });
}

const json = (value: unknown): string => JSON.stringify(value, null, 2);

export const DEVELOPER_TOOLS: readonly WorkbenchTool[] = [
  {
    id: 'mergePatch',
    fields: [
      { id: 'before', label: 'beforeJson', sample: '{"name":"A","count":1}' },
      {
        id: 'after',
        label: 'afterJson',
        sample: '{"name":"B","count":1,"active":true}',
      },
    ],
    run: ({ before, after }) => ({
      output: json(
        createMergePatch(JSON.parse(before ?? ''), JSON.parse(after ?? '')),
      ),
    }),
  },
  {
    id: 'urlCanonical',
    fields: [
      {
        id: 'url',
        label: 'trackedUrl',
        sample: 'https://example.com/offer?utm_source=mail&b=2&a=1#section',
      },
    ],
    run: ({ url }) => ({ output: canonicalizeUrl(url ?? '') }),
  },
  {
    id: 'retrySchedule',
    fields: [
      { id: 'base', label: 'baseDelay', kind: 'number', sample: '2' },
      { id: 'attempts', label: 'attemptCount', kind: 'number', sample: '5' },
      { id: 'cap', label: 'maximumDelay', kind: 'number', sample: '60' },
    ],
    run: ({ base, attempts, cap }) => ({
      output: json(retrySchedule(Number(base), Number(attempts), Number(cap))),
    }),
  },
  {
    id: 'composeGraph',
    fields: [
      {
        id: 'source',
        label: 'composeYaml',
        sample:
          'services:\n  web:\n    image: nginx\n    depends_on: [api]\n  api:\n    image: node',
      },
    ],
    run: ({ source }) => ({ output: json(inspectComposeGraph(source ?? '')) }),
  },
  {
    id: 'campaignUrl',
    fields: [
      {
        id: 'base',
        label: 'baseUrl',
        sample: 'https://example.com/offer?lang=zh',
      },
      { id: 'source', label: 'utmSource', sample: 'newsletter' },
      { id: 'medium', label: 'utmMedium', sample: 'email' },
      { id: 'campaign', label: 'utmCampaign', sample: 'autumn' },
    ],
    run: ({ base, source, medium, campaign }) => ({
      output: buildCampaignUrl(
        base ?? '',
        source ?? '',
        medium ?? '',
        campaign ?? '',
      ),
    }),
  },
];
