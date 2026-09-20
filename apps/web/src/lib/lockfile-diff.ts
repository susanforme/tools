export type LockfileFormat = 'bun' | 'pnpm' | 'npm';
export type LockedPackage = { name: string; version: string; locator: string };
export type LockInventory = {
  packages: LockedPackage[];
  declared: string[];
  excluded: number;
};
export type LockChange = {
  name: string;
  status: 'added' | 'removed' | 'upgraded' | 'downgraded' | 'changed';
  declared: boolean;
  before: LockedPackage[];
  after: LockedPackage[];
};
export type LockfileResult = {
  changes: LockChange[];
  beforeCount: number;
  afterCount: number;
  excluded: number;
};
export type LockfileRequest = {
  before: string;
  after: string;
  format: LockfileFormat;
};
export const LOCKFILE_LIMIT = 5 * 1024 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function mapping(value: unknown): Record<string, unknown> {
  if (!record(value)) throw new Error('INVALID_STRUCTURE');
  return value;
}
const EXTERNAL =
  /^(?:workspace:|link:|file:|https?:|git(?:\+|:)|github:|gitlab:|bitbucket:)/;
const NAME = /^(?:@[\w.-]+\/)?[\w.-]+$/;

export async function parseLockfile(
  text: string,
  format: LockfileFormat,
): Promise<LockInventory> {
  if (new TextEncoder().encode(text).byteLength > LOCKFILE_LIMIT)
    throw new Error('FILE_TOO_LARGE');
  const semver = await import('semver');
  let data: unknown;
  if (format === 'pnpm') {
    const yaml = await import('js-yaml');
    data = yaml.load(text, { schema: yaml.JSON_SCHEMA });
  } else if (format === 'bun') {
    const jsonc = await import('jsonc-parser');
    const errors: import('jsonc-parser').ParseError[] = [];
    data = jsonc.parse(text, errors, { allowTrailingComma: true });
    if (errors.length) throw new Error(`INVALID_JSON:${errors[0].offset}`);
  } else data = JSON.parse(text) as unknown;
  const root = mapping(data);
  const packages = mapping(root.packages ?? (format === 'pnpm' ? {} : null));
  const result: LockInventory = { packages: [], declared: [], excluded: 0 };
  const declared = new Set<string>();
  const addDeclared = (value: unknown): void => {
    const manifest = mapping(value);
    for (const kind of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
    ]) {
      if (manifest[kind] === undefined) continue;
      for (const name of Object.keys(mapping(manifest[kind])))
        declared.add(name);
    }
  };
  const add = (name: string, version: unknown, locator: string): void => {
    if (!NAME.test(name) || typeof version !== 'string')
      throw new Error(`INVALID_PACKAGE:${locator}`);
    if (EXTERNAL.test(version)) {
      result.excluded++;
      return;
    }
    const normalized = semver.valid(version);
    if (!normalized) throw new Error(`INVALID_VERSION:${locator}`);
    result.packages.push({ name, version: normalized, locator });
    if (result.packages.length > 50_000) throw new Error('PACKAGE_LIMIT');
  };
  if (format === 'npm') {
    if (root.lockfileVersion !== 2 && root.lockfileVersion !== 3)
      throw new Error('UNSUPPORTED_VERSION');
    for (const [locator, raw] of Object.entries(packages)) {
      const entry = mapping(raw);
      if (!locator.includes('node_modules/')) {
        addDeclared(entry);
        continue;
      }
      if (entry.link === true) {
        result.excluded++;
        continue;
      }
      const name =
        typeof entry.name === 'string'
          ? entry.name
          : locator.slice(locator.lastIndexOf('node_modules/') + 13);
      add(name, entry.version, locator);
    }
  } else if (format === 'bun') {
    if (root.lockfileVersion !== 0 && root.lockfileVersion !== 1)
      throw new Error('UNSUPPORTED_VERSION');
    for (const manifest of Object.values(mapping(root.workspaces)))
      addDeclared(manifest);
    for (const [locator, raw] of Object.entries(packages)) {
      if (!Array.isArray(raw) || typeof raw[0] !== 'string')
        throw new Error(`INVALID_PACKAGE:${locator}`);
      const separator = raw[0].indexOf('@', 1);
      if (separator < 1) throw new Error(`INVALID_PACKAGE:${locator}`);
      add(raw[0].slice(0, separator), raw[0].slice(separator + 1), locator);
    }
  } else {
    if (!/^(?:6|9)(?:\.\d+)?$/.test(String(root.lockfileVersion)))
      throw new Error('UNSUPPORTED_VERSION');
    if (
      root.importers === undefined &&
      String(root.lockfileVersion).startsWith('6')
    )
      addDeclared(root);
    else
      for (const manifest of Object.values(mapping(root.importers)))
        addDeclared(manifest);
    // v9 的 snapshot 保留 peer 变体；不把同一包的多版本覆盖成一个版本。
    const snapshots =
      root.snapshots === undefined ? packages : mapping(root.snapshots);
    for (const [locator, raw] of Object.entries(snapshots)) {
      mapping(raw);
      const ref = locator.replace(/^\//, '');
      if (EXTERNAL.test(ref)) {
        result.excluded++;
        continue;
      }
      const separator = ref.indexOf('@', 1);
      if (separator < 1) throw new Error(`INVALID_PACKAGE:${locator}`);
      const name = ref.slice(0, separator);
      const version = ref.slice(separator + 1).split('(')[0];
      if (version.startsWith('file:')) {
        result.excluded++;
        continue;
      }
      add(name, version, locator);
    }
  }
  result.declared = [...declared];
  return result;
}

