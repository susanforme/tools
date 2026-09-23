import type { WorkbenchTool } from '@/components/multi-tool-workbench';

const json = (value: unknown): string => JSON.stringify(value, null, 2);

export async function graphqlOutline(source: string) {
  if (source.length > 200_000) throw new Error('查询超过 200 KB');
  const { parse, visit } = await import('graphql');
  const ast = parse(source);
  let fields = 0;
  let aliases = 0;
  let maxDepth = 0;
  let depth = 0;
  let fragments = 0;
  visit(ast, {
    Field: {
      enter(node) {
        fields++;
        if (node.alias) aliases++;
        maxDepth = Math.max(maxDepth, ++depth);
      },
      leave() {
        depth--;
      },
    },
    FragmentSpread() {
      fragments++;
    },
  });
  return { fields, aliases, maxDepth, fragmentSpreads: fragments };
}

export function cacheAge(header: string, age: number, elapsed: number) {
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    !Number.isFinite(elapsed) ||
    elapsed < 0 ||
    !Number.isFinite(age + elapsed)
  )
    throw new Error('Age 和经过时间必须为非负数');
  const directives = new Map(
    header
      .toLowerCase()
      .split(',')
      .map((entry) => {
        const [name, value] = entry.trim().split('=');
        return [name?.trim(), value?.trim()] as const;
      }),
  );
  const seconds = (name: string) => {
    const value = directives.get(name);
    if (value === undefined) return 0;
    const parsed = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed))
      throw new Error(`${name} 无效`);
    return parsed;
  };
  const lifetime = directives.has('s-maxage')
    ? seconds('s-maxage')
    : seconds('max-age');
  const currentAge = age + elapsed;
  const revalidate = seconds('stale-while-revalidate');
  const onError = seconds('stale-if-error');
  const reusable = !directives.has('no-store') && !directives.has('no-cache');
  return {
    currentAgeSeconds: currentAge,
    freshForSeconds: Math.max(0, lifetime - currentAge),
    state: directives.has('no-store')
      ? 'no-store'
      : directives.has('no-cache')
        ? 'revalidate'
        : currentAge < lifetime
          ? 'fresh'
          : 'stale',
    sharedCache: directives.has('s-maxage'),
    staleWhileRevalidate:
      reusable && currentAge >= lifetime && currentAge < lifetime + revalidate,
    staleIfError:
      reusable && currentAge >= lifetime && currentAge < lifetime + onError,
  };
}

export function envReferences(source: string) {
  if (source.length > 200_000) throw new Error('输入超过 200 KB');
  const variables = new Map<string, string>();
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)=(.*)$/,
    );
    if (!match) throw new Error(`无效的 .env 行： ${line.slice(0, 80)}`);
    if (variables.has(match[1]!)) throw new Error(`变量重复： ${match[1]}`);
    variables.set(match[1]!, match[2]!);
  }
  const references = Object.fromEntries(
    [...variables].map(([key, value]) => [
      key,
      [
        ...new Set(
          [...value.matchAll(/\$\{([A-Za-z_][A-Za-z_0-9]*)\}/g)].map(
            (match) => match[1]!,
          ),
        ),
      ],
    ]),
  ) as Record<string, string[]>;
  const missing = [
    ...new Set(
      Object.values(references)
        .flat()
        .filter((key) => !variables.has(key)),
    ),
  ];
  const active = new Set<string>();
  const done = new Set<string>();
  const cycles = new Set<string>();
  const visit = (key: string): void => {
    if (active.has(key)) {
      cycles.add(key);
      return;
    }
    if (done.has(key)) return;
    active.add(key);
    references[key]?.filter((name) => variables.has(name)).forEach(visit);
    active.delete(key);
    done.add(key);
  };
  [...variables.keys()].forEach(visit);
  return {
    variables: variables.size,
    references,
    missing,
    cycles: [...cycles],
  };
}

