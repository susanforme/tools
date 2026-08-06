import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatPoetryContent,
  generatePoetryName,
  splitPoetrySentences,
} from './gushi-namer';

describe('gushi namer reference behavior', () => {
  afterEach(() => vi.restoreAllMocks());

  it('formats and splits poetry like the reference implementation', () => {
    expect(formatPoetryContent('<p>春 风。<br>秋月。(注释)</p>')).toBe(
      '春风。秋月。',
    );
    expect(splitPoetrySentences('春风。秋月！')).toEqual(['春风。', '秋月！']);
  });

  it('selects two different characters in their original order', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0);
    expect(
      generatePoetryName([
        {
          content: '春风秋月。',
          title: '测试',
          author: '佚名',
          book: '诗经',
          dynasty: '先秦',
        },
      ])?.name,
    ).toBe('春月');
  });
});
