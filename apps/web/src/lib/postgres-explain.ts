import {
  readReportJson,
  reportArray,
  reportNumber,
  reportObject,
  reportPreview,
  reportText,
} from './observability-report';
export type ExplainNode = {
  id: string;
  parent: string | null;
  depth: number;
  type: string;
  relation: string;
  plannedRows: number | null;
  actualRows: number | null;
  loops: number | null;
  time: number | null;
  totalTime: number | null;
  cost: number | null;
  details: string;
};
export type ExplainReport = {
  statements: Array<{
    index: number;
    planning: number | null;
    execution: number | null;
    nodes: ExplainNode[];
  }>;
};
function positive(value: unknown): number | null {
  const result = reportNumber(value);
  if (result !== null && result < 0) throw new Error('invalidFormat');
  return result;
}
export function parseExplain(source: string): ExplainReport {
  const parsed = readReportJson(source);
  const statements = Array.isArray(parsed) ? parsed : [parsed];
  if (!statements.length || statements.length > 100) throw new Error('limit');
  let count = 0;
  return {
    statements: statements.map((raw, index) => {
      const statement = reportObject(raw);
      const nodes: ExplainNode[] = [];
      const stack: Array<{
        raw: unknown;
        parent: string | null;
        depth: number;
      }> = [{ raw: statement.Plan, parent: null, depth: 0 }];
      while (stack.length) {
        const current = stack.pop()!;
        const node = reportObject(current.raw);
        if (++count > 5000 || current.depth > 64) throw new Error('limit');
        const type = reportText(node['Node Type']);
        if (!type) throw new Error('invalidFormat');
        const id = `${index}:${nodes.length}`;
        const loops = positive(node['Actual Loops']);
        const time = positive(node['Actual Total Time']);
        const totalTime = time !== null && loops !== null ? time * loops : null;
        if (totalTime !== null && !Number.isFinite(totalTime))
          throw new Error('invalidFormat');
        nodes.push({
          id,
          parent: current.parent,
          depth: current.depth,
          type,
          relation: [
            reportText(node['Schema']),
            reportText(node['Relation Name'] ?? node['Index Name']),
          ]
            .filter(Boolean)
            .join('.'),
          plannedRows: positive(node['Plan Rows']),
          actualRows: positive(node['Actual Rows']),
          loops,
          time,
          totalTime,
          cost: positive(node['Total Cost']),
          details: reportPreview(
            Object.fromEntries(
              Object.entries(node).filter(([key]) => key !== 'Plans'),
            ),
          ),
        });
        const children = reportArray(node.Plans);
        for (let child = children.length - 1; child >= 0; child--)
          stack.push({
            raw: children[child],
            parent: id,
            depth: current.depth + 1,
          });
      }
      return {
        index,
        planning: positive(statement['Planning Time']),
        execution: positive(statement['Execution Time']),
        nodes,
      };
    }),
  };
}
export function rowEstimateRatio(
  node: Pick<ExplainNode, 'plannedRows' | 'actualRows' | 'loops'>,
): string {
  if (node.actualRows === null || node.plannedRows === null || node.loops === 0)
    return '—';
  if (node.plannedRows === 0) return node.actualRows === 0 ? '1×' : '∞';
  return `${Number((node.actualRows / node.plannedRows).toPrecision(4))}×`;
}
