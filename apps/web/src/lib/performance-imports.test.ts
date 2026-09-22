import { describe, expect, it } from 'vitest';
import { parseChromeCoverage, compareCoverage } from './coverage-import';
import { parseReactProfiler } from './react-profiler-import';
import { parseAxTree } from './ax-tree-import';
import { decodePprof, PPROF_SCHEMA } from './pprof-import';
import { matchEditorConfig } from './editorconfig-match';
import { parseGitPatch } from './git-patch';
describe('frontend imported reports', () => {
  it('unions coverage intervals, keeps null source unknown and compares removed URLs', () => {
    const before = parseChromeCoverage(
      JSON.stringify([
        {
          url: 'a',
          text: '0123456789',
          ranges: [
            { start: 0, end: 5 },
            { start: 3, end: 7 },
          ],
        },
        { url: 'missing', text: null, ranges: [] },
      ]),
    );
    expect(before[0]).toMatchObject({
      used: 7,
      unused: 3,
      uncovered: [{ start: 7, end: 10 }],
    });
    expect(before[1]!.total).toBe(null);
    expect(compareCoverage(before, [before[1]!])[0]).toMatchObject({
      status: 'removed',
      delta: -3,
    });
    expect(() =>
      parseChromeCoverage(
        '[{"url":"a","text":"x","ranges":[{"start":0,"end":2}]}]',
      ),
    ).toThrow('coverageRange');
  });
  it('reads real v5 commit pairs and distinguishes inclusive/self timings', () => {
    const result = parseReactProfiler(
      JSON.stringify({
        version: 5,
        dataForRoots: [
          {
            rootID: 1,
            displayName: 'App',
            snapshots: [[2, { displayName: 'List' }]],
            commitData: [
              {
                timestamp: 1,
                duration: 10,
                fiberActualDurations: [[2, 10]],
                fiberSelfDurations: [[2, 4]],
              },
              {
                timestamp: 30,
                duration: 3,
                fiberActualDurations: [[2, 3]],
                fiberSelfDurations: [[2, 3]],
              },
            ],
          },
        ],
      }),
    );
    expect(result.fibers[0]).toMatchObject({
      name: 'List',
      renders: 2,
      self: 7,
      total: 13,
      max: 10,
    });
    expect(() => parseReactProfiler('{"version":99}')).toThrow('reactVersion');
  });
  it('orders AX nodes by tree and rejects cycles', () => {
    const nodes = [
      { nodeId: 'b', ignored: false, parentId: 'a', role: { value: 'button' } },
      { nodeId: 'a', ignored: false, childIds: ['b'] },
    ];
    expect(
      parseAxTree(JSON.stringify({ result: { nodes } })).map((n) => [
        n.id,
        n.depth,
      ]),
    ).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
    expect(() =>
      parseAxTree(
        JSON.stringify([{ nodeId: 'a', ignored: false, childIds: ['a'] }]),
      ),
    ).toThrow('axTree');
  });
  it('resolves nested EditorConfig root, unset, brace rules and tab width', async () => {
    const files = [
      { path: '/.editorconfig', content: '[*]\ncharset = utf-8' },
      {
        path: '/src/.editorconfig',
        content:
          'root = true\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\n[*.{ts,tsx}]\nindent_size = 4\nend_of_line = unset',
      },
    ];
    const result = await matchEditorConfig(
      '/src/deep/app.ts',
      JSON.stringify(files),
    );
    expect(
      Object.fromEntries(result.properties.map((r) => [r.key, r.value])),
    ).toEqual({ indent_style: 'space', indent_size: '4', tab_width: '4' });
    expect(result.history.at(-1)?.value).toBe('unset');
    const numeric = await matchEditorConfig(
      '/file12.txt',
      JSON.stringify([
        {
          path: '/.editorconfig',
          content: '[file{1..20}.txt]\nindent_size = 8',
        },
      ]),
    );
    expect(numeric.properties[0]?.value).toBe('8');
    await expect(matchEditorConfig('/src/../secret', '[]')).rejects.toThrow(
      'editorPath',
    );
  });
  it('parses unified patch and aligns replacements without executing HTML', async () => {
    const result = await parseGitPatch(
      '--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n first\n-before\n+<script>after</script>\n',
    );
    expect(result[0]).toMatchObject({ added: 1, removed: 1 });
    expect(result[0]!.hunks[0]!.right[1]).toMatchObject({
      number: 2,
      text: '<script>after</script>',
    });
    await expect(parseGitPatch('GIT binary patch\nliteral 0')).rejects.toThrow(
      'patchBinary',
    );
  });
  it('decodes pprof exact 64-bit metrics and deduplicates recursive inclusive values', async () => {
    const protobuf = await import('protobufjs');
    const type = protobuf.parse(PPROF_SCHEMA).root.lookupType('Profile');
    const bytes = type
      .encode(
        type.fromObject({
          stringTable: ['', 'cpu', 'nanoseconds', 'work', 'app.go'],
          sampleType: [{ type: 1, unit: 2 }],
          function: [{ id: 1, name: 3, filename: 4 }],
          location: [
            { id: 1, line: [{ functionId: 1 }] },
            { id: 2, line: [{ functionId: 1 }] },
          ],
          sample: [{ locationId: [1, 2], value: ['9007199254740993'] }],
        }),
      )
      .finish();
    // 复现 CDN 包未检测到可选 Long 的生产环境。
    Object.assign(protobuf.util, { Long: null });
    protobuf.configure();
    const result = await decodePprof(bytes);
    expect(result.rows[0]).toMatchObject({
      name: 'work',
      self: ['9007199254740993'],
      total: ['9007199254740993'],
    });
    expect(result.metrics[0]?.total).toBe('9007199254740993');
    const { gzipSync } = await import('fflate');
    expect((await decodePprof(gzipSync(bytes))).samples).toBe(1);
  });
});
