import {
  reportObject,
  reportPreview,
  reportText,
} from './observability-report';
import {
  finiteTime,
  PERFORMANCE_MAX_BYTES,
  performanceJson,
} from './performance-reports';
export type PlaywrightAction = {
  key: string;
  context: string;
  id: string;
  parent: string;
  title: string;
  start: number;
  end: number | null;
  params: string;
  result: string;
  error: string;
  log: string[];
};
export type PlaywrightNetwork = {
  key: string;
  context: string;
  method: string;
  url: string;
  status: number;
  time: number;
  start: number | null;
  details: string;
  error: string;
};
export type PlaywrightFrame = {
  key: string;
  context: string;
  time: number;
  page: string;
  resource: string;
  data: Uint8Array | null;
  mime: string;
};
export type PlaywrightReport = {
  contexts: Array<{ name: string; version: number; title: string }>;
  actions: PlaywrightAction[];
  network: PlaywrightNetwork[];
  frames: PlaywrightFrame[];
  errors: string[];
  snapshots: number;
  ignored: number;
};
function validPath(name: string): boolean {
  return (
    !!name &&
    !name.includes('\\') &&
    !name.includes('\0') &&
    !name.startsWith('/') &&
    !/^[a-z]:/i.test(name) &&
    !name.split('/').includes('..')
  );
}
export async function unzipTraceEntries(
  bytes: Uint8Array,
  accept: (name: string) => boolean,
): Promise<Map<string, Uint8Array>> {
  if (bytes.length > PERFORMANCE_MAX_BYTES) throw new Error('sizeLimit');
  // ZIP64 / 分卷不在本查看器的输入范围；先验证完整目录，避免截断归档被当成成功。
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (
      view.getUint32(end, true) === 0x06054b50 &&
      end + 22 + view.getUint16(end + 20, true) === bytes.length
    )
      break;
  }
  if (
    end < Math.max(0, bytes.length - 65557) ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0
  )
    throw new Error('invalidZip');
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryStart = view.getUint32(end + 16, true);
  if (
    !count ||
    count > 5000 ||
    view.getUint16(end + 8, true) !== count ||
    directoryStart + directorySize !== end
  )
    throw new Error('invalidZip');
  let cursor = directoryStart;
  for (let entry = 0; entry < count; entry++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error('invalidZip');
    cursor +=
      46 +
      view.getUint16(cursor + 28, true) +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true);
  }
  if (cursor !== end) throw new Error('invalidZip');
  const { Unzip, UnzipInflate } = await import('fflate');
  const entries = new Map<string, Uint8Array>();
  const names = new Set<string>();
  let total = 0;
  let active = 0;
  const unzip = new Unzip((file) => {
    if (!validPath(file.name) || names.has(file.name))
      throw new Error('invalidZip');
    names.add(file.name);
    if (names.size > 5000) throw new Error('limit');
    if (!accept(file.name)) return;
    if (file.originalSize !== undefined && file.originalSize > 32 * 1024 * 1024)
      throw new Error('zipLimit');
    const chunks: Uint8Array[] = [];
    let size = 0;
    active++;
    file.ondata = (error, chunk, final) => {
      if (error) throw new Error('invalidZip');
      size += chunk.length;
      total += chunk.length;
      if (size > 32 * 1024 * 1024 || total > 96 * 1024 * 1024) {
        file.terminate();
        throw new Error('zipLimit');
      }
      chunks.push(chunk);
      if (final) {
        const data = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          data.set(chunk, offset);
          offset += chunk.length;
        }
        entries.set(file.name, data);
        active--;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    for (let offset = 0; offset < bytes.length; offset += 1024)
      unzip.push(
        bytes.subarray(offset, offset + 1024),
        offset + 1024 >= bytes.length,
      );
  } catch (cause) {
    const code = (cause as Error).message;
    throw new Error(
      ['limit', 'zipLimit', 'invalidZip'].includes(code) ? code : 'invalidZip',
    );
  }
  if (active || names.size !== count) throw new Error('invalidZip');
  return entries;
}
function imageMime(bytes: Uint8Array): string {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return '';
}
export async function parsePlaywrightTrace(
  bytes: Uint8Array,
): Promise<PlaywrightReport> {
  const entries = await unzipTraceEntries(bytes, (name) =>
    /\.(trace|network)$/.test(name),
  );
  if (![...entries.keys()].some((name) => name.endsWith('.trace')))
    throw new Error('invalidFormat');
  const result: PlaywrightReport = {
    contexts: [],
    actions: [],
    network: [],
    frames: [],
    errors: [],
    snapshots: 0,
    ignored: 0,
  };
  const actions = new Map<string, PlaywrightAction>();
  let lines = 0;
  for (const [name, bytes] of entries) {
    const context = name.replace(/\.(trace|network)$/, '');
    let version: number | null = null;
    for (const line of new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (++lines > 100_000 || line.length > 8 * 1024 * 1024)
        throw new Error('limit');
      const event = reportObject(performanceJson(line));
      const type = reportText(event.type);
      const callId = reportText(event.callId);
      const key = `${context}:${callId}`;
      if (type === 'context-options') {
        version = Number(event.version);
        if (!Number.isInteger(version) || version < 6 || version > 9)
          throw new Error('traceVersion');
        result.contexts.push({
          name: context,
          version,
          title: reportText(event.title),
        });
        continue;
      }
      if (type === 'before' || type === 'action') {
        if (!callId || actions.has(key)) throw new Error('invalidFormat');
        actions.set(key, {
          key,
          context,
          id: callId,
          parent: reportText(event.parentId),
          title:
            reportText(event.title ?? event.apiName) ||
            `${reportText(event.class)}.${reportText(event.method)}`,
          start: finiteTime(event.startTime),
          end: type === 'action' ? finiteTime(event.endTime) : null,
          params: reportPreview(event.params ?? {}),
          result: event.result === undefined ? '' : reportPreview(event.result),
          error: event.error === undefined ? '' : reportPreview(event.error),
          log: [],
        });
      } else if (type === 'after') {
        const action = actions.get(key);
        if (!action) {
          result.ignored++;
          continue;
        }
        action.end = finiteTime(event.endTime);
        if (action.end < action.start) throw new Error('invalidFormat');
        action.error =
          event.error === undefined ? '' : reportPreview(event.error);
        action.result =
          event.result === undefined ? '' : reportPreview(event.result);
      } else if (type === 'log') {
        const action = actions.get(key);
        if (action && action.log.length < 100)
          action.log.push(reportText(event.message));
      } else if (
        type === 'error' ||
        (type === 'console' && event.messageType === 'error')
      )
        result.errors.push(reportText(event.message ?? event.text));
      else if (type === 'resource-snapshot') {
        const snapshot = reportObject(event.snapshot);
        const request = reportObject(snapshot.request),
          response = reportObject(snapshot.response);
        result.network.push({
          key: `${context}:network:${result.network.length}`,
          context,
          method: reportText(request.method),
          url: reportText(request.url),
          status: finiteTime(response.status),
          time: finiteTime(snapshot.time ?? 0),
          start:
            snapshot._monotonicTime === undefined
              ? null
              : finiteTime(snapshot._monotonicTime),
          details: reportPreview(snapshot),
          error: reportText(response._failureText),
        });
      } else if (type === 'screencast-frame' || type === 'screenshot') {
        const file = reportText(event.file);
        const sha1 = reportText(event.sha1);
        const resource = file || (sha1 ? `resources/${sha1}` : '');
        if (!validPath(resource)) throw new Error('invalidFormat');
        result.frames.push({
          key: `${context}:frame:${result.frames.length}`,
          context,
          time: finiteTime(event.timestamp),
          page: reportText(event.pageId),
          resource,
          data: null,
          mime: '',
        });
      } else if (type === 'frame-snapshot') result.snapshots++;
      else if (!['input', 'event', 'stdout', 'stderr'].includes(type))
        result.ignored++;
      if (
        actions.size > 20_000 ||
        result.network.length > 50_000 ||
        result.frames.length > 2000 ||
        result.errors.length > 5000
      )
        throw new Error('limit');
    }
    // version 6 test.trace 不含header；其它trace需由ZIP中的context header确认版本。
    if (
      name.endsWith('.trace') &&
      version === null &&
      !name.endsWith('test.trace')
    )
      throw new Error('traceVersion');
  }
  if (!result.contexts.length) throw new Error('traceVersion');
  result.actions = [...actions.values()].sort((a, b) => a.start - b.start);
  result.frames.sort((a, b) => a.time - b.time);
  const resources = new Set(result.frames.map((frame) => frame.resource));
  const images = await unzipTraceEntries(bytes, (name) => resources.has(name));
  let imageBytes = 0;
  for (const frame of result.frames) {
    const data = images.get(frame.resource);
    if (!data) continue;
    const mime = imageMime(data);
    if (!mime) continue;
    imageBytes += data.length;
    if (imageBytes > 32 * 1024 * 1024 || data.length > 8 * 1024 * 1024)
      throw new Error('zipLimit');
    frame.data = data;
    frame.mime = mime;
  }
  return result;
}
