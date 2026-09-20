import { base64ToBytes, bytesToBase64, isRecord } from './developer-tools';
import { checkFormatSize, formatOutput, parseFormatJson } from './format-input';
export const PROTOCOL_LIMIT = 2 * 1024 * 1024;
export type ProtocolSource = string | File;
export async function sourceText(source: ProtocolSource): Promise<string> {
  if (typeof source !== 'string' && source.size > PROTOCOL_LIMIT)
    throw new Error('INPUT_TOO_LARGE');
  const text = typeof source === 'string' ? source : await source.text();
  checkFormatSize(text);
  return text;
}
export function decodeProtocolBytes(
  input: string,
  encoding: string,
): Uint8Array {
  checkFormatSize(input);
  const text = input.replace(/\s/g, '');
  if (encoding === 'hex') {
    if (!text || !/^(?:[\da-f]{2})+$/i.test(text))
      throw new Error('INVALID_HEX');
    return Uint8Array.from(text.match(/../g)!, (byte) =>
      Number.parseInt(byte, 16),
    );
  }
  if (
    !text ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      text,
    )
  )
    throw new Error('INVALID_BASE64');
  const bytes = base64ToBytes(text);
  if (bytesToBase64(bytes) !== text) throw new Error('INVALID_BASE64');
  return bytes;
}
export type IcuRequest = {
  kind: 'icu';
  message: string;
  params: string;
  locale: string;
  timeZone: string;
};
export async function processIcu(
  request: IcuRequest,
): Promise<{ output: string; info: string }> {
  checkFormatSize(request.message);
  if (request.message.length > 100_000) throw new Error('STRUCTURE_LIMIT');
  const params = parseFormatJson(request.params);
  if (
    !isRecord(params) ||
    Object.values(params).some(
      (value) =>
        value !== null &&
        !['string', 'number', 'boolean'].includes(typeof value),
    )
  )
    throw new Error('ICU_PARAMS');
  Intl.getCanonicalLocales(request.locale);
  new Intl.DateTimeFormat(request.locale, { timeZone: request.timeZone });
  const { IntlMessageFormat } = await import('intl-messageformat');
  const message = new IntlMessageFormat(
    request.message,
    request.locale,
    undefined,
    {
      ignoreTag: true,
      formatters: {
        getNumberFormat: (locale, options) =>
          new Intl.NumberFormat(locale, options as Intl.NumberFormatOptions),
        getPluralRules: (locale, options) =>
          new Intl.PluralRules(locale, options),
        getDateTimeFormat: (locale, options) =>
          new Intl.DateTimeFormat(locale, {
            ...options,
            timeZone: request.timeZone,
          }),
      },
    },
  );
  const output = String(
    message.format(params as Record<string, string | number | boolean | null>),
  );
  if (output.length > PROTOCOL_LIMIT) throw new Error('OUTPUT_TOO_LARGE');
  return {
    output,
    info: formatOutput({
      locale: message.resolvedOptions().locale,
      timeZone: request.timeZone,
      ast: message.getAst(),
    }),
  };
}
export type SshRequest = { kind: 'ssh'; input: ProtocolSource };
export async function inspectOpenSsh(
  input: string,
): Promise<Record<string, unknown>> {
  if (input.length > 65536) throw new Error('INPUT_TOO_LARGE');
  const match =
    /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp(?:256|384|521))[ \t]+([A-Za-z0-9+/]+={0,2})(?:[ \t]+([^\r\n]*))?$/.exec(
      input.trim(),
    );
  if (!match) throw new Error('SSH_PUBLIC_ONLY');
  const [, algorithm, encoded, comment = ''] = match;
  const bytes = decodeProtocolBytes(
    encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='),
    'base64',
  );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const field = (): Uint8Array => {
    if (offset + 4 > bytes.length) throw new Error('SSH_TRUNCATED');
    const length = view.getUint32(offset);
    offset += 4;
    if (length > bytes.length - offset) throw new Error('SSH_TRUNCATED');
    const result = bytes.slice(offset, offset + length);
    offset += length;
    return result;
  };
  const text = (): string =>
    new TextDecoder('utf-8', { fatal: true }).decode(field());
  if (text() !== algorithm) throw new Error('SSH_TYPE');
  let bits = 0;
  let curve: string | null = null;
  let exponent: string | null = null;
  if (algorithm === 'ssh-rsa') {
    const mpint = (): bigint => {
      const data = field();
      if (
        !data.length ||
        data[0]! & 128 ||
        (data.length > 1 && data[0] === 0 && !(data[1]! & 128))
      )
        throw new Error('SSH_MPINT');
      let value = 0n;
      for (const byte of data) value = (value << 8n) | BigInt(byte);
      if (value === 0n) throw new Error('SSH_MPINT');
      return value;
    };
    const e = mpint(),
      n = mpint();
    if (e < 3n || !(e & 1n) || e >= n || !(n & 1n))
      throw new Error('SSH_MPINT');
    bits = n.toString(2).length;
    exponent = e.toString();
  } else if (algorithm === 'ssh-ed25519') {
    if (field().length !== 32) throw new Error('SSH_LENGTH');
    bits = 256;
  } else {
    curve = text();
    const size = Number(algorithm.slice(-3));
    if (curve !== `nistp${size}`) throw new Error('SSH_TYPE');
    const point = field();
    if (point[0] !== 4 || point.length !== 1 + 2 * Math.ceil(size / 8))
      throw new Error('SSH_LENGTH');
    await crypto.subtle.importKey(
      'raw',
      point.slice().buffer,
      { name: 'ECDSA', namedCurve: `P-${size}` },
      false,
      ['verify'],
    );
    bits = size;
  }
  if (offset !== bytes.length) throw new Error('SSH_TRAILING');
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', bytes.slice().buffer),
  );
  return {
    algorithm,
    bits,
    curve,
    exponent,
    comment,
    fingerprint: `SHA256:${bytesToBase64(digest).replace(/=+$/, '')}`,
  };
}
export type MqttRequest = {
  kind: 'mqtt';
  input: ProtocolSource;
  encoding: string;
  version: 4 | 5;
};
export type MqttFrame = {
  offset: number;
  length: number;
  command: string;
  packet: unknown;
};
export async function parseMqtt(request: MqttRequest): Promise<MqttFrame[]> {
  if (typeof request.input !== 'string' && request.input.size > PROTOCOL_LIMIT)
    throw new Error('INPUT_TOO_LARGE');
  const bytes =
    typeof request.input === 'string'
      ? decodeProtocolBytes(request.input, request.encoding)
      : new Uint8Array(await request.input.arrayBuffer());
  if (!bytes.length || bytes.length > PROTOCOL_LIMIT)
    throw new Error('INPUT_TOO_LARGE');
  const [{ parser }, { Buffer }] = await Promise.all([
    import('mqtt-packet'),
    import('buffer'),
  ]);
  const frames: MqttFrame[] = [];
  let offset = 0;
  const plain = (value: unknown): unknown => {
    if (value instanceof Uint8Array)
      return {
        base64: bytesToBase64(value),
        bytes: value.length,
        text: new TextDecoder().decode(value.slice(0, 4096)),
      };
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, plain(v)]),
      );
    return value;
  };
  while (offset < bytes.length) {
    if (frames.length >= 1000) throw new Error('STRUCTURE_LIMIT');
    const start = offset;
    offset++;
    let remaining = 0,
      multiplier = 1,
      count = 0,
      byte = 0;
    do {
      if (offset >= bytes.length || count === 4)
        throw new Error(`MQTT_LENGTH:${start}`);
      byte = bytes[offset++]!;
      remaining += (byte & 127) * multiplier;
      multiplier *= 128;
      count++;
    } while (byte & 128);
    if (count > 1 && remaining < 128 ** (count - 1))
      throw new Error(`MQTT_LENGTH:${start}`);
    if (remaining > bytes.length - offset)
      throw new Error(`MQTT_TRUNCATED:${start}`);
    const end = offset + remaining;
    if (request.version === 4 && bytes[start]! >> 4 === 15)
      throw new Error('MQTT_VERSION');
    const decoder = parser({ protocolVersion: request.version });
    let error: Error | null = null;
    const packets: unknown[] = [];
    decoder.on('error', (cause: Error) => {
      error = cause;
    });
    decoder.on('packet', (packet: unknown) => packets.push(packet));
    decoder.parse(Buffer.from(bytes.subarray(start, end)));
    if (error) throw error;
    if (packets.length !== 1) throw new Error(`MQTT_TRUNCATED:${start}`);
    const packet = packets[0] as {
      cmd: string;
      protocolVersion?: number;
      protocolId?: string;
    };
    if (
      packet.cmd === 'connect' &&
      (packet.protocolVersion !== request.version ||
        packet.protocolId !== 'MQTT')
    )
      throw new Error('MQTT_VERSION');
    frames.push({
      offset: start,
      length: end - start,
      command: packet.cmd,
      packet: plain(packet),
    });
    offset = end;
  }
  formatOutput(frames);
  return frames;
}
