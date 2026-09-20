import { expect, it } from 'vitest';
import {
  exportSarifFindings,
  filterSarifFindings,
  parseSarif,
  SARIF_MAX_BYTES,
} from './sarif-viewer';

const fixture = () => ({
  version: '2.1.0',
  runs: [
    {
      tool: {
        driver: {
          name: 'Scanner',
          globalMessageStrings: { fallback: { text: 'Global {0}' } },
          rules: [
            {
              id: 'R1',
              name: 'Rule one',
              defaultConfiguration: { level: 'error' },
              messageStrings: { problem: { text: 'Found {0}; literal {{0}}' } },
              help: { markdown: '**Fix this**' },
            },
          ],
        },
        extensions: [
          {
            name: 'Plugin',
            rules: [{ id: 'EXT', defaultConfiguration: { level: 'note' } }],
          },
        ],
      },
      originalUriBaseIds: {
        ROOT: { uri: 'file:///workspace/' },
        SRC: { uri: 'src/', uriBaseId: 'ROOT' },
      },
      artifacts: [{ location: { uri: 'main.ts', uriBaseId: 'SRC', index: 0 } }],
      invocations: [
        {
          ruleConfigurationOverrides: [
            { descriptor: { index: 0 }, configuration: { level: 'note' } },
          ],
        },
      ],
      results: [
        {
          ruleIndex: 0,
          message: { id: 'problem', arguments: ['unsafe input'] },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { index: 0 },
                region: {
                  startLine: 7,
                  startColumn: 2,
                  snippet: { text: '<script>data only</script>' },
                },
              },
            },
          ],
          relatedLocations: [
            {
              id: 3,
              message: { text: 'Other source' },
              physicalLocation: {
                artifactLocation: { uri: 'other.ts', uriBaseId: 'SRC' },
                region: { startLine: 2 },
              },
            },
          ],
          fixes: [
            {
              description: { text: 'Replace input' },
              artifactChanges: [
                {
                  artifactLocation: { index: 0 },
                  replacements: [
                    {
                      deletedRegion: {
                        startLine: 7,
                        startColumn: 2,
                        endLine: 7,
                        endColumn: 5,
                      },
                      insertedContent: { text: 'safe()' },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          ruleId: 'R1',
          message: { id: 'fallback', arguments: ['value'] },
          provenance: { invocationIndex: 0 },
        },
        {
          rule: { id: 'EXT', index: 0, toolComponent: { index: 0 } },
          message: { text: 'Extension issue' },
        },
        { ruleId: 'R1', kind: 'pass', message: { text: 'Passed' } },
      ],
    },
    {
      tool: { driver: { name: 'Second scanner' } },
      results: [
        {
          ruleId: 'OTHER',
          level: 'warning',
          message: {
            text: '<img src="https://example.invalid" onerror="alert(1)">',
          },
        },
      ],
    },
  ],
});

it('resolves rules, extension references, levels, templates, indexed artifacts and base URI chains', () => {
  const result = parseSarif(JSON.stringify(fixture()));
  expect(result.runs).toHaveLength(2);
  expect(result.findings.map((finding) => finding.level)).toEqual([
    'error',
    'note',
    'note',
    'none',
    'warning',
  ]);
  const first = result.findings[0];
  expect(first.ruleId).toBe('R1');
  expect(first.message).toBe('Found unsafe input; literal {0}');
  expect(result.findings[1].message).toBe('Global value');
  expect(first.locations[0]).toMatchObject({
    uri: 'file:///workspace/src/main.ts',
    unresolved: false,
    region: {
      startLine: 7,
      startColumn: 2,
      snippet: '<script>data only</script>',
    },
  });
  expect(first.relatedLocations[0].uri).toBe('file:///workspace/src/other.ts');
  expect(first.fixes[0].changes[0]).toMatchObject({
    uri: 'file:///workspace/src/main.ts',
    replacements: [
      { deletedRegion: { startLine: 7, endColumn: 5 }, insertedText: 'safe()' },
    ],
  });
  expect(result.rules[first.ruleKey].help).toBe('**Fix this**');
  expect(result.findings[4].message).toContain('<img');
});

it('shows unresolved cyclic and missing references without fetching or inventing a source path', () => {
  const source = {
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'Scanner' } },
        originalUriBaseIds: {
          A: { uri: 'a/', uriBaseId: 'B' },
          B: { uri: 'b/', uriBaseId: 'A' },
        },
        results: [
          {
            ruleIndex: 9,
            message: { id: 'missing' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'x.ts', uriBaseId: 'A' },
                },
              },
              { physicalLocation: { artifactLocation: { index: 99 } } },
            ],
          },
        ],
      },
    ],
  };
  const [finding] = parseSarif(JSON.stringify(source)).findings;
  expect(finding.level).toBe('warning');
  expect(finding.warnings).toEqual(
    expect.arrayContaining([
      'unresolvedRule',
      'unresolvedUri',
      'unresolvedMessage',
    ]),
  );
  expect(finding.locations.every((location) => location.unresolved)).toBe(true);
  expect(finding.locations[1].uri).toBe('[artifact:99]');
});

