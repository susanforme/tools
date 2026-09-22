export const TYPING_PRESETS = {
  zh: '清晨的阳光穿过窗户，落在书桌上。每天留一点时间阅读和练习，慢慢积累，也能走得很远。保持专注，不必着急，让每一次进步都成为新的起点。',
  en: 'The morning sunlight falls across the quiet room. Take a little time to read, learn, and practice every day. Small steps can lead to great progress. Stay curious and enjoy the journey.',
};
export function typingStats(target: string, input: string, elapsedMs: number) {
  const expected = Array.from(target.normalize('NFC'));
  const actual = Array.from(input.normalize('NFC'));
  const correct = actual.filter((char, i) => char === expected[i]).length;
  return {
    correct,
    entered: actual.length,
    accuracy: actual.length ? (correct / actual.length) * 100 : 100,
    cpm: elapsedMs > 0 ? (correct * 60000) / elapsedMs : 0,
    mistakes: [
      ...new Set(
        expected.filter(
          (_, i) => i < actual.length && expected[i] !== actual[i],
        ),
      ),
    ].join(''),
    complete: expected.length > 0 && actual.length >= expected.length,
  };
}
