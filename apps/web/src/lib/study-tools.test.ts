import { describe, expect, it } from 'vitest';
import {
  clozeQuestion,
  importFlashcards,
  rateFlashcard,
  validateFlashData,
} from './flashcards';
import { labelLayout } from './label-maker';
import { generateMath, hasCarry, mathExpression } from './math-worksheet';
import { annotatePinyin } from './pinyin-annotator';
import { defaultResume, validateResume } from './resume-builder';
import { buildSeats, shuffleSeats } from './seating-chart';
import { studyRows } from './study-print';
function seeded() {
  let state = 42;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
describe('study tools', () => {
  it('calculates exact A4 label capacity and rejects impossible sheets', () => {
    const options = {
      width: 60,
      height: 30,
      gap: 3,
      margin: 10,
      font: 5,
      copies: 2,
      fold: false,
    };
    expect(labelLayout(options, 100)).toEqual({
      columns: 3,
      rows: 8,
      capacity: 24,
    });
    expect(() =>
      labelLayout({ ...options, width: 190, margin: 40 }, 1),
    ).toThrow();
    expect(() => labelLayout({ ...options, copies: 1.2 }, 1)).toThrow();
  });
  it('imports quoted CSV/TSV including multiline label content', async () => {
    expect(await studyRows('"Doe, Jane",Team A\n"Two\nlines",Team B')).toEqual([
      ['Doe, Jane', 'Team A'],
      ['Two\nlines', 'Team B'],
    ]);
    expect(await studyRows('word\tmeaning')).toEqual([['word', 'meaning']]);
    await expect(studyRows('"unclosed')).rejects.toThrow();
  });
  it('validates resume backups without accepting malformed sections', () => {
    const resume = defaultResume('en');
    resume.name = 'Jane';
    expect(validateResume(resume)).toEqual(resume);
    expect(resume.sections[1]?.title).toBe('Experience');
    expect(() =>
      validateResume({
        ...resume,
        sections: [resume.sections[0], resume.sections[0]],
      }),
    ).toThrow();
  });
  it('keeps locked seats and duplicate names while excluding blocked seats', () => {
    const names = ['Alex', 'Alex', 'Sam'];
    const seats = buildSeats(names, 2, 2);
    seats[0]!.fixed = true;
    seats[3]!.blocked = true;
    const result = shuffleSeats(seats, names, seeded());
    expect(result[0]).toEqual(seats[0]);
    expect(result[3]!.name).toBeNull();
    expect(
      result
        .map((seat) => seat.name)
        .filter(Boolean)
        .sort(),
    ).toEqual([...names].sort());
    seats[2]!.blocked = true;
    seats[2]!.name = null;
    expect(() => shuffleSeats(seats, names)).toThrow();
  });
  it('generates unique carry and exact-division problems and rejects impossible requests', () => {
    expect(hasCarry(99, 1)).toBe(true);
    expect(hasCarry(100, 1, true)).toBe(true);
    expect(hasCarry(56, 23, true)).toBe(false);
    const addition = generateMath(
      {
        min: 0,
        max: 99,
        count: 40,
        operation: 'add',
        carry: 'with',
        missing: 'left',
      },
      seeded(),
    );
    expect(
      addition.every(
        (p) => hasCarry(p.left, p.right) && p.answer === p.left + p.right,
      ),
    ).toBe(true);
    expect(new Set(addition.map((p) => `${p.left}/${p.right}`)).size).toBe(40);
    expect(mathExpression(addition[0]!)).toContain('____ +');
    const division = generateMath(
      {
        min: 0,
        max: 20,
        count: 20,
        operation: 'divide',
        carry: 'any',
        missing: 'answer',
      },
      seeded(),
    );
    expect(
      division.every(
        (p) =>
          p.right > 0 &&
          Number.isInteger(p.answer) &&
          p.answer * p.right === p.left,
      ),
    ).toBe(true);
    expect(() =>
      generateMath(
        {
          min: 0,
          max: 0,
          count: 2,
          operation: 'add',
          carry: 'any',
          missing: 'answer',
        },
        seeded(),
      ),
    ).toThrow('mathRange');
  });
  it('uses phrase readings, offers polyphonic alternatives, and preserves non-Chinese characters without annotations', async () => {
    const result = await annotatePinyin('银行，重庆。A\n长大');
    expect(result.map((item) => item.character).join('')).toBe(
      '银行，重庆。A\n长大',
    );
    expect(result.find((item) => item.character === '行')?.reading).toBe(
      'háng',
    );
    expect(result.find((item) => item.character === '重')?.reading).toBe(
      'chóng',
    );
    expect(
      result.find((item) => item.character === '长')?.alternatives,
    ).toContain('cháng');
    expect(
      result
        .filter((item) => !item.chinese)
        .every((item) => item.reading === ''),
    ).toBe(true);
  });
  it('imports cloze cards and schedules grades deterministically', async () => {
    const cards = await importFlashcards(
      'question,answer\n"Paris is in {{France}}",\ncat,猫',
      true,
    );
    expect(cards[0]?.back).toBe('France');
    expect(clozeQuestion(cards[0]!.front)).toBe('Paris is in ____');
    const good = rateFlashcard(cards[0]!, 'good', 1000);
    expect(good.due).toBe(86401000);
    expect(good.interval).toBe(1);
    const second = rateFlashcard(good, 'good', good.due);
    expect(second.interval).toBe(3);
    const forgotten = rateFlashcard(second, 'again', 1000);
    expect(forgotten.due).toBe(601000);
    expect(forgotten.streak).toBe(0);
    expect(() =>
      validateFlashData({
        version: 1,
        decks: [{ id: '1', name: 'Deck', cards: [{ ...cards[0], due: NaN }] }],
      }),
    ).toThrow();
    await expect(importFlashcards('missing answer', false)).rejects.toThrow(
      'flashImport',
    );
  });
});
