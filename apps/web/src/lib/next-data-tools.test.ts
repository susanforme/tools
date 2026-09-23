import { describe, expect, it } from 'vitest';
import {
  crossTabCsv,
  duplicateConflicts,
  resampleCsv,
  simplifyGeoJson,
  validateCsv,
} from './next-data-tools';

describe('data preparation', () => {
  it('cross-tabs and reports conflicting duplicate keys', () => {
    expect(
      crossTabCsv(
        'team,month,hours\nA,Jan,2\nA,Feb,3',
        'team',
        'month',
        'hours',
      ),
    ).toContain('A,3,2');
    expect(duplicateConflicts('id,name\n1,A\n1,B', 'id')).toContain(
      '"conflictingKeys": 1',
    );
  });
  it('reports row rules and daily totals', () => {
    expect(validateCsv('id,n\n,abc', 'id', 'n')).toContain('row 2: id empty');
    expect(
      resampleCsv(
        'date,v\n2026-09-01T01:00:00Z,2\n2026-09-01T02:00:00Z,3',
        'date',
        'v',
      ),
    ).toContain('2026-09-01,2,5,2.5');
  });
  it('simplifies lines while retaining endpoints', () => {
    const result = simplifyGeoJson(
      '{"type":"LineString","coordinates":[[0,0],[0.5,0.001],[1,0]]}',
      0.01,
    );
    expect(result.before).toBe(3);
    expect(result.after).toBe(2);
  });
});
