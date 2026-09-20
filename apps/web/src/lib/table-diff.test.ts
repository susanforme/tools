import { expect, test } from 'vitest';
import { compareTables, parseTable } from './table-diff';

test('parses multiline quoted CSV, preserves identifiers, checks keys and reports cell changes', async () => {
  const before = await parseTable(
    'id,note,old\r\n001,"a, b\n""quoted""",x\r\n002,c,y',
    'csv',
  );
  const after = await parseTable(
    'id,note,new\n001,"updated",z\n003,d,q',
    'csv',
  );
  expect(before.rows[0]).toEqual({
    id: '001',
    note: 'a, b\n"quoted"',
    old: 'x',
  });
  const result = compareTables(before, after, 'id');
  expect([result.added, result.removed, result.changed]).toEqual([1, 1, 1]);
  expect(result.addedColumns).toEqual(['new']);
  expect(result.rows[0].cells.map(({ field, kind }) => [field, kind])).toEqual([
    ['note', 'changed'],
    ['old', 'removed'],
    ['new', 'added'],
  ]);
  expect(() =>
    compareTables(
      before,
      { ...before, rows: [...before.rows, before.rows[0]] },
      'id',
    ),
  ).toThrow('重复');
  await expect(parseTable('id,id\n1,2', 'csv')).rejects.toThrow('重复列名');
  await expect(parseTable('id,note\n1', 'csv')).rejects.toThrow('列数');
});

test('matches JSON objects independent of property order while retaining missing versus null', async () => {
  const before = await parseTable(
    '[{"id":1,"v":{"a":1,"b":2}},{"id":2}]',
    'json',
  );
  const after = await parseTable(
    '[{"id":2,"v":null},{"id":1,"v":{"b":2,"a":1}}]',
    'json',
  );
  expect(compareTables(before, after, 'id')).toMatchObject({
    changed: 1,
    unchanged: 1,
    rows: [{ key: '2', cells: [{ field: 'v', kind: 'added' }] }],
  });
  expect(compareTables(before, after, null).changed).toBe(2);
  expect(() => compareTables(before, after, '')).toThrow('主键');
});
