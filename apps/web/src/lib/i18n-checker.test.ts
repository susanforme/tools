import { expect, test } from 'vitest';
import { checkTranslations } from './i18n-checker';

test('checks all targets without conflating dotted keys, placeholders or line endings', () => {
  const base = JSON.stringify({
    'a.b': 'Hi {{ name }} {count} %s <br />\r\n',
    a: { b: 'nested' },
    twice: '{x} {x}',
    missing: 'yes',
  });
  const issues = checkTranslations(base, [
    {
      name: 'zh',
      text: JSON.stringify({
        'a.b': '好 {{name}} {count} %s <br>\n',
        a: { b: '' },
        twice: '{x}',
        extra: true,
      }),
    },
    { name: 'de', text: '{}' },
  ]);
  expect(
    issues
      .filter((issue) => issue.target === 'zh')
      .map(({ path, rule }) => [path, rule]),
  ).toEqual([
    ['/a/b', 'empty'],
    ['/twice', 'placeholder'],
    ['/missing', 'missing'],
    ['/extra', 'extra'],
  ]);
  expect(issues.filter((issue) => issue.target === 'de')).toHaveLength(4);
  expect(
    checkTranslations('{"x":"<b>x</b>\\n"}', [
      { name: 'x', text: '{"x":"<i>x</i>"}' },
    ]).map(({ rule }) => rule),
  ).toEqual(['html', 'newline']);
  expect(() => checkTranslations('[]', [])).toThrow('JSON');
});
