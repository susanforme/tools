import { feature, features } from 'caniuse-lite';
import { describe, expect, it } from 'vitest';
import { parseAst } from './ast-explorer';
import { analyzeCompatibility, supportStatus } from './browser-compat';
import { debugPathRules } from './path-rule-debugger';
import { compareSbom, parseSbom } from './sbom-viewer';

describe('AST explorer', () => {
  it('parses TS syntax and keeps exact UTF-16 ranges and parent links', async () => {
    const source =
      'const emoji = "😀";\ninterface User { name: string }\nconst greet = (user: User) => user.name;';
    const result = await parseAst({ source, syntax: 'ts' });
    const identifier = result.nodes.find(
      (node) => node.type === 'Identifier' && node.summary === 'greet',
    )!;
    expect(source.slice(identifier.start, identifier.end)).toBe('greet');
    expect(identifier.line).toBe(3);
    expect(result.nodes[identifier.parent!]!.children).toContain(identifier.id);
    expect(
      result.nodes.some((node) => node.type === 'TSInterfaceDeclaration'),
    ).toBe(true);
    expect(
      (
        await parseAst({ source: 'const x = <div />', syntax: 'tsx' })
      ).nodes.some((node) => node.type === 'JSXElement'),
    ).toBe(true);
  });
  it('rejects malformed JS and oversized source without evaluating it', async () => {
    await expect(
      parseAst({ source: 'const = 1', syntax: 'js' }),
    ).rejects.toThrow();
    await expect(
      parseAst({ source: ' '.repeat(512 * 1024 + 1), syntax: 'ts' }),
    ).rejects.toThrow('LIMIT');
    expect(
      (
        await parseAst({
          source: 'throw new Error("must not execute")',
          syntax: 'js',
        })
      ).nodes[0]?.type,
    ).toBe('Program');
  });
});
describe('Glob and Gitignore are distinct semantics', () => {
  it('honors ignored ancestors, escaped comments, negation and rule line attribution', async () => {
    const result = await debugPathRules({
      mode: 'gitignore',
      rules: 'dist/\n!dist/keep.js\n*.log\n!keep.log\n\\#file',
      paths: 'dist/keep.js\nerror.log\nkeep.log\n#file\n../escape\n/absolute',
      dot: false,
      caseSensitive: true,
    });
    expect(result.rows.map((row) => [row.matched, row.invalid])).toEqual([
      [true, false],
      [true, false],
      [false, false],
      [true, false],
      [false, true],
      [false, true],
    ]);
    expect(result.rows[1]?.rules[0]).toBe('3: *.log');
    expect(result.rows[0]?.rules[0]).toBe('1: dist/');
  });
  it('supports glob braces, global exclusions, extglobs and dot options', async () => {
    const base = {
      mode: 'glob' as const,
      rules: '**/*.{ts,js}\n!**/*.test.ts',
      paths: 'src/app.ts\nsrc/app.test.ts\n.hidden.ts\nsrc/readme.md',
      dot: false,
      caseSensitive: true,
    };
    expect((await debugPathRules(base)).rows.map((row) => row.matched)).toEqual(
      [true, false, false, false],
    );
    expect(
      (await debugPathRules({ ...base, dot: true })).rows[2]?.matched,
    ).toBe(true);
    expect(
      (
        await debugPathRules({
          ...base,
          rules: 'src/!(skip).ts',
          paths: 'src/app.ts\nsrc/skip.ts',
        })
      ).rows.map((row) => row.matched),
    ).toEqual([true, false]);
    expect(
      (
        await debugPathRules({ ...base, rules: '!*.log', paths: 'a.js\na.log' })
      ).rows.map((row) => row.matched),
    ).toEqual([true, false]);
    await expect(debugPathRules({ ...base, rules: '[' })).rejects.toThrow();
  });
});
describe('Browser compatibility data', () => {
  it('distinguishes partial, prefixed, disabled, missing and full support', () => {
    expect(
      ['y', 'a #1', 'y x', 'y d', 'n', 'p', 'u'].map(supportStatus),
    ).toEqual([
      'supported',
      'partial',
      'partial',
      'partial',
      'unsupported',
      'unsupported',
      'unknown',
    ]);
  });
  it('resolves explicit browsers and uses the pinned feature data without external requests', async () => {
    const result = await analyzeCompatibility(
      { query: 'chrome 120, ie 11', feature: 'css-grid' },
      async (id) => feature(features[id]!),
    );
    expect(result.version).toBe('1.0.30001810');
    expect(result.date).toBe('2026-08-24');
    expect(result.rows.find((row) => row.browser === 'chrome')?.status).toBe(
      'supported',
    );
    expect(result.rows.find((row) => row.browser === 'ie')?.status).toBe(
      'partial',
    );
    expect(result.coverage).toBeGreaterThanOrEqual(0);
    await expect(
      analyzeCompatibility({
        query: 'extends local-package',
        feature: 'css-grid',
      }),
    ).rejects.toThrow('QUERY_UNSUPPORTED');
    await expect(
      analyzeCompatibility({ query: 'defaults', feature: '../../escape' }),
    ).rejects.toThrow('FEATURE');
  });
});
const cdx = (version: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    components: [
      {
        'bom-ref': 'a',
        name: 'lib',
        version,
        purl: `pkg:npm/lib@${version}`,
        licenses: [{ license: { id: 'MIT' } }],
        components: [{ 'bom-ref': 'b', name: 'child', version: '1' }],
      },
    ],
    dependencies: [{ ref: 'a', dependsOn: ['b'] }],
    vulnerabilities: [
      {
        id: 'CVE-fixture',
        affects: [{ ref: 'a' }],
        ratings: [{ severity: 'high' }],
        analysis: { state: 'in_triage' },
      },
    ],
    ...extra,
  });
