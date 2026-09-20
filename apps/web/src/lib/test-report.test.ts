import { expect, test } from 'vitest';
import { compareJunit, parseJunit } from './junit-report';
import {
  compareLcov,
  coverageMetric,
  matchCoverageSource,
  parseLcov,
} from './lcov-report';

test('JUnit retains nested suites and duplicates without inventing regressions', async () => {
  const baseline =
    '<testsuites><testsuite name="a"><testcase classname="C" name="same" time="1"/><testcase classname="C" name="same" time="2"/><testcase name="regression" time="0.5"/></testsuite><testsuite name="b"><testcase classname="C" name="same"/></testsuite></testsuites>';
  const current =
    '<testsuites><testsuite name="a"><testcase classname="C" name="same"><failure message="bad"><![CDATA[at x.ts:2\n<unsafe>]]></failure></testcase><testcase classname="C" name="same"/><testcase name="regression"><error message="Oops">stack</error></testcase><testcase name="skip"><skipped/></testcase></testsuite><testsuite name="b"><testcase classname="C" name="same"/></testsuite></testsuites>';
  const result = await compareJunit(current, baseline);
  expect(result.current.cases).toHaveLength(5);
  expect(result).toMatchObject({
    newFailures: 1,
    ambiguousFailures: 1,
    current: { duplicates: 2, failure: 1, error: 1, skipped: 1, passed: 2 },
    baseline: { seconds: 3.5 },
  });
  expect(result.current.cases[0].details).toContain('at x.ts:2\n<unsafe>');
  expect(result.current.cases[4].identity).not.toBe(
    result.current.cases[0].identity,
  );
  await expect(
    parseJunit('<!DOCTYPE testsuite [<!ENTITY test "boom">]><testsuite/>'),
  ).rejects.toThrow('XML_DECLARATION');
  await expect(
    parseJunit('<testsuite><testcase name="bad" time="-1"/></testsuite>'),
  ).rejects.toThrow('INVALID_DURATION');
  await expect(parseJunit('<html/>')).rejects.toThrow('NOT_JUNIT');
});

test('JUnit decodes built-in XML characters but preserves literal CDATA', async () => {
  const report = await parseJunit(
    '<testsuite name="A&amp;B"><testcase name="&#65;&lt;x&gt;" time="1e-3"><failure message="x &quot; y">x&lt;y<![CDATA[ a&amp;b]]></failure></testcase></testsuite>',
  );
  expect(report.cases[0]).toMatchObject({
    suite: 'A&B',
    name: 'A<x>',
    seconds: 0.001,
  });
  expect(report.cases[0].details).toContain('x " y');
  expect(report.cases[0].details).toContain('x<y a&amp;b');
  await expect(
    parseJunit('<testsuite><testcase name="bad" time="0x10"/></testsuite>'),
  ).rejects.toThrow('INVALID_DURATION');
  await expect(parseJunit('<testsuite><testcase></testsuite>')).rejects.toThrow(
    'INVALID_XML',
  );
});

test('LCOV merges repeated source records and branch hits with zero denominator unknown', () => {
  const report = parseLcov(
    'TN:a\nSF:src/a.ts\nDA:1,1,hash\nDA:2,0\nBRDA:2,0,check(a,b),-\nBRDA:2,0,other,1\nend_of_record\nTN:b\nSF:src/a.ts\nDA:1,2,hash\nDA:2,1\nBRDA:2,0,check(a,b),2\nBRDA:2,0,other,0\nend_of_record\nSF:src/empty.ts\nend_of_record',
  );
  expect(report.files[0]).toMatchObject({
    records: 2,
    lines: [
      { line: 1, hits: 3 },
      { line: 2, hits: 1 },
    ],
    lineCoverage: { hit: 2, found: 2, percent: 100 },
    branchCoverage: { hit: 2, found: 2, percent: 100 },
  });
  expect(report.files[1].lineCoverage.percent).toBeNull();
  expect(coverageMetric(0, 0).percent).toBeNull();
  expect(() => parseLcov('SF:a\nDA:1,-1\nend_of_record')).toThrow(
    'INVALID_COUNT',
  );
  expect(() =>
    parseLcov(
      'SF:a\nDA:1,1,abc\nend_of_record\nSF:a\nDA:1,1,def\nend_of_record',
    ),
  ).toThrow('SOURCE_MISMATCH');
  const diff = compareLcov(
    'SF:a\nDA:1,0\nend_of_record',
    'SF:a\nDA:1,1\nend_of_record',
  );
  expect(diff.changes[0].lineDelta).toBe(-100);
});

test('source matching allows only unique path matches, including Windows paths', () => {
  expect(
    matchCoverageSource(
      '/repo/src/a.ts',
      ['project/src/a.ts'],
      ['/repo/src/a.ts'],
    ),
  ).toBeNull();
  expect(
    matchCoverageSource('/repo/src/a.ts', ['src/a.ts'], ['/repo/src/a.ts']),
  ).toBe(0);
  expect(
    matchCoverageSource(
      'C:\\repo\\src\\a.ts',
      ['a.ts'],
      ['C:\\repo\\src\\a.ts'],
    ),
  ).toBe(0);
  expect(
    matchCoverageSource(
      '/repo/src/a.ts',
      ['a.ts'],
      ['/repo/src/a.ts', '/repo/test/a.ts'],
    ),
  ).toBeNull();
});
