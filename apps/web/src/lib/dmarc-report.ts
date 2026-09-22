export type DmarcRow = {
  ip: string;
  count: number;
  disposition: string;
  spf: string;
  dkim: string;
  domain: string;
};
export type DmarcReport = {
  organization: string;
  domain: string;
  reportId: string;
  begin: string;
  end: string;
  total: number;
  passed: number;
  rows: DmarcRow[];
  sources: {
    ip: string;
    count: number;
    spfPass: number;
    dkimPass: number;
    aligned: number;
  }[];
};
export function parseDmarc(xml: string): DmarcReport {
  if (xml.length > 20 * 1024 * 1024) throw new Error('报告不能超过 20 MB');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('不支持包含 DTD 或实体声明的 XML');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    doc.querySelector('parsererror') ||
    doc.documentElement.localName !== 'feedback'
  )
    throw new Error('无效的 DMARC 聚合报告 XML');
  const text = (parent: Element | Document, selector: string) =>
    parent.querySelector(selector)?.textContent?.trim() ?? '';
  const rows = Array.from(doc.querySelectorAll('feedback > record')).map(
    (record) => {
      const countText = text(record, 'row > count');
      const count = Number(countText);
      const ip = text(record, 'row > source_ip');
      if (
        !ip ||
        !/^\d+$/.test(countText) ||
        !Number.isSafeInteger(count) ||
        count < 0
      )
        throw new Error('报告记录缺少来源 IP 或有效邮件数量');
      const spf = text(record, 'row > policy_evaluated > spf');
      const dkim = text(record, 'row > policy_evaluated > dkim');
      if (![spf, dkim].every((value) => value === 'pass' || value === 'fail'))
        throw new Error('报告记录缺少 SPF/DKIM 对齐结果');
      return {
        ip,
        count,
        spf,
        dkim,
        disposition: text(record, 'row > policy_evaluated > disposition'),
        domain: text(record, 'identifiers > header_from'),
      };
    },
  );
  if (!rows.length) throw new Error('报告中没有记录');
  const sources = new Map<string, DmarcReport['sources'][number]>();
  let total = 0,
    passed = 0;
  for (const row of rows) {
    total += row.count;
    if (!Number.isSafeInteger(total))
      throw new Error('邮件总数超出精确计算范围');
    const aligned = row.spf === 'pass' || row.dkim === 'pass';
    if (aligned) passed += row.count;
    const source = sources.get(row.ip) ?? {
      ip: row.ip,
      count: 0,
      spfPass: 0,
      dkimPass: 0,
      aligned: 0,
    };
    source.count += row.count;
    if (row.spf === 'pass') source.spfPass += row.count;
    if (row.dkim === 'pass') source.dkimPass += row.count;
    if (aligned) source.aligned += row.count;
    sources.set(row.ip, source);
  }
  const date = (selector: string) => {
    const value = text(doc, selector);
    if (!/^\d+$/.test(value)) return '';
    const parsed = new Date(Number(value) * 1000);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '';
  };
  return {
    organization: text(doc, 'report_metadata > org_name'),
    domain: text(doc, 'policy_published > domain'),
    reportId: text(doc, 'report_metadata > report_id'),
    begin: date('date_range > begin'),
    end: date('date_range > end'),
    total,
    passed,
    rows,
    sources: [...sources.values()].sort((a, b) => b.count - a.count),
  };
}
export async function readDmarcFile(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('文件不能超过 20 MB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b)
    return new TextDecoder().decode(bytes);
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
    .getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 20 * 1024 * 1024) throw new Error('解压后报告不能超过 20 MB');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
  }
}
