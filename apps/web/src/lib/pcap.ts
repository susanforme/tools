export const PCAP_MAX_BYTES = 32 * 1024 * 1024;
export type PcapRequest =
  | { kind: 'load'; file: File; filter: string }
  | { kind: 'frames'; filter: string; skip: number }
  | { kind: 'frame'; number: number };
export type PcapTree = { label: string; filter: string; children: PcapTree[] };
export type PcapResult = {
  columns: string[];
  frames: Array<{ number: number; columns: string[] }>;
  matched: number;
  summary: { packet_count: number; file_type: string; file_length: number };
  tree?: PcapTree[];
  sources?: Array<{ name: string; data: string }>;
};

export function validateCapture(bytes: Uint8Array): void {
  if (bytes.length < 12 || bytes.length > PCAP_MAX_BYTES)
    throw new Error('抓包文件须为 12 字节至 32 MB');
  const magic = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(0);
  if (
    ![0xa1b2c3d4, 0xd4c3b2a1, 0xa1b23c4d, 0x4d3cb2a1, 0x0a0d0d0a].includes(
      magic,
    )
  )
    throw new Error('不是有效的 PCAP / PCAPNG 文件');
}
