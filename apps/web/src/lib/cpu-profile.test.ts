import { describe, expect, it } from 'vitest';
import { analyzeCpuProfile } from './cpu-profile';
import type { CpuNode } from './cpu-profile';
import { layoutCpuFlame } from './cpu-profile-view';

const frame = (functionName: string) => ({
  functionName,
  url: 'file.js',
  scriptId: '1',
  lineNumber: 0,
  columnNumber: 0,
});
const fixture = () => ({
  startTime: 1000,
  endTime: 1120,
  nodes: [
    { id: 1, callFrame: frame('(root)'), children: [2, 5] },
    { id: 2, callFrame: frame('recursive'), children: [3] },
    { id: 3, callFrame: frame('helper'), children: [4] },
    { id: 4, callFrame: frame('recursive') },
    { id: 5, callFrame: frame('other') },
  ],
  samples: [2, 4, 5, 1],
  timeDeltas: [10, 20, 30, 40],
});

describe('CPU profile timing and graph validation', () => {
  it('assigns each elapsed interval to the preceding sample and never double-counts recursion', () => {
    const profile = analyzeCpuProfile(JSON.stringify(fixture()));
    expect(profile.duration).toBe(120);
    expect(profile.sampled).toBe(90);
    expect(profile.uncovered).toBe(30);
    expect(
      profile.functions.find((fn) => fn.name === 'recursive'),
    ).toMatchObject({ self: 50, total: 50 });
    expect(profile.functions.find((fn) => fn.name === 'helper')).toMatchObject({
      self: 0,
      total: 30,
    });
    expect(profile.functions.find((fn) => fn.name === 'other')).toMatchObject({
      self: 40,
      total: 40,
    });
    expect(profile.nodes.reduce((sum, node) => sum + node.self, 0)).toBe(90);
    const chart = layoutCpuFlame(profile.nodes, 2);
    expect(chart.frames.find((item) => item.nodeId === 2)?.width).toBe(1000);
    expect(chart.frames.find((item) => item.nodeId === 4)?.width).toBe(600);
  });
  it('rejects cycles, disconnected/duplicate nodes and unknown samples instead of fabricating timings', () => {
    const cycle = fixture();
    cycle.nodes[3]!.children = [2];
    expect(() => analyzeCpuProfile(JSON.stringify(cycle))).toThrow(
      'invalidTree',
    );
    const duplicate = fixture();
    duplicate.nodes[1]!.id = 1;
    expect(() => analyzeCpuProfile(JSON.stringify(duplicate))).toThrow(
      'invalidTree',
    );
    const missing = fixture();
    missing.samples[0] = 999;
    expect(() => analyzeCpuProfile(JSON.stringify(missing))).toThrow(
      'invalidTiming',
    );
    const negative = fixture();
    negative.timeDeltas[1] = -1;
    expect(() => analyzeCpuProfile(JSON.stringify(negative))).toThrow(
      'invalidTiming',
    );
    const overflow = fixture();
    overflow.endTime = 1020;
    expect(() => analyzeCpuProfile(JSON.stringify(overflow))).toThrow(
      'invalidTiming',
    );
    const mismatch = fixture();
    mismatch.timeDeltas.pop();
    expect(() => analyzeCpuProfile(JSON.stringify(mismatch))).toThrow(
      'invalidTiming',
    );
  });
  it('bounds deep graph rendering while retaining zoom access to omitted descendants', () => {
    const nodes: CpuNode[] = Array.from({ length: 45 }, (_, id) => ({
      id,
      functionIndex: 0,
      parent: id ? id - 1 : null,
      children: id < 44 ? [id + 1] : [],
      self: id === 44 ? 10 : 0,
      total: 10,
    }));
    const graph = layoutCpuFlame(nodes, 0);
    expect(graph.frames).toHaveLength(40);
    expect(graph.clipped).toBe(true);
    expect(
      layoutCpuFlame(nodes, 40).frames.map((frame) => frame.nodeId),
    ).toContain(44);
  });
});
