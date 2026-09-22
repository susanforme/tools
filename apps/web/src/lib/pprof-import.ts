// 字段编号遵循 google/pprof proto/profile.proto，未用字段由 protobuf 解码器跳过。
export const PPROF_SCHEMA = `syntax = "proto3";
message Profile { repeated ValueType sample_type = 1; repeated Sample sample = 2; repeated Location location = 4; repeated Function function = 5; repeated string string_table = 6; int64 duration_nanos = 10; int64 default_sample_type = 14; }
message ValueType { int64 type = 1; int64 unit = 2; }
message Sample { repeated uint64 location_id = 1; repeated int64 value = 2; }
message Location { uint64 id = 1; uint64 address = 3; repeated Line line = 4; }
message Line { uint64 function_id = 1; int64 line = 2; }
message Function { uint64 id = 1; int64 name = 2; int64 filename = 4; }`;
type DecodedProfile = {
  sampleType: { type: string; unit: string }[];
  sample: { locationId: string[]; value: string[] }[];
  location: {
    id: string;
    address: string;
    line: { functionId: string; line: string }[];
  }[];
  function: { id: string; name: string; filename: string }[];
  stringTable: string[];
  durationNanos: string;
  defaultSampleType: string;
};
export type PprofResult = {
  metrics: { name: string; unit: string; total: string }[];
  rows: { name: string; file: string; self: string[]; total: string[] }[];
  stacks: { names: string[]; values: string[] }[];
  samples: number;
  defaultMetric: number;
};
export async function decodePprof(input: Uint8Array): Promise<PprofResult> {
  const limit = 20 * 1024 * 1024;
  if (input.byteLength > limit) throw new Error('sizeLimit');
  let bytes = input;
  if (input[0] === 31 && input[1] === 139) {
    const stream = new Blob([input.slice().buffer])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) throw new Error('sizeLimit');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  }
  const [protobuf, { default: Long }] = await Promise.all([
    import('protobufjs'),
    import('long'),
  ]);
  // 与现有 Protobuf 工具一致：CDN 构建需要显式启用 Long 才能保留 64 位精度。
  protobuf.util.Long = Long;
  protobuf.configure();
  const type = protobuf.parse(PPROF_SCHEMA).root.lookupType('Profile');
  const data = type.toObject(type.decode(bytes), {
    longs: String,
    defaults: true,
    arrays: true,
  }) as DecodedProfile;
  if (
    data.stringTable[0] !== '' ||
    !data.sampleType.length ||
    !data.sample.length ||
    data.sample.length > 200000 ||
    data.location.length > 100000
  )
    throw new Error('pprofFormat');
  const str = (index: string) => {
    const n = Number(index);
    if (!Number.isSafeInteger(n) || n < 0 || n >= data.stringTable.length)
      throw new Error('pprofFormat');
    return data.stringTable[n]!;
  };
  const functions = new Map(
    data.function.map((row) => [
      row.id,
      { name: str(row.name), file: str(row.filename) },
    ]),
  );
  const locations = new Map(data.location.map((row) => [row.id, row]));
  if (
    functions.size !== data.function.length ||
    locations.size !== data.location.length
  )
    throw new Error('pprofFormat');
  const metrics = data.sampleType.map((item) => ({
    name: str(item.type),
    unit: str(item.unit),
    total: 0n,
  }));
  const rows = new Map<
    string,
    { name: string; file: string; self: bigint[]; total: bigint[] }
  >();
  const stacks = new Map<string, { names: string[]; values: bigint[] }>();
  for (const sample of data.sample) {
    if (
      sample.value.length !== metrics.length ||
      sample.locationId.length > 512 ||
      !sample.locationId.length
    )
      throw new Error('pprofFormat');
    const values = sample.value.map((v) => BigInt(v));
    values.forEach((v, i) => {
      metrics[i]!.total += v;
    });
    const frames: { id: string; name: string; file: string }[] = [];
    for (const id of sample.locationId) {
      const location = locations.get(id);
      if (!location) throw new Error('pprofFormat');
      if (!location.line.length)
        frames.push({
          id: `address:${location.address}:${id}`,
          name: `0x${BigInt(location.address).toString(16)}`,
          file: '',
        });
      else
        for (const line of location.line) {
          const fn = functions.get(line.functionId);
          if (!fn) throw new Error('pprofFormat');
          frames.push({ id: line.functionId, ...fn });
        }
    }
    const seen = new Set<string>();
    frames.forEach((frame, index) => {
      const row = rows.get(frame.id) ?? {
        name: frame.name,
        file: frame.file,
        self: metrics.map(() => 0n),
        total: metrics.map(() => 0n),
      };
      values.forEach((v, i) => {
        if (!seen.has(frame.id)) row.total[i] = row.total[i]! + v;
        if (index === 0) row.self[i] = row.self[i]! + v;
      });
      seen.add(frame.id);
      rows.set(frame.id, row);
    });
    const key = frames.map((frame) => frame.id).join('/');
    const stack = stacks.get(key) ?? {
      names: frames.map((frame) => frame.name).reverse(),
      values: metrics.map(() => 0n),
    };
    values.forEach((v, i) => {
      stack.values[i] = stack.values[i]! + v;
    });
    stacks.set(key, stack);
  }
  const selected = metrics.findIndex(
    (m) => m.name === str(data.defaultSampleType),
  );
  return {
    metrics: metrics.map((row) => ({ ...row, total: row.total.toString() })),
    rows: [...rows.values()].map((row) => ({
      ...row,
      self: row.self.map(String),
      total: row.total.map(String),
    })),
    stacks: [...stacks.values()].map((row) => ({
      ...row,
      values: row.values.map(String),
    })),
    samples: data.sample.length,
    defaultMetric: selected < 0 ? metrics.length - 1 : selected,
  };
}
