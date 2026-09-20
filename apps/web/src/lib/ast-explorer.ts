export interface AstNode {
  id: number;
  parent: number | null;
  field: string;
  type: string;
  start: number;
  end: number;
  line: number;
  column: number;
  summary: string;
  details: Record<string, string | number | boolean | null>;
  children: number[];
}
export interface AstResult {
  nodes: AstNode[];
}
export interface AstRequest {
  source: string;
  syntax: 'js' | 'ts' | 'tsx';
}
export async function parseAst({
  source,
  syntax,
}: AstRequest): Promise<AstResult> {
  if (new TextEncoder().encode(source).length > 512 * 1024)
    throw new Error('LIMIT');
  const { parse } = await import('@babel/parser');
  const ast = parse(source, {
    sourceType: 'unambiguous',
    plugins:
      syntax === 'tsx'
        ? ['typescript', 'jsx']
        : syntax === 'ts'
          ? ['typescript']
          : ['jsx'],
    attachComment: false,
    errorRecovery: false,
  });
  const nodes: AstNode[] = [];
  const pending: {
    value: unknown;
    parent: number | null;
    field: string;
    depth: number;
  }[] = [{ value: ast.program, parent: null, field: 'program', depth: 0 }];
  while (pending.length) {
    const item = pending.pop()!;
    if (item.depth > 256 || nodes.length >= 20000) throw new Error('LIMIT');
    const raw = item.value as Record<string, unknown>;
    const id = nodes.length;
    const loc = raw.loc as {
      start?: { line?: number; column?: number };
    } | null;
    const details: AstNode['details'] = {};
    for (const [key, value] of Object.entries(raw))
      if (
        !['start', 'end', 'type'].includes(key) &&
        (value === null ||
          ['string', 'number', 'boolean'].includes(typeof value))
      )
        details[key] =
          typeof value === 'string'
            ? value.slice(0, 500)
            : (value as number | boolean | null);
    const node: AstNode = {
      id,
      parent: item.parent,
      field: item.field,
      type: String(raw.type),
      start: Number(raw.start ?? 0),
      end: Number(raw.end ?? 0),
      line: loc?.start?.line ?? 1,
      column: loc?.start?.column ?? 0,
      summary: String(raw.name ?? raw.value ?? '').slice(0, 100),
      details,
      children: [],
    };
    nodes.push(node);
    if (item.parent !== null) nodes[item.parent]!.children.push(id);
    const children: typeof pending = [];
    for (const [field, value] of Object.entries(raw)) {
      if (
        [
          'loc',
          'extra',
          'comments',
          'leadingComments',
          'trailingComments',
          'innerComments',
        ].includes(field)
      )
        continue;
      const values = Array.isArray(value) ? value : [value];
      values.forEach((child: unknown, index) => {
        if (
          child &&
          typeof child === 'object' &&
          'type' in child &&
          typeof child.type === 'string'
        )
          children.push({
            value: child,
            parent: id,
            field: Array.isArray(value) ? `${field}[${index}]` : field,
            depth: item.depth + 1,
          });
      });
    }
    pending.push(...children.reverse());
  }
  return { nodes };
}
