export type MetricSample = {
  name: string;
  labels: Record<string, string>;
  value: string;
  timestamp: string | null;
  exemplar: string | null;
  line: number;
};
const FLOAT =
  /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$|^[+-]?Inf$|^NaN$/;
function parseLabels(
  rawLabels: string,
  lineNumber: number,
): Record<string, string> {
  const labels: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  let rest = rawLabels.slice(1, -1).trim();
  while (rest) {
    const label =
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"((?:\\[\\"n]|[^"\\\n])*)"\s*(,\s*|$)/.exec(
        rest,
      );
    if (!label || Object.hasOwn(labels, label[1]!))
      throw new Error(`第 ${lineNumber} 行：标签无效或重复`);
    labels[label[1]!] = label[2]!.replace(/\\([\\"n])/g, (_, char: string) =>
      char === 'n' ? '\n' : char,
    );
    rest = rest.slice(label[0].length);
  }
  return labels;
}
export function inspectMetrics(input: string, openMetrics: boolean) {
  if (input.length > 2_000_000) throw new Error('输入不能超过 2 MB');
  const families = new Map<
    string,
    { name: string; type: string; help: string; unit: string }
  >();
  const samples: MetricSample[] = [];
  const seen = new Set<string>();
  const warnings: string[] = [];
  let eof = false;
  for (const [index, raw] of input.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (eof) throw new Error(`第 ${index + 1} 行：EOF 后不能有内容`);
    if (line === '# EOF') {
      eof = true;
      continue;
    }
    if (line.startsWith('#')) {
      const match =
        /^#\s+(HELP|TYPE|UNIT)\s+([a-zA-Z_:][a-zA-Z0-9_:]*)\s+(.+)$/.exec(line);
      if (!match && /^#\s+(HELP|TYPE|UNIT)\b/.test(line))
        throw new Error(`第 ${index + 1} 行：指标元数据无效`);
      if (match) {
        const [, kind, name, value] = match;
        const family = families.get(name!) ?? {
          name: name!,
          type: 'untyped',
          help: '',
          unit: '',
        };
        if (kind === 'TYPE') {
          if (
            ![
              'counter',
              'gauge',
              'histogram',
              'gaugehistogram',
              'summary',
              'info',
              'stateset',
              'untyped',
              'unknown',
            ].includes(value!)
          )
            throw new Error(`第 ${index + 1} 行：未知指标类型`);
          family.type = value!;
        } else if (kind === 'HELP') family.help = value!;
        else family.unit = value!;
        families.set(name!, family);
      }
      continue;
    }
    const match =
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{(?:[^"}\\]|"(?:\\.|[^"\\])*")*\})?\s+([^\s]+)(?:\s+([^#\s]+))?(?:\s+#\s+(.*))?$/.exec(
        line,
      );
    if (!match)
      throw new Error(
        `第 ${index + 1} 行：无效样本（不支持 UTF-8 名称和原生直方图）`,
      );
    const [, name, rawLabels, value, timestamp, exemplar] = match;
    if (
      !FLOAT.test(value!) ||
      (timestamp && !/^[+-]?\d+(?:\.\d+)?$/.test(timestamp))
    )
      throw new Error(`第 ${index + 1} 行：数值或时间戳无效`);
    const labels = parseLabels(rawLabels ?? '{}', index + 1);
    if (exemplar) {
      const match =
        /^(\{(?:[^"}\\]|"(?:\\.|[^"\\])*")*\})\s+(\S+)(?:\s+(\S+))?$/.exec(
          exemplar,
        );
      if (
        !match ||
        !FLOAT.test(match[2]!) ||
        (match[3] && !/^[+-]?\d+(?:\.\d+)?$/.test(match[3]))
      )
        throw new Error(`第 ${index + 1} 行：exemplar 格式无效`);
      parseLabels(match[1]!, index + 1);
    }
    const key =
      name +
      JSON.stringify(
        Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)),
      );
    if (seen.has(key))
      warnings.push(`第 ${index + 1} 行：重复时间序列 ${name}`);
    seen.add(key);
    samples.push({
      name: name!,
      labels,
      value: value!,
      timestamp: timestamp ?? null,
      exemplar: exemplar ?? null,
      line: index + 1,
    });
  }
  if (openMetrics && !eof) throw new Error('OpenMetrics 必须以 # EOF 结束');
  if (!samples.length) throw new Error('未找到指标样本');
  return {
    families: [...families.values()],
    sampleCount: samples.length,
    samples,
    warnings,
  };
}
export async function inspectPromql(input: string) {
  if (!input.trim() || input.length > 100_000)
    throw new Error('请输入 100 KB 以内的 PromQL');
  const { parser } = await import('@prometheus-io/lezer-promql');
  const tree = parser.parse(input);
  const nodes: {
    type: string;
    from: number;
    to: number;
    text: string;
    depth: number;
  }[] = [];
  const errors: { from: number; to: number }[] = [];
  let depth = 0;
  tree.iterate({
    enter(node) {
      if (nodes.length >= 20_000) throw new Error('语法节点超过 20000 个');
      if (node.type.isError) errors.push({ from: node.from, to: node.to });
      nodes.push({
        type: node.name,
        from: node.from,
        to: node.to,
        text: input.slice(node.from, Math.min(node.to, node.from + 200)),
        depth,
      });
      depth++;
    },
    leave() {
      depth--;
    },
  });
  return { valid: errors.length === 0, errors, tree: tree.toString(), nodes };
}
