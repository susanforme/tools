import { nextToolsEn, nextToolsZh } from '@/i18n/locales/next-tools';
import { describe, expect, it } from 'vitest';
import { CSV_ANALYSIS_TOOLS } from './csv-analysis-tools';
import { DEVELOPER_AUDITS } from './developer-audits';
import { MEDIA_AUDITS } from './media-audits';
import { DATA_TOOLS } from './next-data-tools';
import { DEVELOPER_TOOLS } from './next-developer-tools';
import { MEDIA_TOOLS } from './next-media-tools';
import { PLANNING_TOOLS } from './next-planning-tools';
import { NEXT_WORKBENCHES } from './next-tool-catalog';
import { PLANNING_AUDITS } from './planning-audits';

describe('next workbenches', () => {
  it('registers 40 distinct operations with bilingual labels', () => {
    const tools = [
      ...DEVELOPER_TOOLS,
      ...DEVELOPER_AUDITS,
      ...DATA_TOOLS,
      ...CSV_ANALYSIS_TOOLS,
      ...MEDIA_TOOLS,
      ...MEDIA_AUDITS,
      ...PLANNING_TOOLS,
      ...PLANNING_AUDITS,
    ];
    expect(tools).toHaveLength(40);
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(40);
    expect(NEXT_WORKBENCHES).toHaveLength(4);
    for (const tool of tools) {
      expect(nextToolsZh.nextTools).toHaveProperty(tool.id);
      expect(nextToolsEn.nextTools).toHaveProperty(tool.id);
      for (const field of tool.fields) {
        expect(nextToolsZh.nextTools).toHaveProperty(field.label);
        expect(nextToolsEn.nextTools).toHaveProperty(field.label);
      }
    }
  });
});
