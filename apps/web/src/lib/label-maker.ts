import {
  printLines,
  sheetImages,
  studySheet,
  validNumber,
} from './study-print';
export type LabelOptions = {
  width: number;
  height: number;
  gap: number;
  margin: number;
  font: number;
  copies: number;
  fold: boolean;
};
export function labelLayout(options: LabelOptions, count: number) {
  const { width, height, gap, margin, font, copies } = options;
  validNumber(width, 15, 190);
  validNumber(height, 10, 277);
  validNumber(gap, 0, 20);
  validNumber(margin, 5, 40);
  validNumber(font, 2, 15);
  validNumber(copies, 1, 100, true);
  validNumber(count, 1, 2000, true);
  const columns = Math.floor((210 - margin * 2 + gap) / (width + gap));
  const rows = Math.floor((297 - margin * 2 + gap) / (height + gap));
  if (!columns || !rows || Math.ceil((count * copies) / (columns * rows)) > 50)
    throw new Error('pages');
  return { columns, rows, capacity: columns * rows };
}
export function makeLabels(labels: string[], options: LabelOptions): string[] {
  const { columns, capacity } = labelLayout(options, labels.length);
  const entries = labels.flatMap((label) =>
    Array.from({ length: options.copies }, () => label),
  );
  const images: string[] = [];
  for (let page = 0; page * capacity < entries.length; page++) {
    const sheet = studySheet();
    const ctx = sheet.context;
    entries
      .slice(page * capacity, (page + 1) * capacity)
      .forEach((label, i) => {
        const x =
          options.margin + (i % columns) * (options.width + options.gap);
        const y =
          options.margin +
          Math.floor(i / columns) * (options.height + options.gap);
        ctx.strokeRect(x, y, options.width, options.height);
        const height = options.fold ? options.height / 2 : options.height;
        const draw = () => {
          let size = options.font;
          let lines = printLines(ctx, label, options.width - 4, size);
          while (lines.length * size * 1.3 > height - 4 && size > 1.5) {
            size -= 0.2;
            lines = printLines(ctx, label, options.width - 4, size);
          }
          if (lines.length * size * 1.3 > height - 4)
            throw new Error('labelText');
          ctx.textAlign = 'center';
          lines.forEach((line, index) =>
            ctx.fillText(
              line,
              options.width / 2,
              (height - lines.length * size * 1.3) / 2 + index * size * 1.3,
            ),
          );
        };
        ctx.save();
        ctx.translate(x, y + (options.fold ? height : 0));
        draw();
        ctx.restore();
        if (options.fold) {
          ctx.save();
          ctx.translate(x + options.width, y + height);
          ctx.rotate(Math.PI);
          draw();
          ctx.restore();
          ctx.setLineDash([1, 1]);
          ctx.beginPath();
          ctx.moveTo(x, y + height);
          ctx.lineTo(x + options.width, y + height);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    images.push(...sheetImages([sheet]));
  }
  return images;
}
