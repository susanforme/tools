import { describe, expect, it } from 'vitest';
import {
  criticalPath,
  decisionSensitivity,
  examStudyPlan,
  luggageVolume,
  subscriptionForecast,
} from './next-planning-tools';

describe('planning calculators', () => {
  it('finds the longest dependent path', () => {
    expect(
      criticalPath('id,days,depends\nA,2,\nB,3,A\nC,1,A\nD,2,B|C').criticalPath,
    ).toEqual(['A', 'B', 'D']);
    expect(() => criticalPath('id,days,depends\nA,1,B\nB,1,A')).toThrow(
      /cycle/i,
    );
  });
  it('scores alternatives under weight changes', () => {
    const result = decisionSensitivity(
      'alternative,criterion,score,weight\nA,c,5,1\nB,c,8,1',
    );
    expect((result.baseline as { alternative: string }[])[0]?.alternative).toBe(
      'B',
    );
  });
  it('creates a chapter plan and excludes past due payments', () => {
    expect(examStudyPlan('Words', '2026-09-23', '2026-09-28', 4)).toContain(
      '2026-09-23,Words,learn,1,1',
    );
    const forecast = subscriptionForecast(
      'name,amount,cycle,firstDate\nCloud,12,monthly,2026-09-01',
      '2026-09-23',
    );
    expect(forecast).toContain('2026-09,0');
    expect(forecast).toContain('2026-10,12');
  });
  it('calculates volume from item dimensions', () => {
    expect(
      luggageVolume(
        'item,quantity,lengthCm,widthCm,heightCm\nBox,2,10,10,10',
        7,
      ).remainingLiters,
    ).toBe(5);
  });
});
