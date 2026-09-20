export interface PathRuleRequest {
  mode: 'glob' | 'gitignore';
  rules: string;
  paths: string;
  dot: boolean;
  caseSensitive: boolean;
}
export interface PathRuleResult {
  rows: { path: string; matched: boolean; rules: string[]; invalid: boolean }[];
}
export async function debugPathRules(
  request: PathRuleRequest,
): Promise<PathRuleResult> {
  const { mode, rules, paths, dot, caseSensitive } = request;
  const encoder = new TextEncoder();
  if (
    encoder.encode(rules).length > 32768 ||
    encoder.encode(paths).length > 262144
  )
    throw new Error('LIMIT');
  const patterns = rules.split(/\r?\n/);
  const inputs = paths.split(/\r?\n/).filter((path) => path.length > 0);
  if (
    patterns.length > 200 ||
    inputs.length > 2000 ||
    patterns.some((p) => p.length > 1000) ||
    inputs.some((p) => p.length > 2000)
  )
    throw new Error('LIMIT');
  if (mode === 'gitignore') {
    const { default: ignore } = await import('ignore');
    const matcher = ignore({ ignorecase: !caseSensitive });
    patterns.forEach((pattern, index) =>
      matcher.add({ pattern, mark: String(index + 1) }),
    );
    return {
      rows: inputs.map((path) => {
        if (
          !ignore.isPathValid(path) ||
          path.includes('\\') ||
          /^[A-Za-z]:/.test(path) ||
          path.split('/').some((p) => p === '..' || p === '.')
        )
          return { path, matched: false, rules: [], invalid: true };
        const checked = matcher.checkIgnore(path);
        return {
          path,
          matched: checked.ignored,
          rules: checked.rule
            ? [`${checked.rule.mark ?? '?'}: ${checked.rule.pattern}`]
            : [],
          invalid: false,
        };
      }),
    };
  }
  const { default: picomatch } = await import('picomatch/posix');
  const compiled = patterns.flatMap((pattern, index) => {
    if (!pattern) return [];
    const negative = pattern.startsWith('!') && !pattern.startsWith('!(');
    const actual = negative ? pattern.slice(1) : pattern;
    if (!actual) throw new Error('PATTERN');
    return [
      {
        negative,
        pattern,
        index,
        match: picomatch(actual, {
          dot,
          nocase: !caseSensitive,
          nonegate: true,
          strictBrackets: true,
          maxLength: 1000,
        }),
      },
    ];
  });
  return {
    rows: inputs.map((path) => {
      if (
        path.includes('\\') ||
        /^[A-Za-z]:/.test(path) ||
        path.startsWith('/') ||
        path.split('/').some((p) => p === '..' || p === '.')
      )
        return { path, matched: false, rules: [], invalid: true };
      const hits = compiled.filter((rule) => rule.match(path));
      return {
        path,
        matched:
          compiled.length > 0 &&
          (!compiled.some((rule) => !rule.negative) ||
            hits.some((rule) => !rule.negative)) &&
          !hits.some((rule) => rule.negative),
        rules: hits.map((rule) => `${rule.index + 1}: ${rule.pattern}`),
        invalid: false,
      };
    }),
  };
}
