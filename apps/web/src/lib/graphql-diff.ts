import type { GraphQLSchema, IntrospectionQuery } from 'graphql';

export type SchemaChange = {
  level: 'BREAKING' | 'DANGEROUS' | 'NON_BREAKING';
  type: string;
  path: string;
  message: string;
  reason: string;
};
export type SchemaDiffRequest = { before: string; after: string };
export const SCHEMA_MAX_BYTES = 2 * 1024 * 1024;

export async function compareGraphqlSchemas({
  before,
  after,
}: SchemaDiffRequest): Promise<SchemaChange[]> {
  const { buildASTSchema, buildClientSchema, parse, validateSchema } =
    await import('graphql');
  const { diff } = await import('@graphql-inspector/core');
  function schema(input: string): GraphQLSchema {
    if (new TextEncoder().encode(input).byteLength > SCHEMA_MAX_BYTES)
      throw new Error('sizeLimit');
    if (!input.trim()) throw new Error('emptyInput');
    let result: GraphQLSchema;
    if (input.trimStart().startsWith('{')) {
      const parsed: unknown = JSON.parse(input);
      const record =
        parsed !== null && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : null;
      const body = record && ('__schema' in record ? record : record.data);
      if (!body || typeof body !== 'object' || !('__schema' in body))
        throw new Error('invalidIntrospection');
      // GraphQL 自身验证 introspection 的类型、字段和引用。
      result = buildClientSchema(body as IntrospectionQuery);
    } else {
      result = buildASTSchema(parse(input, { maxTokens: 100_000 }));
    }
    const errors = validateSchema(result);
    if (errors.length)
      throw new Error(
        errors
          .slice(0, 5)
          .map((error) => error.message)
          .join('\n'),
      );
    return result;
  }
  const changes = await diff(schema(before), schema(after));
  return changes.map((change) => ({
    level: change.criticality.level,
    type: change.type,
    path: change.path ?? '',
    message: change.message,
    reason: change.criticality.reason ?? '',
  }));
}
