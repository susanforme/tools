export type ReactCommit = {
  root: string;
  index: number;
  timestamp: number;
  duration: number;
  effects: number;
  passive: number;
  fibers: number;
};
export type ReactFiber = {
  id: string;
  name: string;
  renders: number;
  self: number;
  total: number;
  max: number;
};
export type ReactProfile = {
  commits: ReactCommit[];
  fibers: ReactFiber[];
  unnamed: number;
};
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('reactFormat');
  return v as Record<string, unknown>;
};
const number = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0)
    throw new Error('reactFormat');
  return v;
};
const pairs = (v: unknown): [number, number][] => {
  if (!Array.isArray(v)) throw new Error('reactFormat');
  return v.map((p: unknown) => {
    if (!Array.isArray(p) || p.length !== 2) throw new Error('reactFormat');
    return [number(p[0]), number(p[1])];
  });
};
export function parseReactProfiler(text: string): ReactProfile {
  if (text.length > 20 * 1024 * 1024) throw new Error('sizeLimit');
  const data = object(JSON.parse(text));
  if (data.version !== 5) throw new Error('reactVersion');
  if (!Array.isArray(data.dataForRoots) || !data.dataForRoots.length)
    throw new Error('reactFormat');
  const commits: ReactCommit[] = [],
    fibers: ReactFiber[] = [];
  let unnamed = 0;
  for (const raw of data.dataForRoots) {
    const root = object(raw);
    if (!Array.isArray(root.commitData) || !Array.isArray(root.snapshots))
      throw new Error('reactFormat');
    const rootId = number(root.rootID);
    const names = new Map<number, string>();
    for (const pair of root.snapshots) {
      if (!Array.isArray(pair) || pair.length !== 2)
        throw new Error('reactFormat');
      const node = object(pair[1]);
      if (typeof node.displayName === 'string')
        names.set(number(pair[0]), node.displayName);
    }
    // 名称也可能来自 commit 的 updater，未提供名称的 fiber 保留真实 ID。
    for (const rawCommit of root.commitData) {
      const commit = object(rawCommit);
      if (Array.isArray(commit.updaters))
        for (const rawUpdater of commit.updaters) {
          const updater = object(rawUpdater);
          if (typeof updater.displayName === 'string')
            names.set(number(updater.id), updater.displayName);
        }
    }
    const totals = new Map<number, ReactFiber>();
    root.commitData.forEach((rawCommit: unknown, index: number) => {
      const commit = object(rawCommit);
      const actual = pairs(commit.fiberActualDurations),
        self = new Map(pairs(commit.fiberSelfDurations));
      commits.push({
        root: `${String(root.displayName ?? 'Root')} #${rootId}`,
        index: index + 1,
        timestamp: number(commit.timestamp),
        duration: number(commit.duration),
        effects:
          commit.effectDuration == null ? 0 : number(commit.effectDuration),
        passive:
          commit.passiveEffectDuration == null
            ? 0
            : number(commit.passiveEffectDuration),
        fibers: actual.length,
      });
      for (const [id, duration] of actual) {
        const row = totals.get(id) ?? {
          id: `${rootId}:${id}`,
          name: names.get(id) ?? `Fiber #${id}`,
          renders: 0,
          self: 0,
          total: 0,
          max: 0,
        };
        row.renders++;
        row.self += self.get(id) ?? 0;
        row.total += duration;
        row.max = Math.max(row.max, duration);
        totals.set(id, row);
      }
    });
    for (const [id, row] of totals) {
      if (!names.has(id)) unnamed++;
      fibers.push(row);
    }
  }
  if (commits.length > 100000 || fibers.length > 100000)
    throw new Error('countLimit');
  return { commits, fibers: fibers.sort((a, b) => b.self - a.self), unnamed };
}
