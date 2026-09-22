import { expect, it } from 'vitest';
import { calculateKinship } from './kinship';

it('resolves common and reverse Chinese kinship with the full dictionary', async () => {
  const request = { sex: 1 as const, reverse: false, chain: false };
  expect(
    await calculateKinship({ ...request, text: '妈妈的哥哥的女儿' }),
  ).toEqual(['舅表姐', '舅表妹']);
  expect(await calculateKinship({ ...request, text: '爸爸的哥哥' })).toContain(
    '伯父',
  );
  expect(
    await calculateKinship({ ...request, text: '妈妈的哥哥', reverse: true }),
  ).toContain('外甥');
  expect(
    await calculateKinship({ ...request, text: '外婆', chain: true }),
  ).toContain('妈妈的妈妈');
  await expect(
    calculateKinship({ ...request, text: '爸爸的'.repeat(20) + '哥哥' }),
  ).rejects.toThrow('INVALID_INPUT');
});
