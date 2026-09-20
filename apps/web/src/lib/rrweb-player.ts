import {
  readReportJson,
  reportObject,
  type ReportObject,
} from './observability-report';
export type ReplayEvent = {
  type: number;
  timestamp: number;
  data?: ReportObject;
  preview?: string;
};
export type ReplayReport = {
  events: ReplayEvent[];
  duration: number;
  start: number;
  blocked: number;
  width: number;
  height: number;
};
const BLOCKED_TAGS = new Set([
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'base',
  'meta',
  'link',
]);
const URL_ATTRS = new Set([
  'src',
  'srcset',
  'href',
  'xlink:href',
  'action',
  'formaction',
  'poster',
  'data',
  'background',
  'cite',
  'ping',
  'manifest',
]);
function safeAttributes(raw: unknown): ReportObject {
  const attributes = reportObject(raw);
  const result: ReportObject = {};
  for (const [name, value] of Object.entries(attributes)) {
    const key = name.toLowerCase();
    if (
      key.startsWith('on') ||
      ['srcdoc', 'nonce', 'autofocus', 'is', 'rr_dataurl'].includes(key) ||
      URL_ATTRS.has(key)
    ) {
      result[name] =
        key === 'src' &&
        typeof value === 'string' &&
        /^data:image\/(png|jpeg|gif|webp);base64,/i.test(value)
          ? value
          : null;
    } else result[name] = value;
  }
  return result;
}
export function parseRrweb(source: string): ReplayReport {
  const parsed = readReportJson(source);
  const rawEvents = Array.isArray(parsed)
    ? parsed
    : reportObject(parsed).events;
  if (
    !Array.isArray(rawEvents) ||
    rawEvents.length < 2 ||
    rawEvents.length > 50_000
  )
    throw new Error('limit');
  let blocked = 0;
  let hasSnapshot = false;
  let width = 1024;
  let height = 768;
  const events: ReplayEvent[] = rawEvents
    .map((raw) => {
      const event = reportObject(raw);
      if (
        typeof event.type !== 'number' ||
        !Number.isInteger(event.type) ||
        event.type < 0 ||
        event.type > 6 ||
        typeof event.timestamp !== 'number' ||
        !Number.isSafeInteger(event.timestamp) ||
        event.timestamp < 0
      )
        throw new Error('invalidFormat');
      const data =
        event.data === undefined ? undefined : reportObject(event.data);
      if (
        event.type === 3 &&
        (!data ||
          typeof data.source !== 'number' ||
          !Number.isInteger(data.source) ||
          data.source < 0 ||
          data.source > 16)
      )
        throw new Error('invalidFormat');
      if (event.type === 2) {
        if (!data?.node) throw new Error('invalidFormat');
        hasSnapshot = true;
      }
      if (event.type === 4) {
        if (
          !data ||
          typeof data.width !== 'number' ||
          typeof data.height !== 'number' ||
          !Number.isFinite(data.width) ||
          !Number.isFinite(data.height) ||
          data.width <= 0 ||
          data.height <= 0 ||
          data.width > 10_000 ||
          data.height > 10_000
        )
          throw new Error('invalidFormat');
        width = data.width;
        height = data.height;
      }
      if (
        event.type === 6 ||
        (event.type === 3 && [9, 10].includes(Number(data?.source)))
      ) {
        blocked++;
        return {
          type: 5,
          timestamp: event.timestamp,
          data: { tag: 'omitted', payload: null },
        };
      }
      const stack: unknown[] = data ? [data] : [];
      let nodes = 0;
      while (stack.length) {
        const value = stack.pop();
        if (!value || typeof value !== 'object') continue;
        if (++nodes > 100_000) throw new Error('limit');
        if (Array.isArray(value)) {
          for (const child of value) stack.push(child);
          continue;
        }
        const node = value as ReportObject;
        if (
          typeof node.tagName === 'string' &&
          BLOCKED_TAGS.has(node.tagName.toLowerCase())
        ) {
          node.tagName = 'div';
          node.childNodes = [];
          node.attributes = {};
          blocked++;
        }
        if (node.attributes !== undefined && !Array.isArray(node.attributes))
          node.attributes = safeAttributes(node.attributes);
        // 属性变化记录中的 values 与快照节点使用相同校验。
        for (const child of Object.values(node)) stack.push(child);
      }
      return {
        type: event.type,
        timestamp: event.timestamp,
        ...(data ? { data } : {}),
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!hasSnapshot) throw new Error('noSnapshot');
  for (const event of events)
    event.preview = JSON.stringify(event.data ?? {}).slice(0, 300);
  const start = events[0].timestamp;
  const duration = events[events.length - 1].timestamp - start;
  if (duration > 7 * 86400_000) throw new Error('limit');
  return { events, duration, start, blocked, width, height };
}
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
export function createReplayDocument(
  nonce: string,
  engine: string,
  css: string,
): string {
  if (!/^[a-zA-Z0-9-]{20,80}$/.test(nonce)) throw new Error('invalidFormat');
  const code = `${engine}\n;(() => {
    const nonce = ${scriptJson(nonce)};
    const send = (data) => parent.postMessage({ ...data, nonce }, '*');
    let player = null, timer = null, duration = 0, playing = false;
    const state = () => send({ type: 'replay-state', time: player ? Math.max(0, Math.min(duration, player.getCurrentTime())) : 0, playing });
    window.addEventListener('error', (event) => send({ type: 'replay-error', error: event.message || 'Replay error' }));
    window.addEventListener('unhandledrejection', () => send({ type: 'replay-error', error: 'Replay error' }));
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (event.source !== parent || !data || data.nonce !== nonce) return;
      try {
        if (data.type === 'replay-init' && !player) {
          if (!Array.isArray(data.events)) return;
          player = new window.rrweb.Replayer(data.events, { root: document.getElementById('root'), UNSAFE_replayCanvas: false, showWarning: false, showDebug: false, triggerFocus: false, mouseTail: false, loadTimeout: 0 });
          duration = player.getMetaData().totalTime;
          player.on('finish', () => { playing = false; state(); });
          player.pause(0);
          timer = setInterval(state, 250);
          send({ type: 'replay-loaded' });
          state();
        } else if (player && data.type === 'replay-control') {
          if (data.command === 'play') { player.play(Math.max(0, Math.min(duration, Number(data.time) || 0))); playing = true; }
          if (data.command === 'pause') { player.pause(); playing = false; }
          if (data.command === 'seek') { player.pause(Math.max(0, Math.min(duration, Number(data.time) || 0))); playing = false; }
          if (data.command === 'speed' && [0.5, 1, 2, 4, 8].includes(data.speed)) player.setConfig({ speed: data.speed });
          state();
        }
      } catch (error) { send({ type: 'replay-error', error: error instanceof Error ? error.message : 'Replay error' }); }
    });
    window.addEventListener('pagehide', () => { clearInterval(timer); if (player) player.destroy(); });
    document.addEventListener('DOMContentLoaded', () => send({ type: 'replay-ready' }), { once: true });
  })();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; script-src-attr 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; media-src 'none'; connect-src 'none'; frame-src about:; object-src 'none'; base-uri 'none'; form-action 'none'"><style>${css.replace(/<\/style/gi, '<\\/style')}html,body{margin:0;overflow:auto}#root{position:relative}</style><script nonce="${nonce}">${code.replace(/<\/script/gi, '<\\/script')}</script></head><body><div id="root"></div></body></html>`;
}
export function readReplayMessage(
  event: Pick<MessageEvent<unknown>, 'source' | 'data'>,
  source: Window | null,
  nonce: string,
): ReportObject | null {
  if (
    !source ||
    event.source !== source ||
    !event.data ||
    typeof event.data !== 'object'
  )
    return null;
  const data = event.data as ReportObject;
  return data.nonce === nonce &&
    typeof data.type === 'string' &&
    ['replay-ready', 'replay-loaded', 'replay-state', 'replay-error'].includes(
      data.type,
    )
    ? data
    : null;
}
export function replayEventLabel(event: ReplayEvent): string {
  return event.type === 3
    ? `3:${String(event.data?.source ?? '')}`
    : String(event.type);
}
