import { Parser } from '@asyncapi/parser';
import { describe, expect, it, vi } from 'vitest';
import { analyzeAsyncApi, evaluateCel, inspectSpdx } from './schema-workbench';
import { analyzeSqlStructure } from './sql-structure';
const asyncDoc = {
  asyncapi: '3.0.0',
  info: { title: 'Test', version: '1.0.0' },
  channels: {
    orders: {
      address: 'orders',
      messages: { created: { $ref: '#/components/messages/Created' } },
    },
  },
  operations: {
    send: { action: 'send', channel: { $ref: '#/channels/orders' } },
  },
  components: {
    messages: {
      Created: {
        payload: { type: 'object', properties: { id: { type: 'string' } } },
      },
    },
  },
};
describe('AsyncAPI local parser', () => {
  it('validates local references and reports resolved channels and operations', async () => {
    const result = await analyzeAsyncApi(JSON.stringify(asyncDoc), Parser);
    expect(result.valid).toBe(true);
    const data = JSON.parse(result.output);
    expect(data.channels[0]).toEqual({
      id: 'orders',
      address: 'orders',
      messages: 1,
    });
    expect(data.operations[0].action).toBe('send');
    const missing = structuredClone(asyncDoc);
    missing.channels.orders.messages.created.$ref =
      '#/components/messages/Missing';
    expect((await analyzeAsyncApi(JSON.stringify(missing), Parser)).valid).toBe(
      false,
    );
  });
  it('blocks remote references and YAML aliases before any resolver can fetch', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const remote = structuredClone(asyncDoc);
    remote.channels.orders.messages.created.$ref =
      'https://example.test/message.json';
    await expect(
      analyzeAsyncApi(JSON.stringify(remote), Parser),
    ).rejects.toThrow('LOCAL_REFS');
    await expect(
      analyzeAsyncApi(
        'asyncapi: 3.0.0\ninfo: &x {title: Test, version: 1.0.0}\nx-copy: *x',
        Parser,
      ),
    ).rejects.toThrow('YAML_ALIAS');
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});
describe('CEL community evaluator', () => {
  it('evaluates map/list bindings and CEL macros without executing JS', async () => {
    const result = await evaluateCel(
      'user.active && user.roles.exists(r, r == "admin")',
      '{"user":{"active":true,"roles":["admin"]}}',
      false,
    );
    expect(JSON.parse(result.output)).toEqual({ type: 'bool', value: true });
    await expect(
      evaluateCel('globalThis.process.exit()', '{}', false),
    ).rejects.toThrow();
    await expect(
      evaluateCel('user.missing', '{"user":{}}', false),
    ).rejects.toThrow();
  });
  it('preserves int/uint precision and exposes numeric mapping rather than rounding silently', async () => {
    const result = await evaluateCel(
      'int(value)',
      '{"value":"9223372036854775807"}',
      false,
    );
    expect(JSON.parse(result.output).value.value).toBe('9223372036854775807');
    expect(
      JSON.parse((await evaluateCel('x + 1', '{"x":4}', true)).output).value
        .value,
    ).toBe('5');
    await expect(
      evaluateCel('x', '{"x":9007199254740993}', false),
    ).rejects.toThrow('UNSAFE_NUMBER');
    expect(
      JSON.parse((await evaluateCel('42u', '{}', false)).output).value,
    ).toEqual({ type: 'uint', value: '42' });
  });
});
describe('SPDX expression parser', () => {
  it('preserves AND/OR precedence, exceptions and custom identifiers', async () => {
    const result = await inspectSpdx(
      'MIT OR Apache-2.0 AND GPL-2.0-only WITH Classpath-exception-2.0',
    );
    const data = JSON.parse(result.output);
    expect(data.ast.conjunction).toBe('or');
    expect(data.ast.right.conjunction).toBe('and');
    expect(data.exceptions).toEqual(['Classpath-exception-2.0']);
    expect(result.tree).toContain('WITH');
    expect(
      JSON.parse((await inspectSpdx('LicenseRef-company')).output).licenses,
    ).toEqual(['LicenseRef-company']);
    await expect(inspectSpdx('Totally-Unknown-License')).rejects.toThrow();
    await expect(inspectSpdx('MIT WITH Not-An-Exception')).rejects.toThrow();
  });
});
const dependencies = (
  source: string,
  dialect: 'postgresql' | 'mysql' = 'postgresql',
) => analyzeSqlStructure({ source, dialect, mode: 'dependencies' });
const ddl = (source: string, dialect: 'postgresql' | 'mysql' = 'postgresql') =>
  analyzeSqlStructure({ source, dialect, mode: 'ddl' });
describe('SQL physical table dependencies', () => {
  it('excludes scoped CTEs and aliases but keeps schema-qualified and nested sources', async () => {
    const result = JSON.parse(
      (
        await dependencies(
          'WITH recent AS (SELECT * FROM orders) SELECT * FROM recent r JOIN public.recent p ON true WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)',
        )
      ).output,
    );
    expect(result.tables.map((x: { table: string }) => x.table).sort()).toEqual(
      ['orders', 'public.recent', 'users'],
    );
    expect(
      result.tables.find((x: { table: string }) => x.table === 'users').aliases,
    ).toEqual(['u']);
  });
  it('handles nonrecursive self-named base tables, recursive and forward CTEs', async () => {
    expect(
      JSON.parse(
        (
          await dependencies(
            'WITH foo AS (SELECT * FROM foo) SELECT * FROM foo',
          )
        ).output,
      ).tables[0].table,
    ).toBe('foo');
    const recursive = JSON.parse(
      (
        await dependencies(
          'WITH RECURSIVE a AS (SELECT * FROM b), b AS (SELECT * FROM seed UNION ALL SELECT * FROM b) SELECT * FROM a',
        )
      ).output,
    );
    expect(recursive.tables.map((x: { table: string }) => x.table)).toEqual([
      'seed',
    ]);
    const mysql = JSON.parse(
      (
        await dependencies(
          'WITH recent AS (SELECT * FROM orders) SELECT * FROM recent',
          'mysql',
        )
      ).output,
    );
    expect(mysql.tables.map((x: { table: string }) => x.table)).toEqual([
      'orders',
    ]);
  });
  it('rejects unsupported write statements, table functions and ambiguous quoted CTEs', async () => {
    await expect(dependencies('INSERT INTO a SELECT * FROM b')).rejects.toThrow(
      'SELECT_ONLY',
    );
    await expect(
      dependencies('SELECT * FROM generate_series(1,10)'),
    ).rejects.toThrow('TABLE_FUNCTION');
    await expect(
      dependencies('WITH "Mixed" AS (SELECT * FROM a) SELECT * FROM "Mixed"'),
    ).rejects.toThrow('CTE_CASE');
  });
});
describe('SQL DDL ER structure', () => {
  it('reads inline/table primary and composite foreign keys and generates safe Mermaid identifiers', async () => {
    const result = await ddl(
      'CREATE TABLE parent (a INT, b INT, PRIMARY KEY(a,b)); CREATE TABLE child (id INT PRIMARY KEY, a INT NOT NULL, b INT NOT NULL, UNIQUE(a,b), FOREIGN KEY(a,b) REFERENCES parent(a,b));',
    );
    const data = JSON.parse(result.output);
    expect(data.tables[0].primaryKey).toEqual(['a', 'b']);
    expect(data.tables[1].foreignKeys[0]).toEqual({
      columns: ['a', 'b'],
      target: 'parent',
      references: ['a', 'b'],
    });
    expect(
      data.tables[1].columns.filter((c: { foreign: boolean }) => c.foreign),
    ).toHaveLength(2);
    expect(result.diagram).toContain('|o..||');
    expect(result.diagram).toContain('T0["parent"]');
    const mysql = JSON.parse(
      (
        await ddl(
          'CREATE TABLE a (id INT PRIMARY KEY); CREATE TABLE b (id INT PRIMARY KEY, a_id INT, FOREIGN KEY(a_id) REFERENCES a(id));',
          'mysql',
        )
      ).output,
    );
    expect(mysql.tables[1].foreignKeys[0].target).toBe('a');
  });
  it('handles inline references, external targets and invalid key columns explicitly', async () => {
    expect(
      JSON.parse(
        (
          await ddl(
            'CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id));',
          )
        ).output,
      ).unresolved,
    ).toEqual(['users']);
    await expect(
      ddl('CREATE TABLE a (id INT, PRIMARY KEY(nope));'),
    ).rejects.toThrow('KEY_COLUMN');
    await expect(ddl('ALTER TABLE a ADD COLUMN id INT;')).rejects.toThrow(
      'CREATE_ONLY',
    );
    await expect(dependencies(' '.repeat(256 * 1024 + 1))).rejects.toThrow(
      'LIMIT',
    );
  });
});
