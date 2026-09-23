import { nextToolsEn, nextToolsZh } from '@/i18n/locales/next-tools';
import { describe, expect, it } from 'vitest';
import { DATA_TOOLS } from './next-data-tools';
import { DEVELOPER_TOOLS } from './next-developer-tools';
import { MEDIA_TOOLS } from './next-media-tools';
import { PLANNING_TOOLS } from './next-planning-tools';
import { NEXT_WORKBENCHES } from './next-tool-catalog';

describe('next workbenches', () => {
  it('registers 20 distinct operations with bilingual labels', () => {
    const tools = [...DEVELOPER_TOOLS, ...DATA_TOOLS, ...MEDIA_TOOLS, ...PLANNING_TOOLS];
    expect(tools).toHaveLength(20);
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(20);
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