it('filters combined run, rule, level and resolved path and exports an explicit normalized format', () => {
  const report = parseSarif(JSON.stringify(fixture()));
  const filters = { run: '0', level: 'error', rule: 'r1', file: 'SRC/MAIN' };
  expect(
    filterSarifFindings(report.findings, filters).map((finding) => finding.id),
  ).toEqual(['0:0']);
  const exported = JSON.parse(exportSarifFindings(report, filters)) as {
    format: string;
    sourceVersion: string;
    findings: unknown[];
    rules: Record<string, unknown>;
  };
  expect(exported.format).toBe('breeze-tools/sarif-findings-v1');
  expect(exported.sourceVersion).toBe('2.1.0');
  expect(exported.findings).toHaveLength(1);
  expect(Object.keys(exported.rules)).toHaveLength(1);
});

it('does not attach another rule or component when identifiers disagree with indices', () => {
  const report = parseSarif(
    JSON.stringify({
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'Scanner',
              rules: [{ id: 'R1', defaultConfiguration: { level: 'error' } }],
            },
          },
          results: [
            { ruleId: 'R2', ruleIndex: 0, message: { text: 'Mismatch' } },
            {
              rule: {
                index: 0,
                toolComponent: { index: -1, name: 'Other scanner' },
              },
              message: { text: 'Mismatch' },
            },
          ],
        },
      ],
    }),
  );
  expect(report.findings.map((finding) => finding.level)).toEqual([
    'warning',
    'warning',
  ]);
  expect(
    report.findings.every((finding) =>
      finding.warnings.includes('unresolvedRule'),
    ),
  ).toBe(true);
});

it('distinguishes unavailable results and external properties from an empty clean report', () => {
  expect(parseSarif('{"version":"2.1.0","runs":null}').runs).toEqual([]);
  const report = parseSarif(
    JSON.stringify({
      version: '2.1.0',
      runs: [
        {
          tool: { driver: { name: 'Scanner' } },
          externalPropertyFileReferences: {
            results: [
              { location: { uri: 'https://example.invalid/results.sarif' } },
            ],
          },
        },
      ],
    }),
  );
  expect(report.runs[0]).toMatchObject({
    resultsPresent: false,
    externalData: true,
    resultCount: 0,
  });
});

it('rejects invalid structure, incompatible versions and unsafe expansion sizes', () => {
  expect(() => parseSarif('{')).toThrow('invalidJson');
  expect(() => parseSarif('{"version":"2.0.0","runs":[]}')).toThrow('version');
  expect(() => parseSarif('{"version":"2.1.0"}')).toThrow('invalidFormat');
  expect(() =>
    parseSarif(
      '{"version":"2.1.0","runs":[{"tool":{"driver":{"name":"x"}},"results":[{"message":{}}]}]}',
    ),
  ).toThrow('invalidFormat');
  expect(() => parseSarif(' '.repeat(SARIF_MAX_BYTES + 1))).toThrow(
    'sizeLimit',
  );
  const source = {
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'Scanner' } },
        results: [
          {
            message: {
              text: '{0}'.repeat(5000),
              arguments: ['x'.repeat(5000)],
            },
          },
        ],
      },
    ],
  };
  expect(() => parseSarif(JSON.stringify(source))).toThrow('outputLimit');
});
