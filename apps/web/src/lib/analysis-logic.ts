export type LogicNode = { kind: 'variable'; name: string } | { kind: 'constant'; value: boolean } | { kind: 'not'; value: LogicNode } | { kind: 'and' | 'or' | 'xor'; left: LogicNode; right: LogicNode };
export function parseLogic(source: string): LogicNode {
  if (!source.trim() || source.length > 1000) throw new Error('expressionLimit');
  const tokens = source.match(/[A-Za-z][A-Za-z0-9_]*|[01]|[!~&|^()+*]|\S/g) ?? [];
  if (tokens.length > 128) throw new Error('expressionLimit');
  let index = 0;
  const precedence: Record<string, number> = { '|': 1, '+': 1, OR: 1, '^': 2, XOR: 2, '&': 3, '*': 3, AND: 3 };
  function expression(min: number, depth: number): LogicNode {
    if (depth > 32) throw new Error('expressionLimit');
    const token = tokens[index++];
    let left: LogicNode;
    if (token === '!' || token === '~' || token?.toUpperCase() === 'NOT') left = { kind: 'not', value: expression(4, depth + 1) };
    else if (token === '(') { left = expression(0, depth + 1); if (tokens[index++] !== ')') throw new Error('expressionInvalid'); }
    else if (token === '0' || token === '1') left = { kind: 'constant', value: token === '1' };
    else if (token && /^[A-Za-z][A-Za-z0-9_]*$/.test(token) && !['AND', 'OR', 'XOR'].includes(token.toUpperCase())) left = { kind: 'variable', name: token };
    else throw new Error('expressionInvalid');
    while (index < tokens.length) {
      const op = tokens[index].toUpperCase(); const level = precedence[op];
      if (level === undefined || level < min) break;
      index++;
      left = { kind: level === 1 ? 'or' : level === 2 ? 'xor' : 'and', left, right: expression(level + 1, depth + 1) };
    }
    return left;
  }
  const node = expression(0, 0);
  if (index !== tokens.length) throw new Error('expressionInvalid');
  return node;
}
export function logicVariables(node: LogicNode): string[] {
  if (node.kind === 'variable') return [node.name];
  if (node.kind === 'constant') return [];
  if (node.kind === 'not') return logicVariables(node.value);
  return [...new Set([...logicVariables(node.left), ...logicVariables(node.right)])].sort();
}
export function evaluateLogic(node: LogicNode, values: Record<string, boolean>): boolean {
  switch (node.kind) {
    case 'constant': return node.value;
    case 'variable': return values[node.name] ?? false;
    case 'not': return !evaluateLogic(node.value, values);
    case 'and': return evaluateLogic(node.left, values) && evaluateLogic(node.right, values);
    case 'or': return evaluateLogic(node.left, values) || evaluateLogic(node.right, values);
    case 'xor': return evaluateLogic(node.left, values) !== evaluateLogic(node.right, values);
  }
}
export function assignment(variables: string[], row: number): Record<string, boolean> {
  return Object.fromEntries(variables.map((variable, i) => [variable, Boolean(row & (1 << (variables.length - i - 1)))]));
}
/** 六变量内的素蕴含项合并；覆盖选择保持逻辑等价，不承诺全局最短。 */
export function simplifyLogic(variables: string[], outputs: boolean[]): string {
  if (!variables.length) return outputs[0] ? '1' : '0';
  const ones = outputs.flatMap((value, index) => value ? [index] : []);
  if (!ones.length) return '0';
  if (ones.length === outputs.length) return '1';
  let terms = ones.map((index) => index.toString(2).padStart(variables.length, '0'));
  const primes = new Set<string>();
  while (terms.length) {
    const used = new Set<string>(); const next = new Set<string>();
    for (let a = 0; a < terms.length; a++) for (let b = a + 1; b < terms.length; b++) {
      const differences = [...terms[a]].flatMap((char, i) => char !== terms[b][i] ? [i] : []);
      if (differences.length !== 1) continue;
      const i = differences[0];
      if (terms[a][i] === '-' || terms[b][i] === '-') continue;
      used.add(terms[a]); used.add(terms[b]); next.add(terms[a].slice(0, i) + '-' + terms[a].slice(i + 1));
    }
    for (const term of terms) if (!used.has(term)) primes.add(term);
    terms = [...next];
  }
  const uncovered = new Set(ones);
  const covers = (term: string, value: number): boolean => [...term].every((char, i) => char === '-' || Number(char) === ((value >> (variables.length - i - 1)) & 1));
  const selected: string[] = [];
  while (uncovered.size) {
    // ponytail: greedy prime cover is equivalent but not always shortest; use Petrick's method if exact minima are needed.
    const best = [...primes].sort((a, b) => [...uncovered].filter((n) => covers(b, n)).length - [...uncovered].filter((n) => covers(a, n)).length || a.replaceAll('-', '').length - b.replaceAll('-', '').length)[0];
    selected.push(best); primes.delete(best);
    for (const value of uncovered) if (covers(best, value)) uncovered.delete(value);
  }
  return selected.map((term) => [...term].flatMap((char, i) => char === '-' ? [] : [char === '0' ? `!${variables[i]}` : variables[i]]).join(' & ')).map((term) => `(${term})`).join(' | ');
}
export function analyzeLogic(source: string, comparison = '') {
  const node = parseLogic(source); const other = comparison.trim() ? parseLogic(comparison) : null;
  const variables = [...new Set([...logicVariables(node), ...(other ? logicVariables(other) : [])])].sort();
  if (variables.length > 6) throw new Error('variableLimit');
  const rows = Array.from({ length: 2 ** variables.length }, (_, index) => {
    const values = assignment(variables, index);
    return { values, output: evaluateLogic(node, values), comparison: other ? evaluateLogic(other, values) : null };
  });
  return { variables, rows, simplified: simplifyLogic(variables, rows.map((row) => row.output)), equivalent: other ? rows.every((row) => row.output === row.comparison) : null };
}
export function karnaughRows(variableCount: number): { rows: number[]; columns: number[]; columnBits: number; rowBits: number } {
  const rowBits = Math.floor(variableCount / 2); const columnBits = variableCount - rowBits;
  const gray = (bits: number): number[] => Array.from({ length: 2 ** bits }, (_, i) => i ^ (i >> 1));
  return { rows: gray(rowBits), columns: gray(columnBits), columnBits, rowBits };
}
