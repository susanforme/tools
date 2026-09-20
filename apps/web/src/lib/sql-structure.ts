export interface SqlStructureRequest {
  source: string;
  dialect: 'postgresql' | 'mysql';
  mode: 'dependencies' | 'ddl';
}
export interface SqlStructureResult {
  output: string;
  diagram: string;
}
type Obj = Record<string, unknown>;
const obj = (v: unknown): v is Obj =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function name(value: unknown): string {
  if (typeof value === 'string') return value;
  if (obj(value)) return name(value.value ?? value.column ?? value.expr);
  return '';
}
const tableName = (value: Obj): string =>
  [name(value.db), name(value.table)].filter(Boolean).join('.');
export async function analyzeSqlStructure(
  request: SqlStructureRequest,
): Promise<SqlStructureResult> {
  if (new TextEncoder().encode(request.source).length > 256 * 1024)
    throw new Error('LIMIT');
  const module =
    request.dialect === 'mysql'
      ? await import('node-sql-parser/build/mysql')
      : await import('node-sql-parser/build/postgresql');
  const Parser = module.Parser ?? module.default.Parser;
  const parser = new Parser();
  const parsed: unknown = parser.astify(request.source, {
    database: request.dialect === 'mysql' ? 'MySQL' : 'PostgreSQL',
  });
  const statements = Array.isArray(parsed) ? parsed : [parsed];
  if (statements.length > 100) throw new Error('LIMIT');
  if (request.mode === 'ddl') return ddlDiagram(statements);
  const tables = new Map<string, Set<string>>();
  const ctes: string[] = [];
  let visits = 0;
  function visit(value: unknown, scope: Set<string>, depth: number): void {
    if (++visits > 50000 || depth > 128) throw new Error('LIMIT');
    if (Array.isArray(value)) {
      value.forEach((v) => visit(v, scope, depth + 1));
      return;
    }
    if (!obj(value)) return;
    if (value.type === 'select') {
      if (obj(value.into) && (value.into.table || value.into.expr))
        throw new Error('SELECT_ONLY');
      const local = new Set(scope);
      const definitions = arr(value.with);
      if (definitions.some((item) => obj(item) && item.recursive)) {
        for (const item of definitions)
          if (obj(item)) local.add(name(item.name));
      }
      for (const raw of arr(value.with)) {
        if (!obj(raw)) throw new Error('SQL_UNSUPPORTED');
        const cte = name(raw.name);
        if (!cte || cte !== cte.toLowerCase()) throw new Error('CTE_CASE');
        ctes.push(cte);
        const cteScope = new Set(local);
        if (raw.recursive) cteScope.add(cte);
        visit(raw.stmt, cteScope, depth + 1);
        local.add(cte);
      }
      for (const from of arr(value.from)) {
        if (!obj(from)) throw new Error('SQL_UNSUPPORTED');
        if (typeof from.table === 'string') {
          const isCte = !from.db && local.has(from.table.toLowerCase());
          if (isCte && from.table !== from.table.toLowerCase())
            throw new Error('CTE_CASE');
          if (!isCte) {
            const table = tableName(from);
            const aliases = tables.get(table) ?? new Set();
            if (typeof from.as === 'string') aliases.add(from.as);
            tables.set(table, aliases);
          }
        } else if (
          !from.expr ||
          (obj(from.expr) && from.expr.type === 'function')
        )
          throw new Error('TABLE_FUNCTION');
      }
      for (const [key, child] of Object.entries(value))
        if (key !== 'with') visit(child, local, depth + 1);
      return;
    }
    if (
      typeof value.type === 'string' &&
      ['insert', 'update', 'delete', 'create', 'drop', 'alter'].includes(
        value.type,
      )
    )
      throw new Error('SELECT_ONLY');
    for (const child of Object.values(value)) visit(child, scope, depth + 1);
  }
  for (const statement of statements) {
    if (!obj(statement) || statement.type !== 'select')
      throw new Error('SELECT_ONLY');
    visit(statement, new Set(), 0);
  }
  return {
    diagram: '',
    output: JSON.stringify(
      {
        tables: [...tables].map(([table, aliases]) => ({
          table,
          aliases: [...aliases],
        })),
        ctes: [...new Set(ctes)],
        statements: statements.length,
      },
      null,
      2,
    ),
  };
}
interface Column {
  name: string;
  type: string;
  primary: boolean;
  unique: boolean;
  nullable: boolean;
  foreign: boolean;
}
interface ForeignKey {
  columns: string[];
  target: string;
  references: string[];
}
interface Table {
  name: string;
  columns: Column[];
  foreignKeys: ForeignKey[];
  primaryKey: string[];
  uniqueKeys: string[][];
}
function ddlDiagram(statements: unknown[]): SqlStructureResult {
  const tables: Table[] = [];
  for (const statement of statements) {
    if (
      !obj(statement) ||
      statement.type !== 'create' ||
      statement.keyword !== 'table' ||
      statement.query_expr ||
      statement.as
    )
      throw new Error('CREATE_ONLY');
    const target = arr(statement.table)[0];
    if (!obj(target)) throw new Error('SQL_UNSUPPORTED');
    const table: Table = {
      name: tableName(target),
      columns: [],
      foreignKeys: [],
      primaryKey: [],
      uniqueKeys: [],
    };
    if (tables.some((item) => item.name === table.name))
      throw new Error('DUPLICATE_TABLE');
    const foreign = (raw: Obj, columns: string[]) => {
      const ref = raw.reference_definition;
      if (!obj(ref)) return;
      const target = arr(ref.table)[0];
      if (!obj(target)) throw new Error('SQL_UNSUPPORTED');
      const references = arr(ref.definition).map(name);
      table.foreignKeys.push({
        columns,
        target: tableName(target),
        references,
      });
    };
    for (const raw of arr(statement.create_definitions)) {
      if (!obj(raw)) throw new Error('SQL_UNSUPPORTED');
      if (raw.resource === 'column') {
        const column = name(raw.column);
        const definition = obj(raw.definition) ? raw.definition : {};
        if (!column || table.columns.some((item) => item.name === column))
          throw new Error('SQL_UNSUPPORTED');
        const primary = !!(raw.primary || raw.primary_key);
        table.columns.push({
          name: column,
          type:
            String(definition.dataType ?? 'unknown') +
            (definition.length ? `(${definition.length})` : ''),
          primary,
          unique: !!raw.unique,
          nullable:
            !primary &&
            !(
              obj(raw.nullable) &&
              String(raw.nullable.type).toLowerCase() === 'not null'
            ),
          foreign: false,
        });
        if (primary) table.primaryKey.push(column);
        if (raw.unique) table.uniqueKeys.push([column]);
        foreign(raw, [column]);
      } else if (raw.resource === 'constraint') {
        const columns = arr(raw.definition).map(name);
        const kind = String(raw.constraint_type).toLowerCase();
        if (kind === 'primary key') table.primaryKey.push(...columns);
        if (kind.startsWith('unique')) table.uniqueKeys.push(columns);
        if (kind === 'unique' && columns.length === 1) {
          const col = table.columns.find((item) => item.name === columns[0]);
          if (col) col.unique = true;
        }
        foreign(raw, columns);
      }
    }
    if (!table.columns.length || table.columns.length > 300)
      throw new Error('LIMIT');
    for (const column of table.columns) {
      if (table.primaryKey.includes(column.name)) {
        column.primary = true;
        column.nullable = false;
      }
      column.foreign = table.foreignKeys.some((fk) =>
        fk.columns.includes(column.name),
      );
    }
    if (
      table.primaryKey.some(
        (key) => !table.columns.some((column) => column.name === key),
      )
    )
      throw new Error('KEY_COLUMN');
    tables.push(table);
  }
  if (
    tables.length > 40 ||
    tables.reduce((n, t) => n + t.columns.length, 0) > 500
  )
    throw new Error('LIMIT');
  const ids = new Map(tables.map((table, index) => [table.name, `T${index}`]));
  const unresolved = new Set<string>();
  const safe = (value: string) =>
    value.replace(/[^\p{L}\p{N}_. ()-]/gu, '_').slice(0, 100);
  const diagram = ['erDiagram'];
  for (const table of tables) {
    diagram.push(`  ${ids.get(table.name)}["${safe(table.name)}"] {`);
    for (const [index, column] of table.columns.entries()) {
      const keys = [
        column.primary ? 'PK' : '',
        column.foreign ? 'FK' : '',
        column.unique ? 'UK' : '',
      ]
        .filter(Boolean)
        .join(',');
      diagram.push(
        `    ${column.type.replace(/[^\w]/g, '_')} c${index}${keys ? ' ' + keys : ''} "${safe(column.name)}"`,
      );
    }
    diagram.push('  }');
  }
  for (const table of tables)
    for (const fk of table.foreignKeys) {
      if (
        fk.columns.some(
          (name) => !table.columns.some((column) => column.name === name),
        )
      )
        throw new Error('KEY_COLUMN');
      const target = tables.find((item) => item.name === fk.target);
      if (target && !fk.references.length) fk.references = target.primaryKey;
      if (
        target &&
        (fk.references.length !== fk.columns.length ||
          fk.references.some(
            (name) => !target.columns.some((column) => column.name === name),
          ))
      )
        throw new Error('KEY_COLUMN');
      if (!ids.has(fk.target)) {
        const id = `X${unresolved.size}`;
        ids.set(fk.target, id);
        unresolved.add(fk.target);
        diagram.push(`  ${id}["${safe(fk.target)} (external)"]`);
      }
      const nullable = fk.columns.some(
        (name) => table.columns.find((c) => c.name === name)?.nullable,
      );
      const one = [table.primaryKey, ...table.uniqueKeys].some(
        (key) =>
          key.length > 0 && key.every((column) => fk.columns.includes(column)),
      );
      const identifying = fk.columns.every((column) =>
        table.primaryKey.includes(column),
      );
      diagram.push(
        `  ${ids.get(table.name)} ${one ? '|o' : '}o'}${identifying ? '--' : '..'}${nullable ? 'o|' : '||'} ${ids.get(fk.target)} : "${safe(fk.columns.join(', '))} to ${safe(fk.references.join(', '))}"`,
      );
    }
  return {
    output: JSON.stringify({ tables, unresolved: [...unresolved] }, null, 2),
    diagram: diagram.join('\n'),
  };
}
