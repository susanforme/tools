/// <reference types="@webgpu/types" />

export interface GpuReport {
  adapter: Record<string, string | boolean>;
  features: string[];
  limits: Record<string, number>;
}
export async function inspectGpu(): Promise<GpuReport> {
  if (!navigator.gpu) throw new Error('UNSUPPORTED');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('UNSUPPORTED');
  const limits: Record<string, number> = {};
  const keys = new Set([
    ...Object.keys(adapter.limits),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(adapter.limits)),
  ]);
  keys.forEach((key) => {
    const value: unknown = Reflect.get(adapter.limits, key);
    if (typeof value === 'number') limits[key] = value;
  });
  const info = adapter.info;
  return {
    adapter: {
      vendor: info.vendor,
      architecture: info.architecture,
      device: info.device,
      description: info.description,
      isFallbackAdapter: info.isFallbackAdapter,
    },
    features: Array.from(adapter.features).sort(),
    limits,
  };
}

export interface CodecRow {
  codec: string;
  kind: 'video' | 'audio';
  encode: boolean | null;
  decode: boolean | null;
}
export interface CodecOptions {
  width: number;
  height: number;
  rate: number;
  custom: string;
}
interface Probe {
  isConfigSupported(
    config: Record<string, string | number>,
  ): Promise<{ supported?: boolean }>;
}

export async function inspectCodecs(
  options: CodecOptions,
): Promise<CodecRow[]> {
  if (
    ![options.width, options.height].every(
      (v) => Number.isInteger(v) && v >= 16 && v <= 8192,
    ) ||
    !Number.isFinite(options.rate) ||
    options.rate < 1 ||
    options.rate > 240 ||
    options.custom.length > 100
  )
    throw new Error('INVALID');
  const apis = globalThis as unknown as {
    VideoEncoder?: Probe;
    VideoDecoder?: Probe;
    AudioEncoder?: Probe;
    AudioDecoder?: Probe;
  };
  async function supported(
    api: Probe | undefined,
    config: Record<string, string | number>,
  ): Promise<boolean | null> {
    if (!api) return null;
    try {
      return (await api.isConfigSupported(config)).supported === true;
    } catch {
      return false;
    }
  }
  const videos = Array.from(
    new Set([
      'avc1.420028',
      'vp8',
      'vp09.00.40.08',
      'av01.0.08M.08',
      'hvc1.1.6.L120.B0',
      ...(options.custom.trim() ? [options.custom.trim()] : []),
    ]),
  );
  const videoRows = videos.map(async (codec): Promise<CodecRow> => {
    const [encode, decode] = await Promise.all([
      supported(apis.VideoEncoder, {
        codec,
        width: options.width,
        height: options.height,
        framerate: options.rate,
        bitrate: 2000000,
      }),
      supported(apis.VideoDecoder, {
        codec,
        codedWidth: options.width,
        codedHeight: options.height,
      }),
    ]);
    return { codec, kind: 'video', encode, decode };
  });
  const audioRows = ['opus', 'mp4a.40.2', 'flac'].map(
    async (codec): Promise<CodecRow> => {
      const config = { codec, sampleRate: 48000, numberOfChannels: 2 };
      const [encode, decode] = await Promise.all([
        supported(apis.AudioEncoder, { ...config, bitrate: 128000 }),
        supported(apis.AudioDecoder, config),
      ]);
      return { codec, kind: 'audio', encode, decode };
    },
  );
  return Promise.all([...videoRows, ...audioRows]);
}