describe('SBOM viewer and comparison', () => {
  it('reads nested CycloneDX components, licenses, dependency edges and existing vulnerability records', () => {
    const report = parseSbom(cdx('1'));
    expect(report.components).toHaveLength(2);
    expect(report.components.find((item) => item.id === 'a')?.licenses).toEqual(
      ['MIT'],
    );
    expect(report.edges[0]).toEqual({ from: 'a', to: 'b', type: 'DEPENDS_ON' });
    expect(report.vulnerabilities[0]?.state).toBe('in_triage');
    expect(report.unresolved).toBe(0);
  });
  it('reads SPDX packages and preserves explicit relationship direction and unknown references', () => {
    const report = parseSbom(
      JSON.stringify({
        spdxVersion: 'SPDX-2.3',
        SPDXID: 'SPDXRef-DOCUMENT',
        packages: [
          {
            SPDXID: 'SPDXRef-A',
            name: 'lib',
            versionInfo: '2',
            licenseDeclared: 'MIT',
            licenseConcluded: 'NOASSERTION',
            externalRefs: [
              { referenceType: 'purl', referenceLocator: 'pkg:npm/lib@2' },
            ],
          },
        ],
        relationships: [
          {
            spdxElementId: 'SPDXRef-DOCUMENT',
            relationshipType: 'DESCRIBES',
            relatedSpdxElement: 'SPDXRef-A',
          },
          {
            spdxElementId: 'SPDXRef-A',
            relationshipType: 'DEPENDENCY_OF',
            relatedSpdxElement: 'DocumentRef-external:SPDXRef-root',
          },
        ],
      }),
    );
    expect(report.components[0]?.identity).toBe('pkg:npm/lib');
    expect(report.components[0]?.licenses).toEqual(['MIT', 'NOASSERTION']);
    expect(report.edges[1]?.type).toBe('DEPENDENCY_OF');
    expect(report.unresolved).toBe(1);
    expect(report.vulnerabilities).toEqual([]);
  });
  it('compares versionless identities and dependency/vulnerability changes without merging versions', () => {
    const before = parseSbom(cdx('1'));
    const after = parseSbom(
      cdx('2', { dependencies: [], vulnerabilities: [] }),
    );
    const change = compareSbom(before, after).find(
      (item) => item.name === 'lib',
    )!;
    expect(change.status).toBe('changed');
    expect(change.before).toEqual(['1']);
    expect(change.after).toEqual(['2']);
    expect(change.dependencyChanged).toBe(true);
    expect(change.vulnerabilityChanged).toBe(true);
    const identical = compareSbom(before, parseSbom(cdx('1')));
    expect(identical.every((item) => item.status === 'unchanged')).toBe(true);
    const multiple = parseSbom(
      cdx('1', {
        components: [
          { 'bom-ref': 'a', name: 'lib', version: '1', purl: 'pkg:npm/lib@1' },
          { 'bom-ref': 'b', name: 'lib', version: '2', purl: 'pkg:npm/lib@2' },
        ],
      }),
    );
    expect(
      compareSbom(before, multiple).find((item) => item.name === 'lib')?.after,
    ).toEqual(['1', '2']);
  });
  it('rejects unsupported formats, duplicate IDs and malformed required fields', () => {
    expect(() => parseSbom('{')).toThrow('SBOM_JSON');
    expect(() => parseSbom('{"spdxVersion":"SPDX-3.0"}')).toThrow(
      'SBOM_FORMAT',
    );
    expect(() =>
      parseSbom(
        cdx('1', {
          components: [
            { 'bom-ref': 'a', name: 'a' },
            { 'bom-ref': 'a', name: 'b' },
          ],
        }),
      ),
    ).toThrow('DUPLICATE_ID');
    expect(() => parseSbom(cdx('1', { components: [{}] }))).toThrow(
      'SBOM_STRUCTURE',
    );
  });
});
