export type TestStatus = 'passed' | 'failure' | 'error' | 'skipped';
export type JunitCase = {
  key: string;
  identity: string;
  suite: string;
  classname: string;
  name: string;
  file: string;
  seconds: number | null;
  status: TestStatus;
  details: string;
  duplicate: boolean;
  regression: 'new' | 'existing' | 'ambiguous' | null;
};
export type JunitReport = {
  cases: JunitCase[];
  passed: number;
  failure: number;
  error: number;
  skipped: number;
  seconds: number;
  missingTime: number;
  duplicates: number;
};
export type JunitResult = {
  current: JunitReport;
  baseline: JunitReport | null;
  newFailures: number;
  ambiguousFailures: number;
};
const LIMIT = 10 * 1024 * 1024;
type XmlNode = Record<string, unknown>;
function object(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nodes(value: unknown): XmlNode[] {
  return Array.isArray(value) ? value.filter(object) : [];
}
// 仅解码 XML 内置字符；DTD 和自定义实体保持禁用。
function decodeXml(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, code: string) => {
      const predefined: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      };
      if (!code.startsWith('#')) return predefined[code] ?? entity;
      const point = code.startsWith('#x')
        ? parseInt(code.slice(2), 16)
        : Number(code.slice(1));
      return point > 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : entity;
    },
  );
}
function attributes(node: XmlNode): Record<string, string> {
  const raw = node[':@'];
  return object(raw)
    ? Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [
          key.replace(/^@_/, ''),
          decodeXml(String(value)),
        ]),
      )
    : {};
}
function textContent(value: unknown, depth = 0, cdata = false): string {
  if (depth > 100) throw new Error('TOO_DEEP');
  return nodes(value)
    .map((node) =>
      Object.entries(node)
        .filter(([key]) => key !== ':@')
        .map(([key, child]) =>
          key === '#text'
            ? cdata
              ? String(child)
              : decodeXml(String(child))
            : textContent(child, depth + 1, key === '#cdata'),
        )
        .join(''),
    )
    .join('');
}

export async function parseJunit(xml: string): Promise<JunitReport> {
  if (new TextEncoder().encode(xml).byteLength > LIMIT)
    throw new Error('REPORT_TOO_LARGE');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))
    throw new Error('XML_DECLARATION');
  const { XMLParser, XMLValidator } = await import('fast-xml-parser');
  const validation = XMLValidator.validate(xml);
  if (validation !== true)
    throw new Error(`INVALID_XML:${validation.err.line}:${validation.err.col}`);
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: false,
    cdataPropName: '#cdata',
  });
  const tree: unknown = parser.parse(xml);
  const rootNodes = nodes(tree).filter(
    (node) => !Object.keys(node).some((key) => key.startsWith('?')),
  );
  if (
    rootNodes.length !== 1 ||
    (!('testsuites' in rootNodes[0]) && !('testsuite' in rootNodes[0]))
  )
    throw new Error('NOT_JUNIT');
  const report: JunitReport = {
    cases: [],
    passed: 0,
    failure: 0,
    error: 0,
    skipped: 0,
    seconds: 0,
    missingTime: 0,
    duplicates: 0,
  };
  const walk = (
    children: XmlNode[],
    suite: string[],
    inheritedFile: string,
    depth: number,
  ): void => {
    if (depth > 100) throw new Error('TOO_DEEP');
    for (const node of children) {
      const attrs = attributes(node);
      if ('testsuites' in node)
        walk(nodes(node.testsuites), suite, inheritedFile, depth + 1);
      else if ('testsuite' in node)
        walk(
          nodes(node.testsuite),
          [...suite, attrs.name ?? ''],
          attrs.file ?? inheritedFile,
          depth + 1,
        );
      else if ('testcase' in node) {
        if (!attrs.name) throw new Error('INVALID_CASE');
        const details = nodes(node.testcase);
        const status: TestStatus = details.some((item) => 'error' in item)
          ? 'error'
          : details.some((item) => 'failure' in item)
            ? 'failure'
            : details.some((item) => 'skipped' in item)
              ? 'skipped'
              : 'passed';
        const seconds =
          attrs.time === undefined || attrs.time === ''
            ? null
            : Number(attrs.time);
        if (
          seconds !== null &&
          (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(attrs.time) ||
            !Number.isFinite(seconds) ||
            seconds < 0)
        )
          throw new Error('INVALID_DURATION');
        const file = attrs.file ?? inheritedFile;
        const identity = JSON.stringify([
          suite,
          attrs.classname ?? '',
          attrs.name,
          file,
        ]);
        const detailText = details
          .flatMap((detail) =>
            Object.keys(detail)
              .filter((tag) =>
                [
                  'failure',
                  'error',
                  'skipped',
                  'system-out',
                  'system-err',
                ].includes(tag),
              )
              .map((tag) => {
                const attributes_ = attributes(detail);
                return [
                  tag,
                  attributes_.type,
                  attributes_.message,
                  textContent(detail[tag]),
                ]
                  .filter(Boolean)
                  .join('\n');
              }),
          )
          .join('\n\n');
        report.cases.push({
          key: String(report.cases.length),
          identity,
          suite: suite.join(' / '),
          classname: attrs.classname ?? '',
          name: attrs.name,
          file,
          seconds,
          status,
          details: detailText,
          duplicate: false,
          regression: null,
        });
        report[status]++;
        if (seconds === null) report.missingTime++;
        else {
          report.seconds += seconds;
          if (!Number.isFinite(report.seconds))
            throw new Error('INVALID_DURATION');
        }
        if (report.cases.length > 20_000) throw new Error('CASE_LIMIT');
      }
    }
  };
  walk(rootNodes, [], '', 0);
  const counts = new Map<string, number>();
  for (const item of report.cases)
    counts.set(item.identity, (counts.get(item.identity) ?? 0) + 1);
  for (const item of report.cases) {
    item.duplicate = counts.get(item.identity)! > 1;
    if (item.duplicate) report.duplicates++;
  }
  return report;
}

export async function compareJunit(
  currentXml: string,
  baselineXml: string,
): Promise<JunitResult> {
  const current = await parseJunit(currentXml);
  const baseline = baselineXml.trim() ? await parseJunit(baselineXml) : null;
  const result: JunitResult = {
    current,
    baseline,
    newFailures: 0,
    ambiguousFailures: 0,
  };
  if (!baseline) return result;
  const previous = new Map<string, JunitCase[]>();
  for (const item of baseline.cases) {
    const group = previous.get(item.identity) ?? [];
    group.push(item);
    previous.set(item.identity, group);
  }
  for (const item of current.cases) {
    if (item.status !== 'failure' && item.status !== 'error') continue;
    const old = previous.get(item.identity) ?? [];
    if (item.duplicate || old.length > 1) {
      item.regression = 'ambiguous';
      result.ambiguousFailures++;
    } else if (
      old.length === 0 ||
      !['failure', 'error'].includes(old[0].status)
    ) {
      item.regression = 'new';
      result.newFailures++;
    } else item.regression = 'existing';
  }
  return result;
}
