import { sheetImages, studySheet, validNumber } from './study-print';
export type MathProblem = {
  left: number;
  right: number;
  operation: '+' | '−' | '×' | '÷';
  answer: number;
  missing: 'answer' | 'left';
};
export type MathOptions = {
  min: number;
  max: number;
  count: number;
  operation: string;
  carry: string;
  missing: string;
};
export function hasCarry(
  left: number,
  right: number,
  subtract = false,
): boolean {
  let carry = 0;
  let found = false;
  while (left || right) {
    const value =
      (left % 10) + (subtract ? -(right % 10) - carry : (right % 10) + carry);
    carry = subtract ? Number(value < 0) : Number(value >= 10);
    found ||= !!carry;
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return found;
}
export function generateMath(
  options: MathOptions,
  random: () => number = Math.random,
): MathProblem[] {
  const { min, max, count, operation, carry, missing } = options;
  validNumber(min, 0, 1000, true);
  validNumber(max, min, 1000, true);
  validNumber(count, 1, 200, true);
  if (
    !['add', 'subtract', 'multiply', 'divide', 'mixed'].includes(operation) ||
    !['any', 'with', 'without'].includes(carry) ||
    !['answer', 'left'].includes(missing)
  )
    throw new Error('options');
  const operations =
    operation === 'mixed'
      ? ['add', 'subtract', 'multiply', 'divide']
      : [operation];
  const result: MathProblem[] = [];
  const seen = new Set<string>();
  const number = () => min + Math.floor(random() * (max - min + 1));
  for (let tries = 0; result.length < count && tries < 60000; tries++) {
    const op = operations[Math.floor(random() * operations.length)]!;
    const left = number();
    const right = number();
    if (
      (op === 'subtract' && left < right) ||
      (op === 'divide' && (!right || left % right !== 0))
    )
      continue;
    if (
      (op === 'add' || op === 'subtract') &&
      carry !== 'any' &&
      hasCarry(left, right, op === 'subtract') !== (carry === 'with')
    )
      continue;
    const key = `${left}/${right}/${op}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const answer =
      op === 'add'
        ? left + right
        : op === 'subtract'
          ? left - right
          : op === 'multiply'
            ? left * right
            : left / right;
    result.push({
      left,
      right,
      operation:
        op === 'add'
          ? '+'
          : op === 'subtract'
            ? '−'
            : op === 'multiply'
              ? '×'
              : '÷',
      answer,
      missing: missing as 'answer' | 'left',
    });
  }
  if (result.length !== count) throw new Error('mathRange');
  return result;
}
export function mathExpression(problem: MathProblem, reveal = false): string {
  return `${problem.missing === 'left' && !reveal ? '____' : problem.left} ${problem.operation} ${problem.right} = ${problem.missing === 'answer' && !reveal ? '____' : problem.answer}`;
}
export function mathSheets(
  problems: MathProblem[],
  title: string,
  answerTitle: string,
): { exercises: string[]; answers: string[] } {
  const render = (answers: boolean) => {
    const images: string[] = [];
    const perPage = 40;
    for (let start = 0; start < problems.length; start += perPage) {
      const sheet = studySheet();
      const ctx = sheet.context;
      ctx.font = '7px sans-serif';
      ctx.fillText(answers ? answerTitle : title, 15, 15);
      ctx.font = '3px sans-serif';
      ctx.fillText(`${Math.floor(start / perPage) + 1}`, 190, 18);
      ctx.font = '4.4px sans-serif';
      problems
        .slice(start, start + perPage)
        .forEach((problem, i) =>
          ctx.fillText(
            `${start + i + 1}.  ${mathExpression(problem, answers)}`,
            15 + (i % 2) * 94,
            35 + Math.floor(i / 2) * 12,
          ),
        );
      images.push(...sheetImages([sheet]));
    }
    return images;
  };
  return { exercises: render(false), answers: render(true) };
}
