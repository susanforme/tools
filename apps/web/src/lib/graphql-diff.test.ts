import { describe, expect, it } from 'vitest';
import { buildSchema, introspectionFromSchema } from 'graphql';
import { compareGraphqlSchemas } from './graphql-diff';

describe('GraphQL schema comparison', () => {
  const before =
    'enum Role { USER } type Query { user(id: ID): String old: Int role: Role }';
  const after =
    'enum Role { USER ADMIN } type Query { user(id: ID!): String added: Int role: Role }';
  it('classifies removed fields, required arguments, new enums and added fields', async () => {
    const changes = await compareGraphqlSchemas({ before, after });
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'Query.old', level: 'BREAKING' }),
        expect.objectContaining({ path: 'Query.user.id', level: 'BREAKING' }),
        expect.objectContaining({ path: 'Role.ADMIN', level: 'DANGEROUS' }),
        expect.objectContaining({ path: 'Query.added', level: 'NON_BREAKING' }),
      ]),
    );
  });
  it('accepts direct and response-wrapped introspection, ignoring schema declaration order', async () => {
    const data = introspectionFromSchema(buildSchema(before));
    expect(
      await compareGraphqlSchemas({
        before: JSON.stringify(data),
        after: JSON.stringify({ data }),
      }),
    ).toEqual([]);
    expect(
      await compareGraphqlSchemas({
        before,
        after:
          'type Query { role: Role old: Int user(id: ID): String } enum Role { USER }',
      }),
    ).toEqual([]);
  });
  it('rejects malformed introspection and invalid schemas', async () => {
    await expect(
      compareGraphqlSchemas({ before: '{}', after }),
    ).rejects.toThrow('invalidIntrospection');
    await expect(
      compareGraphqlSchemas({ before: 'type User { id: ID }', after }),
    ).rejects.toThrow('Query root type');
    await expect(
      compareGraphqlSchemas({ before: ' '.repeat(2 * 1024 * 1024 + 1), after }),
    ).rejects.toThrow('sizeLimit');
  });
});
