export function parsePageSelection(value: string, pageCount: number): number[] {
  const pages: number[] = [];
  for (const part of value.split(',')) {
    const [rawStart, rawEnd = rawStart] = part.trim().split('-');
    const start = Number(rawStart);
    const end = Number(rawEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
      throw new Error('页码格式无效');
    }
    for (let page = start; page <= end; page += 1) {
      if (page < 1 || page > pageCount) throw new Error('页码超出范围');
      pages.push(page - 1);
    }
  }
  if (!pages.length) throw new Error('请输入页码');
  return pages;
}