export async function compareLockfiles(
  request: LockfileRequest,
): Promise<LockfileResult> {
  const [before, after, semver] = await Promise.all([
    parseLockfile(request.before, request.format),
    parseLockfile(request.after, request.format),
    import('semver'),
  ]);
  const groups = (items: LockedPackage[]): Map<string, LockedPackage[]> => {
    const grouped = new Map<string, LockedPackage[]>();
    for (const item of items) {
      const entries = grouped.get(item.name) ?? [];
      entries.push(item);
      grouped.set(item.name, entries);
    }
    return grouped;
  };
  const oldGroups = groups(before.packages);
  const newGroups = groups(after.packages);
  const declared = new Set([...before.declared, ...after.declared]);
  const changes: LockChange[] = [];
  for (const name of [
    ...new Set([...oldGroups.keys(), ...newGroups.keys()]),
  ].sort()) {
    const previous = oldGroups.get(name) ?? [];
    const next = newGroups.get(name) ?? [];
    const signature = (entries: LockedPackage[]): string =>
      JSON.stringify(
        entries
          .map(({ locator, version }) => [locator, version])
          .sort(([a], [b]) => a.localeCompare(b)),
      );
    if (signature(previous) === signature(next)) continue;
    let status: LockChange['status'] = !previous.length
      ? 'added'
      : !next.length
        ? 'removed'
        : 'changed';
    if (previous.length && next.length) {
      const oldVersions = new Set(previous.map((entry) => entry.version));
      const newVersions = new Set(next.map((entry) => entry.version));
      const removed = [...oldVersions].filter(
        (version) => !newVersions.has(version),
      );
      const added = [...newVersions].filter(
        (version) => !oldVersions.has(version),
      );
      // ponytail: 仅一对变化版本判断升降级；多版本变化展示完整集合，不猜依赖迁移路径。
      if (removed.length === 1 && added.length === 1) {
        const order = semver.compare(added[0], removed[0]);
        status = order > 0 ? 'upgraded' : order < 0 ? 'downgraded' : 'changed';
      }
    }
    changes.push({
      name,
      status,
      declared: declared.has(name),
      before: previous,
      after: next,
    });
  }
  return {
    changes,
    beforeCount: before.packages.length,
    afterCount: after.packages.length,
    excluded: before.excluded + after.excluded,
  };
}
