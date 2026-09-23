export type PackageLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fold: boolean;
};
export type PackagePlan = {
  width: number;
  height: number;
  lines: PackageLine[];
  labels: Array<{ x: number; y: number; text: string }>;
};
export function packagingPlan(
  kind: string,
  width: number,
  height: number,
  depth: number,
  glue: number,
): PackagePlan {
  if (
    !['box', 'envelope', 'bag'].includes(kind) ||
    [width, height, depth, glue].some((n) => !Number.isFinite(n)) ||
    width < 10 ||
    height < 10 ||
    (kind !== 'envelope' && depth < 5) ||
    width > 400 ||
    height > 500 ||
    (kind !== 'envelope' && depth > 250) ||
    glue < 3 ||
    glue > 40 ||
    glue >= Math.min(width / 2, height, kind === 'envelope' ? Infinity : depth)
  )
    throw new Error('packageDimensions');
  const lines: PackageLine[] = [];
  const labels: PackagePlan['labels'] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, fold = false) =>
    lines.push({ x1: x1 + 5, y1: y1 + 5, x2: x2 + 5, y2: y2 + 5, fold });
  if (kind === 'envelope') {
    const side = Math.min(width / 2, height / 2);
    const bottom = height * 0.55,
      top = height * 0.55 + glue;
    const x = side,
      y = top;
    // 四个 flap 共用中央面板边，侧翼先折，底翼与顶翼重叠粘合。
    const outline = [
      [x, y],
      [x + width / 2, 0],
      [x + width, y],
      [x + width + side, y + height / 2],
      [x + width, y + height],
      [x + width - glue, y + height + bottom],
      [x + glue, y + height + bottom],
      [x, y + height],
      [0, y + height / 2],
      [x, y],
    ];
    for (let i = 1; i < outline.length; i++)
      line(outline[i - 1][0], outline[i - 1][1], outline[i][0], outline[i][1]);
    line(x, y, x + width, y, true);
    line(x, y + height, x + width, y + height, true);
    line(x, y, x, y + height, true);
    line(x + width, y, x + width, y + height, true);
    labels.push({
      x: x + width / 2 + 5,
      y: y + height / 2 + 5,
      text: `${width} x ${height} mm`,
    });
    return {
      width: width + 2 * side + 10,
      height: height + top + bottom + 10,
      lines,
      labels,
    };
  }
  const flap = depth / 2;
  const top = kind === 'bag' ? glue : flap;
  const xs = [
    glue,
    glue + width,
    glue + width + depth,
    glue + 2 * width + depth,
    glue + 2 * (width + depth),
  ];
  const bottom = top + height;
  const bevel = Math.min(glue, height / 3);
  line(0, top + bevel, glue, top);
  line(0, top + bevel, 0, bottom - bevel);
  line(0, bottom - bevel, glue, bottom);
  line(glue, top, glue, bottom, true);
  line(xs[4], top, xs[4], bottom);
  for (let i = 0; i < 4; i++) {
    const a = xs[i],
      b = xs[i + 1];
    line(a, top, b, top, true);
    line(a, bottom, b, bottom, true);
    line(a, top, a, 0);
    line(a, 0, b, 0);
    line(b, 0, b, top);
    line(a, bottom, a + 1, bottom + flap);
    line(a + 1, bottom + flap, b - 1, bottom + flap);
    line(b - 1, bottom + flap, b, bottom);
    if (i < 3) line(b, top, b, bottom, true);
    if (kind === 'bag' && (i === 1 || i === 3))
      line((a + b) / 2, top, (a + b) / 2, bottom, true);
    labels.push({
      x: (a + b) / 2 + 5,
      y: top + height / 2 + 5,
      text: `${i % 2 === 0 ? width : depth} x ${height}`,
    });
  }
  return { width: xs[4] + 10, height: top + height + flap + 10, lines, labels };
}
export async function packagingPdf(
  plan: PackagePlan,
  tiled: boolean,
): Promise<Uint8Array> {
  const {
    PDFDocument,
    StandardFonts,
    rgb,
    pushGraphicsState,
    popGraphicsState,
    rectangle,
    clip,
    endPath,
  } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const unit = 72 / 25.4;
  const areaWidth = tiled ? 190 : plan.width,
    areaHeight = tiled ? 277 : plan.height;
  const cols = Math.ceil(plan.width / areaWidth),
    rows = Math.ceil(plan.height / areaHeight);
  if (cols * rows > 40) throw new Error('sizeLimit');
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const margin = tiled ? 10 : 0;
      const pageWidth = tiled ? 210 : plan.width,
        pageHeight = tiled ? 297 : plan.height;
      const page = pdf.addPage([pageWidth * unit, pageHeight * unit]);
      page.pushOperators(
        pushGraphicsState(),
        rectangle(
          margin * unit,
          margin * unit,
          areaWidth * unit,
          areaHeight * unit,
        ),
        clip(),
        endPath(),
      );
      const x = (value: number) => (value - col * areaWidth + margin) * unit;
      const y = (value: number) =>
        (pageHeight - margin - value + row * areaHeight) * unit;
      for (const line of plan.lines)
        page.drawLine({
          start: { x: x(line.x1), y: y(line.y1) },
          end: { x: x(line.x2), y: y(line.y2) },
          thickness: 0.55,
          color: line.fold ? rgb(0.15, 0.35, 0.8) : rgb(0.8, 0.15, 0.15),
          ...(line.fold ? { dashArray: [3, 2] } : {}),
        });
      for (const label of plan.labels) {
        const size = 8;
        page.drawText(label.text, {
          x: x(label.x) - font.widthOfTextAtSize(label.text, size) / 2,
          y: y(label.y),
          size,
          font,
        });
      }
      page.pushOperators(popGraphicsState());
      if (tiled) {
        page.drawRectangle({
          x: margin * unit,
          y: margin * unit,
          width: areaWidth * unit,
          height: areaHeight * unit,
          borderColor: rgb(0.75, 0.75, 0.75),
          borderWidth: 0.3,
        });
        page.drawText(
          `${col + 1}/${cols}, ${row + 1}/${rows} - Print 100% / Actual size`,
          { x: 10 * unit, y: 5 * unit, font, size: 8 },
        );
      }
    }
  return pdf.save();
}
