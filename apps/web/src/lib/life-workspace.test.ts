import { describe, it, expect } from 'vitest';
import {
  validTrip,
  zonedTime,
  tripAnalysis,
  tripIcs,
  recipeCost,
  validRun,
  runTimeline,
  validAssets,
  assetIcs,
  validQuestions,
  scoreQuestions,
  drawQuestions,
  type TripPlan,
  type Question,
} from './life-workspace-data';
import {
  validFamily,
  familyKinship,
  exportGedcom,
  importGedcom,
  type FamilyTree,
} from './family-tree-model';
describe('batch 5 life tools', () => {
  it('uses actual instants across zones and rejects DST gaps/ambiguity', () => {
    expect(zonedTime('2026-09-23T09:00', 'Asia/Shanghai')).toBe(
      Date.parse('2026-09-23T01:00Z'),
    );
    expect(() => zonedTime('2026-03-08T02:30', 'America/New_York')).toThrow(
      'zoneTime',
    );
    expect(() => zonedTime('2026-11-01T01:30', 'America/New_York')).toThrow(
      'zoneTime',
    );
    const trip: TripPlan = {
      title: 'Trip',
      currency: 'CNY',
      budget: 500,
      stops: [
        {
          id: '1',
          title: 'Flight',
          kind: 'transport',
          place: 'Airport',
          start: '2026-09-23T09:00',
          end: '2026-09-23T11:00',
          zone: 'Asia/Shanghai',
          endZone: 'Asia/Shanghai',
          cost: 100,
          note: '',
        },
        {
          id: '2',
          title: 'Call',
          kind: 'visit',
          place: 'Online',
          start: '2026-09-23T02:00',
          end: '2026-09-23T03:00',
          zone: 'UTC',
          endZone: 'UTC',
          cost: 0,
          note: '',
        },
      ],
    };
    expect(tripAnalysis(trip).conflicts).toEqual([['1', '2']]);
    expect(tripIcs(trip)).toContain('DTSTART:20260923T010000Z');
  });
  it('calculates recipe loss and margin and shifts every later run segment', () => {
    const r = recipeCost(
      [
        {
          id: '1',
          name: 'Flour',
          used: 900,
          packageAmount: 1000,
          price: 10,
          loss: 10,
        },
      ],
      10,
      1,
      0,
      50,
    );
    expect(r.total).toBeCloseTo(20);
    expect(r.unit).toBeCloseTo(2);
    expect(r.price).toBeCloseTo(4);
    const rows = runTimeline({
      title: 'Event',
      start: '2026-09-23T09:00',
      segments: [
        {
          id: 'a',
          title: 'A',
          minutes: 10,
          delay: 5,
          owner: '',
          equipment: '',
          cue: '',
        },
        {
          id: 'b',
          title: 'B',
          minutes: 20,
          delay: 0,
          owner: '',
          equipment: '',
          cue: '',
        },
      ],
    });
    expect(rows[1].start - rows[0].start).toBe(600000);
    expect(new Date(rows[1].start).getMinutes()).toBe(15);
  });
  it('keeps receipts in backup and exports only outstanding loan reminders', () => {
    const asset = {
      id: '1',
      name: 'Camera',
      purchased: '2026-01-01',
      warranty: '2027-01-01',
      borrower: 'A',
      loaned: '2026-09-01',
      due: '2026-09-05',
      returned: '',
      repairs: [],
      attachment: {
        name: 'receipt.pdf',
        type: 'application/pdf',
        data: 'data:application/pdf;base64,JVBERi0=',
      },
    };
    expect(validAssets([asset])).toBe(true);
    expect(assetIcs([asset]).match(/BEGIN:VEVENT/g) ?? []).toHaveLength(2);
    expect(
      assetIcs([{ ...asset, returned: '2026-09-03' }]).match(/BEGIN:VEVENT/g) ??
        [],
    ).toHaveLength(1);
    expect(assetIcs([asset])).toContain('TRIGGER:-P1D');
    expect(validAssets([{ ...asset, due: '2026-08-01' }])).toBe(false);
  });
  it('grades all question modes and draws without replacement', () => {
    const base = {
      category: 'math',
      stem: 'Question',
      explanation: 'Reason',
      points: 2,
    };
    const questions: Question[] = [
      { ...base, id: 'a', kind: 'single', options: ['A', 'B'], correct: ['A'] },
      {
        ...base,
        id: 'b',
        kind: 'multiple',
        options: ['A', 'B', 'C'],
        correct: ['A', 'B'],
      },
      {
        ...base,
        id: 'c',
        kind: 'boolean',
        options: ['true', 'false'],
        correct: ['true'],
      },
      { ...base, id: 'd', kind: 'blank', options: [], correct: ['hello'] },
    ];
    expect(
      scoreQuestions(questions, {
        a: ['A'],
        b: ['B', 'A'],
        c: ['true'],
        d: [' ＨＥＬＬＯ '],
      }).earned,
    ).toBe(8);
    expect(scoreQuestions(questions, { b: ['A'] }).earned).toBe(0);
    expect(
      new Set(drawQuestions(questions, 'math', 4).map((q) => q.id)).size,
    ).toBe(4);
    expect(() => drawQuestions(questions, 'missing', 1)).toThrow(
      'questionCount',
    );
    expect(validQuestions([{ ...questions[0], correct: ['C'] }])).toBe(false);
  });
  it('roundtrips GEDCOM including isolated parent links and computes paternal titles', async () => {
    const tree: FamilyTree = {
      members: [
        {
          id: 'g',
          name: 'Grandfather',
          sex: 'M',
          birth: '1950-01-01',
          death: '',
        },
        { id: 'f', name: 'Father', sex: 'M', birth: '1980', death: '' },
        { id: 'm', name: 'Mother', sex: 'F', birth: 'ABT 1982', death: '' },
        { id: 'c', name: 'Child', sex: 'F', birth: '2005-01-01', death: '' },
      ],
      links: [
        { id: '1', kind: 'parent', from: 'g', to: 'f' },
        { id: '2', kind: 'parent', from: 'f', to: 'c' },
        { id: '3', kind: 'parent', from: 'm', to: 'c' },
      ],
    };
    expect(validFamily(tree)).toBe(true);
    const result = await familyKinship(tree, 'c', 'g');
    expect(result.titles).toContain('爷爷');
    const imported = importGedcom(exportGedcom(tree));
    expect(imported.tree.members.map((m) => [m.name, m.birth])).toEqual(
      tree.members.map((m) => [m.name, m.birth]),
    );
    expect(imported.tree.links).toHaveLength(3);
    expect(imported.omitted).toBe(0);
    expect(
      validFamily({
        ...tree,
        links: [...tree.links, { id: '4', kind: 'parent', from: 'c', to: 'g' }],
      }),
    ).toBe(false);
    expect(() =>
      importGedcom(exportGedcom(tree).replace('@I1@ INDI', '@I2@ INDI')),
    ).toThrow();
  });
  it('rejects malformed backup records without throwing', () => {
    for (const input of [null, {}, [null], [{ id: '1' }]]) {
      expect(() => validAssets(input)).not.toThrow();
      expect(validAssets(input)).toBe(false);
      expect(() => validQuestions(input)).not.toThrow();
      expect(validQuestions(input)).toBe(false);
    }
    expect(
      validTrip({ title: '', currency: 'CNY', budget: 0, stops: [null] }),
    ).toBe(false);
    expect(
      validRun({ title: '', start: '2026-02-30T09:00', segments: [] }),
    ).toBe(false);
    expect(validFamily({ members: [null], links: [] })).toBe(false);
  });
});
