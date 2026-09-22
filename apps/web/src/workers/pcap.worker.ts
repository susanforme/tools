import type {
  DissectSession,
  ProtoTree,
  Vector,
  WiregasmLib,
  WiregasmLoader,
} from '@goodtools/wiregasm';
import {
  PCAP_MAX_BYTES,
  validateCapture,
  type PcapRequest,
  type PcapResult,
  type PcapTree,
} from '../lib/pcap';

let lib: WiregasmLib | null = null;
let session: DissectSession | null = null;
let summary: PcapResult['summary'];
let lastFrames: PcapResult | null = null;
function array<T>(vector: Vector<T>): T[] {
  try {
    return Array.from({ length: vector.size() }, (_, index) =>
      vector.get(index),
    );
  } finally {
    (vector as Vector<T> & { delete?: () => void }).delete?.();
  }
}
async function initialize(): Promise<WiregasmLib> {
  if (lib) return lib;
  const base = __WIREGASM_ASSET_BASE__;
  const responses = await Promise.all(
    ['wiregasm.js', 'wiregasm.wasm.gz', 'wiregasm.data.gz'].map(
      async (path) => {
        const response = await fetch(base + path);
        if (!response.ok)
          throw new Error(`抓包引擎下载失败：${path} (${response.status})`);
        return response;
      },
    ),
  );
  const decompress = async (response: Response): Promise<ArrayBuffer> => {
    // Vite 开发服务会自动返回 Content-Encoding: gzip；CDN 的 .gz 则是原始压缩文件。
    const bytes = await response.arrayBuffer();
    const magic = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
    if (magic[0] !== 0x1f || magic[1] !== 0x8b) return bytes;
    return new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
    ).arrayBuffer();
  };
  const [source, wasmBinary, data] = await Promise.all([
    responses[0]!.text(),
    decompress(responses[1]!),
    decompress(responses[2]!),
  ]);
  const url = URL.createObjectURL(
    new Blob([source, '\nexport default loadWiregasm;'], {
      type: 'text/javascript',
    }),
  );
  try {
    const module = (await import(/* @vite-ignore */ url)) as {
      default: WiregasmLoader;
    };
    lib = await module.default({
      wasmBinary,
      getPreloadedPackage: () => data,
      locateFile: (path) => base + path,
    });
    if (!lib.init()) throw new Error('抓包引擎初始化失败');
    return lib;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function tree(nodes: Vector<ProtoTree>, depth = 0): PcapTree[] {
  if (depth > 24) return [];
  return array(nodes)
    .slice(0, 2000)
    .map((node) => ({
      label: node.label,
      filter: node.filter,
      children: tree(node.tree, depth + 1),
    }));
}
self.onmessage = async (event: MessageEvent<PcapRequest>) => {
  try {
    const request = event.data;
    if (request.kind === 'load') {
      if (!(request.file instanceof Blob) || request.file.size > PCAP_MAX_BYTES)
        throw new Error('文件不能超过 32 MB');
      const bytes = new Uint8Array(await request.file.arrayBuffer());
      validateCapture(bytes);
      const engine = await initialize();
      session?.delete();
      session = null;
      lastFrames = null;
      const path = engine.getUploadDirectory() + '/capture.pcap';
      engine.FS.writeFile(path, bytes);
      session = new engine.DissectSession(path);
      const loaded = session.load();
      if (loaded.code !== 0) {
        session.delete();
        session = null;
        throw new Error(loaded.error || '抓包文件解析失败');
      }
      summary = loaded.summary;
    }
    if (!session || !lib) throw new Error('请先导入抓包文件');
    if (request.kind === 'frame') {
      if (
        !Number.isInteger(request.number) ||
        request.number < 1 ||
        request.number > summary.packet_count
      )
        throw new Error('报文编号无效');
      const frame = session.getFrame(request.number);
      self.postMessage({
        result: {
          ...lastFrames,
          tree: tree(frame.tree),
          sources: array(frame.data_sources),
        },
      });
      return;
    }
    const filter = request.filter;
    if (filter.length > 2000) throw new Error('过滤表达式过长');
    const check = lib.checkFilter(filter);
    if (!check.ok) throw new Error(check.error);
    const skip = request.kind === 'frames' ? request.skip : 0;
    if (!Number.isSafeInteger(skip) || skip < 0)
      throw new Error('分页位置无效');
    const frames = session.getFrames(filter, skip, 100);
    lastFrames = {
      summary,
      columns: array(lib.getColumns()),
      frames: array(frames.frames).map((frame) => ({
        number: frame.number,
        columns: array(frame.columns),
      })),
      matched: frames.matched,
    };
    self.postMessage({ result: lastFrames });
  } catch (cause) {
    self.postMessage({ error: (cause as Error).message });
  }
};
