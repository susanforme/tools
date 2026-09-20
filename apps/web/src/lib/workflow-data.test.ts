import { expect, test } from 'vitest';
import { compareLockfiles, parseLockfile } from './lockfile-diff';
import { transformJsonata } from './jsonata-transform';

const npmLock = (packages: Record<string, unknown>): string =>
  JSON.stringify({
    lockfileVersion: 3,
    packages: { '': { dependencies: { demo: '^1.0.0' } }, ...packages },
  });

test('compares resolved versions and preserves transitive duplicate versions and locators', async () => {
  const result = await compareLockfiles({
    format: 'npm',
    before: npmLock({
      'node_modules/demo': { version: '1.0.0' },
      'node_modules/demo/node_modules/helper': { version: '2.0.0' },
      'node_modules/helper': { version: '1.0.0' },
      'node_modules/old': { version: '1.0.0' },
    }),
    after: npmLock({
      'node_modules/demo': { version: '1.1.0' },
      'node_modules/demo/node_modules/helper': { version: '1.5.0' },
      'node_modules/helper': { version: '1.0.0' },
      'node_modules/new': { version: '1.0.0' },
    }),
  });
  expect(
    result.changes.map(({ name, status, declared }) => [
      name,
      status,
      declared,
    ]),
  ).toEqual([
    ['demo', 'upgraded', true],
    ['helper', 'downgraded', false],
    ['new', 'added', false],
    ['old', 'removed', false],
  ]);
  expect(result.changes[1].before).toHaveLength(2);
  expect(result.changes[1].after).toHaveLength(2);
  await expect(
    parseLockfile(
      npmLock({ 'node_modules/bad': { version: '^1.0.0' } }),
      'npm',
    ),
  ).rejects.toThrow('INVALID_VERSION');
});

test('parses Bun JSONC and pnpm peer variants without flattening multiple installations', async () => {
  const bun =
    '{"lockfileVersion":1,"workspaces":{"":{"dependencies":{"@scope/demo":"^1"}}},"packages":{"@scope/demo":["@scope/demo@1.2.0"],"other/@scope/demo":["@scope/demo@1.0.0"],"local":["local@workspace:apps/local"],},}';
  expect(await parseLockfile(bun, 'bun')).toMatchObject({
    packages: [
      { name: '@scope/demo', version: '1.2.0' },
      { name: '@scope/demo', version: '1.0.0' },
    ],
    excluded: 1,
  });
  const pnpm =
    "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      demo: {specifier: ^1, version: 1.0.0}\npackages:\n  demo@1.0.0: {}\nsnapshots:\n  demo@1.0.0(react@18.0.0): {}\n  demo@1.0.0(react@19.0.0): {}\n";
  expect((await parseLockfile(pnpm, 'pnpm')).packages).toHaveLength(2);
  expect(
    (
      await parseLockfile(
        "lockfileVersion: '6.0'\ndependencies:\n  demo: {specifier: ^1, version: 1.0.0}\npackages:\n  /demo@1.0.0: {}",
        'pnpm',
      )
    ).declared,
  ).toEqual(['demo']);
  await expect(
    parseLockfile('{"lockfileVersion":99,"packages":{}}', 'npm'),
  ).rejects.toThrow('UNSUPPORTED_VERSION');
  await expect(
    parseLockfile('{"lockfileVersion":1,"packages":{}}', 'bun'),
  ).rejects.toThrow('INVALID_STRUCTURE');
});

test('runs JSONata aggregation, reports absent results and propagates invalid expressions', async () => {
  expect(
    await transformJsonata({
      input: '{"rows":[{"price":2,"qty":3},{"price":4,"qty":2}]}',
      expression: '{"total":$sum(rows.(price*qty))}',
    }),
  ).toEqual({ output: '{\n  "total": 14\n}', empty: false });
  expect(
    await transformJsonata({ input: '{}', expression: 'missing' }),
  ).toEqual({ output: '', empty: true });
  await expect(
    transformJsonata({ input: '{}', expression: '$sum(' }),
  ).rejects.toMatchObject({ code: expect.any(String) });
  await expect(
    transformJsonata({ input: '{}', expression: ' ' }),
  ).rejects.toThrow('EMPTY_EXPRESSION');
});
