// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  fillDownCsv,
  groupPercentiles,
  missingDates,
  rollingAverage,
  unpivotCsv,
} from './csv-analysis-tools';
import {
  cacheAge,
  envReferences,
  graphqlOutline,
  npmScriptGraph,
  packageExportsAudit,
} from './developer-audits';
import {
  namespaceSvgIds,
  pdfPageSizes,
  silenceRegions,
  stretchSubtitles,
  svgAccessibility,
} from './media-audits';
import {
  eventConflicts,
  maintenanceCalendar,
  stockRunway,
  teamCapacity,
  workdayDeadline,
} from './planning-audits';

describe('20 additional operations', () => {
  it('audits development inputs', async () => {
    expect(
      await graphqlOutline('query Q { viewer { id name } }'),
    ).toMatchObject({ fields: 3, maxDepth: 2 });
    expect(
      cacheAge('max-age=60, stale-while-revalidate=30', 10, 55),
    ).toMatchObject({ state: 'stale', staleWhileRevalidate: true });
    expect(cacheAge('no-cache, max-age=60', 0, 0).state).toBe('revalidate');
    expect(cacheAge('no-store, stale-while-revalidate=30', 0, 0)).toMatchObject(
      { state: 'no-store', staleWhileRevalidate: false },
    );
    expect(envReferences('A=${B}\nB=${A}\nC=${MISSING}')).toMatchObject({
      missing: ['MISSING'],
      cycles: ['A'],
    });
    expect(
      npmScriptGraph(
        '{"scripts":{"build":"bun run typecheck","typecheck":"tsc"}}',
      ),
    ).toMatchObject({ dependencies: { build: ['typecheck'] }, missing: [] });
    expect(
      npmScriptGraph('{"scripts":{"build":"bun run --filter web build"}}')
        .missing,
    ).toEqual([]);
    expect(
      packageExportsAudit(
        '{"exports":{".":"./dist/index.js","./bad":"../outside.js"}}',
      ).invalidRelativeTargets,
    ).toEqual(['exports../bad']);
  });

  it('reshapes and checks CSV data', () => {
    expect(unpivotCsv('id,Jan,Feb\nA,1,2', 'id')).toContain('A,Feb,2');
    expect(fillDownCsv('group,item\nA,one\n,two', 'group')).toContain('A,two');
    expect(
      groupPercentiles('team,hours\nA,1\nA,3\nA,5', 'team', 'hours'),
    ).toContain('A,3,2,3,4');
    expect(missingDates('date\n2026-09-01\n2026-09-03', 'date')).toContain(
      '2026-09-02',
    );
    expect(rollingAverage('x\n2\n4\n8', 'x', 2)).toContain('8,6');
  });

  it('handles media timing, SVG references, and silence', () => {
    expect(
      stretchSubtitles('1\n00:00:01,000 --> 00:00:03,000\nHi', 2),
    ).toContain('00:00:00,500 --> 00:00:01,500');
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="a"/></defs><rect fill="url(#a)"/></svg>';
    expect(namespaceSvgIds(svg, 'icon')).toContain('url(#icon-a)');
    expect(
      svgAccessibility(
        '<svg xmlns="http://www.w3.org/2000/svg"><title>Logo</title></svg>',
      ).hasAccessibleName,
    ).toBe(true);
    expect(
      silenceRegions([new Float32Array([0, 0, 0, 1, 1])], 5, -40, 0.5),
    ).toEqual([{ start: 0, end: 0.6 }]);
  });

  it('reads PDF page dimensions without changing the document', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 400]);
    const bytes = await pdf.save();
    const file = {
      name: 'sizes.pdf',
      size: bytes.byteLength,
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    } as File;
    expect(JSON.parse(await pdfPageSizes(file))).toMatchObject([
      { page: 1, widthPt: 300, heightPt: 400 },
    ]);
  }, 15000);

  it('plans capacity, maintenance, inventory, events, and workdays', () => {
    expect(
      teamCapacity('role,hours\nBuild,80', 'role,people,hoursEach\nBuild,1,40'),
    ).toMatchObject([{ gapHours: -40 }]);
    expect(
      maintenanceCalendar(
        'item,lastDate,intervalDays\nFilter,2026-09-01,30',
        '2026-10-31',
      ),
    ).toContain('2026-10-31,Filter');
    expect(
      stockRunway(
        'item,quantity,dailyUse,reserve\nCoffee,30,2,10',
        '2026-09-01',
      ),
    ).toMatchObject([{ daysUntilReserve: 10, reorderBy: '2026-09-11' }]);
    expect(
      eventConflicts(
        'event,resource,start,end\nA,R,2026-09-01T10:00Z,2026-09-01T11:00Z\nB,R,2026-09-01T10:30Z,2026-09-01T12:00Z',
      ).conflicts,
    ).toHaveLength(1);
    expect(workdayDeadline('2026-09-25', 16, 8, '')).toMatchObject({
      deadline: '2026-09-28',
      workingDays: 2,
    });
  });
});