export function npmScriptGraph(source: string) {
  const parsed: unknown = JSON.parse(source);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('package.json 无效');
  const scripts = (parsed as Record<string, unknown>).scripts;
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts))
    throw new Error('缺少 scripts');
  const entries = Object.entries(scripts);
  if (
    entries.length > 200 ||
    entries.some(([, value]) => typeof value !== 'string')
  )
    throw new Error('scripts 无效');
  const names = new Set(entries.map(([name]) => name));
  const dependencies = Object.fromEntries(
    entries.map(([name, command]) => [
      name,
      [
        ...(command as string).matchAll(
          /\b(?:npm|pnpm|bun)\s+run\s+([A-Za-z0-9_:][\w:.-]*)/g,
        ),
      ].map((match) => match[1]!),
    ]),
  ) as Record<string, string[]>;
  const missing = [
    ...new Set(
      Object.values(dependencies)
        .flat()
        .filter((key) => !names.has(key)),
    ),
  ];
  const active = new Set<string>();
  const done = new Set<string>();
  const cycles = new Set<string>();
  const visit = (key: string): void => {
    if (active.has(key)) {
      cycles.add(key);
      return;
    }
    if (done.has(key)) return;
    active.add(key);
    dependencies[key]?.filter((name) => names.has(name)).forEach(visit);
    active.delete(key);
    done.add(key);
  };
  [...names].forEach(visit);
  return {
    scripts: entries.length,
    dependencies,
    missing,
    cycles: [...cycles],
  };
}

export function packageExportsAudit(source: string) {
  const parsed: unknown = JSON.parse(source);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('package.json 无效');
  const exportsValue = (parsed as Record<string, unknown>).exports;
  if (exportsValue === undefined) throw new Error('缺少 exports');
  const targets: Array<{ condition: string; target: string }> = [];
  const invalid: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      targets.push({ condition: path, target: value });
      if (!value.startsWith('./') || value.includes('..')) invalid.push(path);
    } else if (value === null) {
      targets.push({ condition: path, target: 'blocked' });
    } else if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, entry]) =>
        visit(entry, `${path}.${key}`),
      );
    } else throw new Error(`无效的 exports 条目： ${path}`);
  };
  visit(exportsValue, 'exports');
  if (targets.length > 500) throw new Error('exports 条目过多');
  return { targets, invalidRelativeTargets: invalid };
}

export const DEVELOPER_AUDITS: readonly WorkbenchTool[] = [
  {
    id: 'graphqlOutline',
    fields: [
      {
        id: 'query',
        label: 'graphqlQuery',
        sample: 'query Me { viewer { id name } }',
      },
    ],
    run: async ({ query }) => ({
      output: json(await graphqlOutline(query ?? '')),
    }),
  },
  {
    id: 'cacheAge',
    fields: [
      {
        id: 'header',
        label: 'cacheHeader',
        sample: 'max-age=60, stale-while-revalidate=30',
      },
      { id: 'age', label: 'responseAge', kind: 'number', sample: '10' },
      { id: 'elapsed', label: 'elapsedSeconds', kind: 'number', sample: '20' },
    ],
    run: ({ header, age, elapsed }) => ({
      output: json(cacheAge(header ?? '', Number(age), Number(elapsed))),
    }),
  },
  {
    id: 'envReferences',
    fields: [
      {
        id: 'env',
        label: 'envInput',
        sample: 'API_URL=https://example.com\nSITE_URL=${API_URL}/site',
      },
    ],
    run: ({ env }) => ({ output: json(envReferences(env ?? '')) }),
  },
  {
    id: 'npmScriptGraph',
    fields: [
      {
        id: 'package',
        label: 'packageJson',
        sample:
          '{"scripts":{"build":"bun run typecheck && vite build","typecheck":"tsc --noEmit"}}',
      },
    ],
    run: ({ package: source }) => ({
      output: json(npmScriptGraph(source ?? '')),
    }),
  },
  {
    id: 'packageExportsAudit',
    fields: [
      {
        id: 'package',
        label: 'packageJson',
        sample:
          '{"exports":{".":{"import":"./dist/index.js","types":"./dist/index.d.ts"}}}',
      },
    ],
    run: ({ package: source }) => ({
      output: json(packageExportsAudit(source ?? '')),
    }),
  },
];
