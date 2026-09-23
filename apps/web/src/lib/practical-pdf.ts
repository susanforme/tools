export function bookletSheets(
  count: number,
  rightBinding = false,
): Array<[number | null, number | null]> {
  if (!Number.isInteger(count) || count < 1 || count > 200)
    throw new Error('invalid');
  const padded = Math.ceil(count / 4) * 4;
  const sheets: Array<[number | null, number | null]> = [];
  for (let i = 0; i < padded / 4; i++) {
    for (const pair of [
      [padded - 1 - 2 * i, 2 * i],
      [2 * i + 1, padded - 2 - 2 * i],
    ]) {
      const pages = pair.map((page) => (page >= count ? null : page));
      sheets.push(
        (rightBinding ? pages.reverse() : pages) as [
          number | null,
          number | null,
        ],
      );
    }
  }
  return sheets;
}
export async function createBooklet(
  file: File,
  paper: string,
  margin: number,
  binding: string,
  sides: string,
): Promise<Uint8Array> {
  if (
    file.size > 20 * 1024 ** 2 ||
    !['a4', 'letter'].includes(paper) ||
    !['left', 'right'].includes(binding) ||
    !['all', 'front', 'back'].includes(sides) ||
    !Number.isFinite(margin) ||
    margin < 0 ||
    margin > 30
  )
    throw new Error('invalid');
  const { PDFDocument, degrees } = await import('pdf-lib');
  const source = await PDFDocument.load(await file.arrayBuffer());
  const sheets = bookletSheets(source.getPageCount(), binding === 'right');
  const output = await PDFDocument.create();
  const [width, height] = paper === 'a4' ? [841.8898, 595.2756] : [792, 612];
  const inset = (margin * 72) / 25.4;
  for (const [index, sheet] of sheets.entries()) {
    if (
      (sides === 'front' && index % 2) ||
      (sides === 'back' && index % 2 === 0)
    )
      continue;
    const page = output.addPage([width, height]);
    for (const [slot, pageNumber] of sheet.entries()) {
      if (pageNumber === null) continue;
      const original = source.getPage(pageNumber);
      const crop = original.getCropBox();
      const embedded = await output.embedPage(original, {
        left: crop.x,
        bottom: crop.y,
        right: crop.x + crop.width,
        top: crop.y + crop.height,
      });
      const rotation = ((original.getRotation().angle % 360) + 360) % 360;
      if (![0, 90, 180, 270].includes(rotation)) throw new Error('invalid');
      const rotated = rotation === 90 || rotation === 270;
      const visualWidth = rotated ? embedded.height : embedded.width,
        visualHeight = rotated ? embedded.width : embedded.height;
      const scale = Math.min(
        (width / 2 - inset * 2) / visualWidth,
        (height - inset * 2) / visualHeight,
      );
      const w = embedded.width * scale,
        h = embedded.height * scale;
      let x = (slot * width) / 2 + (width / 2 - visualWidth * scale) / 2;
      let y = (height - visualHeight * scale) / 2;
      if (rotation === 90) y += w;
      if (rotation === 180) {
        x += w;
        y += h;
      }
      if (rotation === 270) x += h;
      page.drawPage(embedded, {
        x,
        y,
        width: w,
        height: h,
        rotate: degrees(-rotation),
      });
    }
  }
  return output.save();
}
