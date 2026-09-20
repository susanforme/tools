export const workflowProfileZh = {
  cpuProfile: {
    title: 'CPU 性能报告',
    limits:
      '支持 Chrome / Node .cpuprofile；最大 20 MiB、20,000 个节点、1,000,000 个采样点、256 层调用栈。',
    upload: '拖入或选择 .cpuprofile 文件',
    loading: '解析中…',
    cancel: '取消',
    failed: '解析失败：{{message}}',
    summary:
      '记录 {{duration}} ms · 采样覆盖 {{sampled}} ms · 未覆盖 {{uncovered}} ms · {{count}} 个采样点',
    timing:
      '按相邻采样时间间隔计时，首尾未覆盖时间不分配给函数；函数调用总耗时对递归去重。',
    search: '搜索函数或文件',
    reset: '重置缩放',
    parent: '返回上层',
    flame: '火焰图',
    flameHint: '横向宽度表示聚合耗时，点击方块缩放到对应调用。',
    clipped:
      '当前图省略过窄或超过 40 层 / 5,000 帧的分支，可从函数列表或调用树定位后继续缩放；统计仍覆盖全部样本。',
    callTree: '调用树定位',
    path: '调用路径',
    nextOccurrence: '下一个调用位置（共 {{count}} 处）',
    internal: '内部函数',
    functions: '函数耗时（{{count}}）',
    function: '函数 / 文件',
    self: '自身耗时',
    total: '调用总耗时',
    sort: '排序',
    previous: '上一页',
    next: '下一页',
    errors: {
      invalidFormat:
        '只支持包含 nodes、samples、timeDeltas 的 Chrome / Node CPU profile',
      invalidJson: 'JSON 格式无效',
      invalidTree: '调用树存在重复 ID、断开的节点、循环或多个父节点',
      invalidTiming: '采样 ID、时间间隔或记录时间范围无效',
      noSamples: '至少需要两个有正时间间隔的有效采样点',
      sizeLimit: '文件不能超过 20 MiB',
      countLimit: '超过 20,000 个节点或 1,000,000 个采样点',
      depthLimit: '调用栈不能超过 256 层',
      worker: '解析进程启动或执行失败',
    },
  },
};
export const workflowProfileEn = {
  cpuProfile: {
    title: 'CPU Profile Viewer',
    limits:
      'Chrome / Node .cpuprofile. Maximum: 20 MiB, 20,000 nodes, 1,000,000 samples, 256 stack levels.',
    upload: 'Drop or choose a .cpuprofile file',
    loading: 'Parsing…',
    cancel: 'Cancel',
    failed: 'Parsing failed: {{message}}',
    summary:
      'Recorded {{duration}} ms · Covered {{sampled}} ms · Uncovered {{uncovered}} ms · {{count}} samples',
    timing:
      'Time is measured between adjacent samples. Uncovered leading/trailing time is not assigned to functions. Inclusive function time deduplicates recursion.',
    search: 'Search function or file',
    reset: 'Reset zoom',
    parent: 'Parent call',
    flame: 'Flame graph',
    flameHint:
      'Width represents aggregated time. Select a frame to zoom into its call tree.',
    clipped:
      'Narrow branches or frames beyond 40 levels / 5,000 frames are omitted here. Locate them in the function list or call tree and zoom in. Statistics include all samples.',
    callTree: 'Call tree navigation',
    path: 'Call path',
    nextOccurrence: 'Next call site ({{count}} total)',
    internal: 'Internal function',
    functions: 'Function timings ({{count}})',
    function: 'Function / file',
    self: 'Self time',
    total: 'Inclusive time',
    sort: 'Sort',
    previous: 'Previous',
    next: 'Next',
    errors: {
      invalidFormat:
        'Expected a Chrome / Node CPU profile with nodes, samples and timeDeltas',
      invalidJson: 'Invalid JSON',
      invalidTree:
        'The call tree contains duplicate IDs, disconnected nodes, cycles or multiple parents',
      invalidTiming: 'Invalid sample ID, time delta or recording interval',
      noSamples:
        'At least two valid samples with positive elapsed time are required',
      sizeLimit: 'The file exceeds 20 MiB',
      countLimit: 'More than 20,000 nodes or 1,000,000 samples',
      depthLimit: 'The call stack exceeds 256 levels',
      worker: 'The parsing worker could not start or failed',
    },
  },
};
