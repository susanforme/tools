export const PAPER_TYPES = [
  'grid',
  'dots',
  'lined',
  'tian',
  'cornell',
  'practice',
] as const;
export type PaperType = (typeof PAPER_TYPES)[number];
export type PaperOptions = {
  type: string;
  spacing: number;
  margin: number;
  color: string;
  pages: number;
  text: string;
};
export type PaperLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
};
export type PaperSheet = {
  lines: PaperLine[];
  dots: Array<{ x: number; y: number }>;
  glyphs: Array<{
    x: number;
    y: number;
    size: number;
    text: string;
    opacity: number;
  }>;
};

export function createPaperSheets(options: PaperOptions): PaperSheet[] {
  const { type, spacing, margin, color, pages, text } = options;
  if (
    !PAPER_TYPES.includes(type as PaperType) ||
    !Number.isFinite(spacing) ||
    spacing < 3 ||
    spacing > 30 ||
    !Number.isFinite(margin) ||
    margin < 5 ||
    margin > 40 ||
    (type !== 'practice' &&
      (!Number.isInteger(pages) || pages < 1 || pages > 20)) ||
    !/^#[\da-f]{6}$/i.test(color) ||
    (type === 'practice' && spacing < 8)
  )
    throw new Error('invalidOptions');
  const chars = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
      text.replace(/\s/gu, ''),
    ),
    ({ segment }) => segment,
  );
  if (type === 'practice' && (!chars.length || chars.length > 200))
    throw new Error('invalidText');
  const columns = Math.floor((210 - margin * 2) / spacing);
  const rows = Math.floor((297 - margin * 2) / spacing);
  const count = type === 'practice' ? Math.ceil(chars.length / rows) : pages;
  if (count > 20) throw new Error('tooManyPages');
  return Array.from({ length: count }, (_, pageIndex) => {
    const sheet: PaperSheet = { lines: [], dots: [], glyphs: [] };
    const line = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      dashed = false,
    ) => sheet.lines.push({ x1, y1, x2, y2, dashed });
    const right = margin + columns * spacing;
    const bottom = margin + rows * spacing;
    if (type === 'dots') {
      for (let row = 0; row <= rows; row++)
        for (let col = 0; col <= columns; col++)
          sheet.dots.push({
            x: margin + col * spacing,
            y: margin + row * spacing,
          });
    } else if (type === 'cornell') {
      const split = margin + (210 - margin * 2) * 0.27;
      const summary = 297 - margin - 40;
      line(margin, margin, 210 - margin, margin);
      line(margin, margin, margin, 297 - margin);
      line(210 - margin, margin, 210 - margin, 297 - margin);
      line(margin, 297 - margin, 210 - margin, 297 - margin);
      line(split, margin, split, summary);
      line(margin, summary, 210 - margin, summary);
      for (let y = margin + spacing; y < summary; y += spacing)
        line(split, y, 210 - margin, y);
    } else {
      for (let row = 0; row <= rows; row++)
        line(
          margin,
          margin + row * spacing,
          type === 'lined' ? 210 - margin : right,
          margin + row * spacing,
        );
      if (type !== 'lined') {
        for (let col = 0; col <= columns; col++)
          line(margin + col * spacing, margin, margin + col * spacing, bottom);
        if (type === 'tian' || type === 'practice') {
          for (let row = 0; row < rows; row++)
            line(
              margin,
              margin + (row + 0.5) * spacing,
              right,
              margin + (row + 0.5) * spacing,
              true,
            );
          for (let col = 0; col < columns; col++)
            line(
              margin + (col + 0.5) * spacing,
              margin,
              margin + (col + 0.5) * spacing,
              bottom,
              true,
            );
        }
      }
      if (type === 'practice')
        for (let row = 0; row < rows; row++) {
          const char = chars[pageIndex * rows + row];
          if (!char) break;
          for (let col = 0; col < columns; col++)
            sheet.glyphs.push({
              x: margin + (col + 0.5) * spacing,
              y: margin + (row + 0.5) * spacing,
              size: spacing * 0.76,
              text: char,
              opacity: col === 0 ? 0.9 : 0.22,
            });
        }
    }
    return sheet;
  });
}

export async function createPaperPdf(
  options: PaperOptions,
): Promise<Uint8Array> {
  const sheets = createPaperSheets(options);
  const { PDFDocument, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const mm = 72 / 25.4;
  const color = rgb(
    ...([1, 3, 5].map(
      (index) => parseInt(options.color.slice(index, index + 2), 16) / 255,
    ) as [number, number, number]),
  );
  // 系统字体在 Canvas 中栅格化，仅字形作为图片；格线仍为矢量。
  const glyphImages = new Map<
    string,
    Awaited<ReturnType<typeof pdf.embedPng>>
  >();
  if (options.type === 'practice') {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvasError');
    context.font = '160px serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#000000';
    for (const char of new Set(
      sheets.flatMap((sheet) => sheet.glyphs.map((glyph) => glyph.text)),
    )) {
      context.clearRect(0, 0, 192, 192);
      context.fillText(char, 96, 96);
      glyphImages.set(char, await pdf.embedPng(canvas.toDataURL('image/png')));
    }
    canvas.width = canvas.height = 0;
  }
  for (const sheet of sheets) {
    const page = pdf.addPage([210 * mm, 297 * mm]);
    for (const line of sheet.lines)
      page.drawLine({
        start: { x: line.x1 * mm, y: (297 - line.y1) * mm },
        end: { x: line.x2 * mm, y: (297 - line.y2) * mm },
        color,
        thickness: 0.4,
        ...(line.dashed ? { dashArray: [2, 2] } : {}),
      });
    for (const dot of sheet.dots)
      page.drawCircle({
        x: dot.x * mm,
        y: (297 - dot.y) * mm,
        size: 0.35,
        color,
      });
    for (const glyph of sheet.glyphs) {
      const image = glyphImages.get(glyph.text)!;
      const size = glyph.size * 1.2;
      page.drawImage(image, {
        x: (glyph.x - size / 2) * mm,
        y: (297 - glyph.y - size / 2) * mm,
        width: size * mm,
        height: size * mm,
        opacity: glyph.opacity,
      });
    }
  }
  return pdf.save();
}
