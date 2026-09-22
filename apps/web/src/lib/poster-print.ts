export type PosterLayout = {
  width: number;
  height: number;
  paperWidth: number;
  paperHeight: number;
  tileWidth: number;
  tileHeight: number;
  overlap: number;
  margin: number;
  columns: number;
  rows: number;
};

export function getPosterLayout(
  width: number,
  aspectRatio: number,
  orientation: string,
  overlap: number,
): PosterLayout {
  const height = width / aspectRatio;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(aspectRatio) ||
    !Number.isFinite(height) ||
    width < 10 ||
    width > 5000 ||
    aspectRatio <= 0 ||
    height < 10 ||
    height > 5000 ||
    !Number.isFinite(overlap) ||
    overlap < 0 ||
    overlap > 30 ||
    !['portrait', 'landscape'].includes(orientation)
  )
    throw new Error('invalidSize');
  const [paperWidth, paperHeight] =
    orientation === 'landscape' ? [297, 210] : [210, 297];
  const margin = 10;
  const tileWidth = paperWidth - 2 * margin;
  const tileHeight = paperHeight - 2 * margin;
  const columns = Math.max(
    1,
    Math.ceil((width - overlap - 1e-8) / (tileWidth - overlap)),
  );
  const rows = Math.max(
    1,
    Math.ceil((height - overlap - 1e-8) / (tileHeight - overlap)),
  );
  if (columns * rows > 100) throw new Error('tooManyPages');
  return {
    width,
    height,
    paperWidth,
    paperHeight,
    tileWidth,
    tileHeight,
    overlap,
    margin,
    columns,
    rows,
  };
}

export async function createPosterPdf(
  jpeg: Uint8Array,
  layout: PosterLayout,
): Promise<Uint8Array> {
  const {
    PDFDocument,
    pushGraphicsState,
    popGraphicsState,
    rectangle,
    clip,
    endPath,
    rgb,
  } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(jpeg);
  const mm = 72 / 25.4;
  const {
    width,
    height,
    paperWidth,
    paperHeight,
    tileWidth,
    tileHeight,
    overlap,
    margin,
    columns,
    rows,
  } = layout;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const page = pdf.addPage([paperWidth * mm, paperHeight * mm]);
      const offsetX = column * (tileWidth - overlap);
      const offsetY = row * (tileHeight - overlap);
      page.pushOperators(
        pushGraphicsState(),
        rectangle(margin * mm, margin * mm, tileWidth * mm, tileHeight * mm),
        clip(),
        endPath(),
      );
      page.drawImage(image, {
        x: (margin - offsetX) * mm,
        y: (paperHeight - margin - height + offsetY) * mm,
        width: width * mm,
        height: height * mm,
      });
      page.pushOperators(popGraphicsState());
      // 裁切标记仅画在打印区外，不覆盖海报。
      const right = margin + Math.min(tileWidth, width - offsetX);
      const bottom =
        paperHeight - margin - Math.min(tileHeight, height - offsetY);
      for (const x of [margin, right]) {
        for (const y of [bottom, paperHeight - margin]) {
          const dx = x === margin ? -1 : 1;
          const dy = y === bottom ? -1 : 1;
          page.drawLine({
            start: { x: (x + dx) * mm, y: y * mm },
            end: { x: (x + dx * 4) * mm, y: y * mm },
            thickness: 0.5,
            color: rgb(0, 0, 0),
          });
          page.drawLine({
            start: { x: x * mm, y: (y + dy) * mm },
            end: { x: x * mm, y: (y + dy * 4) * mm },
            thickness: 0.5,
            color: rgb(0, 0, 0),
          });
        }
      }
      page.drawText(
        `${row * columns + column + 1}/${rows * columns}  R${row + 1} C${column + 1}  |  ${width.toFixed(1)} x ${height.toFixed(1)} mm  |  100%`,
        { x: margin * mm, y: 3 * mm, size: 7 },
      );
    }
  }
  return pdf.save();
}
