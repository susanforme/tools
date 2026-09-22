import { escapeXml, isNumberIn, isRecord } from './creative-tools';
export type Grain = 'none' | 'width' | 'height';
export type CutPart = {
  id: string;
  name: string;
  width: number;
  height: number;
  quantity: number;
  rotate: boolean;
  grain: Grain;
};
export type CutProject = {
  version: 1;
  sheetWidth: number;
  sheetHeight: number;
  sheets: number;
  kerf: number;
  grain: Grain;
  parts: CutPart[];
};
export type CutRect = { x: number; y: number; width: number; height: number };
export type PlacedCut = CutRect & {
  name: string;
  id: string;
  rotated: boolean;
};
export type CutSheet = { parts: PlacedCut[]; free: CutRect[] };
export type CutResult = {
  sheets: CutSheet[];
  unplaced: CutPart[];
  utilization: number;
  leftover: number;
  kerfWaste: number;
};
export function validateCutProject(value: unknown): value is CutProject {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isNumberIn(value.sheetWidth, 1, 100000) &&
    isNumberIn(value.sheetHeight, 1, 100000) &&
    isNumberIn(value.sheets, 1, 50) &&
    Number.isInteger(value.sheets) &&
    isNumberIn(value.kerf, 0, 100) &&
    ['none', 'width', 'height'].includes(String(value.grain)) &&
    Array.isArray(value.parts) &&
    value.parts.length <= 50 &&
    new Set(
      value.parts.map((part: unknown) => (isRecord(part) ? part.id : null)),
    ).size === value.parts.length &&
    value.parts.every(
      (part: unknown) =>
        isRecord(part) &&
        typeof part.id === 'string' &&
        part.id.length <= 100 &&
        typeof part.name === 'string' &&
        part.name.length <= 100 &&
        isNumberIn(part.width, 1, 100000) &&
        isNumberIn(part.height, 1, 100000) &&
        isNumberIn(part.quantity, 1, 300) &&
        Number.isInteger(part.quantity) &&
        typeof part.rotate === 'boolean' &&
        ['none', 'width', 'height'].includes(String(part.grain)),
    ) &&
    value.parts.reduce((sum, part) => sum + (part as CutPart).quantity, 0) <=
      300
  );
}
export function allowedCutOrientations(
  part: CutPart,
  grain: Grain,
): Array<{ width: number; height: number; rotated: boolean }> {
  return [false, ...(part.rotate ? [true] : [])]
    .filter(
      (rotated) =>
        grain === 'none' ||
        part.grain === 'none' ||
        (rotated
          ? part.grain === 'width'
            ? 'height'
            : 'width'
          : part.grain) === grain,
    )
    .map((rotated) => ({
      width: rotated ? part.height : part.width,
      height: rotated ? part.width : part.height,
      rotated,
    }));
}
export function planCuts(project: CutProject): CutResult {
  if (!validateCutProject(project)) throw new Error('cutPlanner.invalid');
  const pieces = project.parts
    .flatMap((part) =>
      Array.from({ length: part.quantity }, (_, index) => ({
        ...part,
        id: `${part.id}-${index}`,
        quantity: 1,
      })),
    )
    .sort((a, b) => b.width * b.height - a.width * a.height);
  const sheets: CutSheet[] = [],
    unplaced: CutPart[] = [];
  for (const piece of pieces) {
    const orientations = allowedCutOrientations(piece, project.grain);
    let best: {
      sheet: number;
      free: number;
      width: number;
      height: number;
      rotated: boolean;
      score: number;
    } | null = null;
    const find = () => {
      for (const [sheetIndex, sheet] of sheets.entries())
        for (const [freeIndex, rect] of sheet.free.entries())
          for (const orientation of orientations) {
            if (
              orientation.width <= rect.width + 1e-8 &&
              orientation.height <= rect.height + 1e-8
            ) {
              const score =
                rect.width * rect.height -
                orientation.width * orientation.height;
              if (!best || score < best.score)
                best = {
                  sheet: sheetIndex,
                  free: freeIndex,
                  ...orientation,
                  score,
                };
            }
          }
    };
    find();
    if (
      !best &&
      sheets.length < project.sheets &&
      orientations.some(
        (value) =>
          value.width <= project.sheetWidth &&
          value.height <= project.sheetHeight,
      )
    ) {
      sheets.push({
        parts: [],
        free: [
          {
            x: 0,
            y: 0,
            width: project.sheetWidth,
            height: project.sheetHeight,
          },
        ],
      });
      find();
    }
    if (!best) {
      unplaced.push(piece);
      continue;
    }
    // ponytail: 面积优先的直切启发式；有最优性要求时再接精确求解器。
    const chosen = best as {
      sheet: number;
      free: number;
      width: number;
      height: number;
      rotated: boolean;
      score: number;
    };
    const sheet = sheets[chosen.sheet],
      [rect] = sheet.free.splice(chosen.free, 1);
    sheet.parts.push({
      id: piece.id,
      name: piece.name,
      x: rect.x,
      y: rect.y,
      width: chosen.width,
      height: chosen.height,
      rotated: chosen.rotated,
    });
    const right = rect.width - chosen.width - project.kerf,
      bottom = rect.height - chosen.height - project.kerf;
    if (right > bottom) {
      if (right > 0)
        sheet.free.push({
          x: rect.x + chosen.width + project.kerf,
          y: rect.y,
          width: right,
          height: rect.height,
        });
      if (bottom > 0)
        sheet.free.push({
          x: rect.x,
          y: rect.y + chosen.height + project.kerf,
          width: chosen.width,
          height: bottom,
        });
    } else {
      if (bottom > 0)
        sheet.free.push({
          x: rect.x,
          y: rect.y + chosen.height + project.kerf,
          width: rect.width,
          height: bottom,
        });
      if (right > 0)
        sheet.free.push({
          x: rect.x + chosen.width + project.kerf,
          y: rect.y,
          width: right,
          height: chosen.height,
        });
    }
  }
  const area = sheets.length * project.sheetWidth * project.sheetHeight,
    used = sheets.reduce(
      (sum, sheet) =>
        sum +
        sheet.parts.reduce(
          (total, part) => total + part.width * part.height,
          0,
        ),
      0,
    ),
    leftover = sheets.reduce(
      (sum, sheet) =>
        sum +
        sheet.free.reduce((total, rect) => total + rect.width * rect.height, 0),
      0,
    );
  return {
    sheets,
    unplaced,
    utilization: area ? (used / area) * 100 : 0,
    leftover,
    kerfWaste: Math.max(0, area - used - leftover),
  };
}
export function cutSheetSvg(project: CutProject, sheet: CutSheet): string {
  const unit = Math.max(project.sheetWidth, project.sheetHeight) / 100;
  const exportScale = 1600 / Math.max(project.sheetWidth, project.sheetHeight);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${project.sheetWidth * exportScale}" height="${project.sheetHeight * exportScale}" viewBox="0 0 ${project.sheetWidth} ${project.sheetHeight}"><rect width="100%" height="100%" fill="white" stroke="#111827" stroke-width="${unit / 4}"/>${sheet.free.map((rect) => `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="#f1f5f9" stroke="#94a3b8" stroke-width="${unit / 10}"/>`).join('')}${sheet.parts.map((part, index) => `<rect x="${part.x}" y="${part.y}" width="${part.width}" height="${part.height}" fill="${['#bfdbfe', '#bbf7d0', '#fde68a', '#fecdd3', '#ddd6fe'][index % 5]}" stroke="#334155" stroke-width="${unit / 6}"/><text x="${part.x + part.width / 2}" y="${part.y + part.height / 2}" font-family="sans-serif" font-size="${Math.min(unit * 2, part.height / 5, part.width / Math.max(part.name.length, 8))}" text-anchor="middle">${escapeXml(part.name)} ${part.width}×${part.height}${part.rotated ? ' ↻' : ''}</text>`).join('')}</svg>`;
}
