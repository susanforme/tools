export type CidrResult = {
  cidr: string;
  ip: string;
  prefix: number;
  netmask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  usableHosts: number;
  ipBinary: string;
  maskBinary: string;
};

export function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    throw new Error('无效的 IPv4 地址');
  }
  return (
    (((parts[0]! << 24) >>> 0) +
      ((parts[1]! << 16) >>> 0) +
      ((parts[2]! << 8) >>> 0) +
      (parts[3]! >>> 0)) >>>
    0
  );
}

export function intToIpv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.');
}

function toBinary(value: number): string {
  return value
    .toString(2)
    .padStart(32, '0')
    .replace(/(.{8})/g, '$1 ')
    .trim();
}

export function parseCidr(input: string): CidrResult {
  const raw = input.trim();
  const match = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/);
  if (!match) throw new Error('请输入 IPv4 或 CIDR，例如 192.168.1.10/24');

  const ip = match[1]!;
  const prefix = match[2] == null ? 32 : Number(match[2]);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error('前缀长度须在 0–32 之间');
  }

  const ipInt = ipv4ToInt(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const wildcard = ~mask >>> 0;
  const network = (ipInt & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const totalHosts = 2 ** (32 - prefix);
  const usableHosts = prefix >= 31 ? totalHosts : Math.max(0, totalHosts - 2);
  const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;
  const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;

  return {
    cidr: `${intToIpv4(network)}/${prefix}`,
    ip,
    prefix,
    netmask: intToIpv4(mask),
    wildcard: intToIpv4(wildcard),
    network: intToIpv4(network),
    broadcast: intToIpv4(broadcast),
    firstHost: intToIpv4(firstHost),
    lastHost: intToIpv4(lastHost),
    totalHosts,
    usableHosts,
    ipBinary: toBinary(ipInt),
    maskBinary: toBinary(mask),
  };
}

function parseIpv4Range(input: string): [number, number] {
  const match = input.trim().match(/^\s*([^\s-]+)\s*-\s*([^\s-]+)\s*$/);
  if (!match)
    throw new Error('请输入 IPv4 范围，例如 192.168.1.1 - 192.168.1.10');
  const start = ipv4ToInt(match[1]!);
  const end = ipv4ToInt(match[2]!);
  if (start > end) throw new Error('起始地址不能大于结束地址');
  return [start, end];
}

export function expandIpv4Range(input: string, limit = 4096): string[] {
  const [start, end] = parseIpv4Range(input);
  if (end - start + 1 > limit) throw new Error(`最多展开 ${limit} 个地址`);
  return Array.from({ length: end - start + 1 }, (_, index) =>
    intToIpv4(start + index),
  );
}

export function aggregateIpv4Range(input: string): string[] {
  let [start, end] = parseIpv4Range(input);
  const result: string[] = [];
  while (start <= end) {
    const aligned =
      start === 0
        ? 2 ** 32
        : 2 ** Math.min(32, Math.clz32(start & -start) ^ 31);
    const remaining = end - start + 1;
    const block = Math.min(aligned, 2 ** Math.floor(Math.log2(remaining)));
    result.push(`${intToIpv4(start)}/${32 - Math.log2(block)}`);
    start += block;
  }
  return result;
}
