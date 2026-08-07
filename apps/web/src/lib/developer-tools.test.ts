import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  diffEnv,
  extractOpenApiEndpoints,
  formatEnv,
  inferJsonSchema,
  mergeGitignore,
  parseCreateTable,
} from './developer-tools';

describe('developer tools', () => {
  it('covers schema, env, OpenAPI, SQL, and version helpers', () => {
    expect(inferJsonSchema({ id: 1, tags: ['a'] })).toMatchObject({
      type: 'object',
      required: ['id', 'tags'],
    });
    expect(formatEnv('TOKEN=x\nA=1\nA=2', false)).toBe('A=2\nTOKEN=********');
    expect(diffEnv('A=1', 'A=2\nB=3').map(({ status }) => status)).toEqual([
      'changed',
      'right-only',
    ]);
    expect(
      extractOpenApiEndpoints({ paths: { '/users': { get: {} } } })[0]?.id,
    ).toBe('GET /users');
    expect(
      parseCreateTable('CREATE TABLE users (id INTEGER, name TEXT)').columns,
    ).toHaveLength(2);
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.11')).toBe(-1);
    expect(compareVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
    expect(mergeGitignore(['dist\n!dist/keep', 'dist\n.env'])).toBe(
      'dist\n!dist/keep\n.env',
    );
  });
});
