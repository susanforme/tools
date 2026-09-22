import {
  printLines,
  sheetImages,
  studySheet,
  validNumber,
} from './study-print';
export type Seat = { name: string | null; fixed: boolean; blocked: boolean };
export function buildSeats(
  names: string[],
  rows: number,
  columns: number,
): Seat[] {
  validNumber(rows, 1, 30, true);
  validNumber(columns, 1, 20, true);
  if (
    !names.length ||
    names.length > rows * columns ||
    names.some((name) => !name.trim() || name.length > 100)
  )
    throw new Error('seats');
  return Array.from({ length: rows * columns }, (_, index) => ({
    name: names[index] ?? null,
    fixed: false,
    blocked: false,
  }));
}
export function shuffleSeats(
  seats: Seat[],
  names: string[],
  random: () => number = Math.random,
): Seat[] {
  const remaining = [...names];
  for (const seat of seats)
    if (seat.fixed && seat.name) {
      const index = remaining.indexOf(seat.name);
      if (index < 0) throw new Error('seats');
      remaining.splice(index, 1);
    }
  const available = seats.filter((seat) => !seat.fixed && !seat.blocked).length;
  if (remaining.length > available) throw new Error('seats');
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j]!, remaining[i]!];
  }
  let index = 0;
  return seats.map((seat) =>
    seat.fixed || seat.blocked
      ? { ...seat }
      : { ...seat, name: remaining[index++] ?? null },
  );
}
export function seatingImages(
  seats: Seat[],
  rows: number,
  columns: number,
  aisles: number[],
  heading: string,
): string[] {
  const sheet = studySheet();
  const ctx = sheet.context;
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(heading, 105, 12);
  const gap = 2;
  const aisle = 5;
  const width = (190 - (columns - 1) * gap - aisles.length * aisle) / columns;
  const height = Math.min(24, (255 - (rows - 1) * gap) / rows);
  if (width < 3 || height < 3) throw new Error('options');
  seats.forEach((seat, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x =
      10 +
      col * (width + gap) +
      aisles.filter((v) => v < col + 1).length * aisle;
    const y = 30 + row * (height + gap);
    if (seat.blocked) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(x, y, width, height);
      return;
    }
    ctx.strokeStyle = seat.fixed ? '#2563eb' : '#9ca3af';
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = '#111827';
    let size = Math.min(4.5, height / 3);
    let lines = printLines(ctx, seat.name ?? '', width - 1, size);
    while (lines.length * size * 1.3 > height - 2 && size > 1) {
      size -= 0.2;
      lines = printLines(ctx, seat.name ?? '', width - 1, size);
    }
    lines.forEach((line, n) =>
      ctx.fillText(
        line,
        x + width / 2,
        y + (height - lines.length * size * 1.3) / 2 + n * size * 1.3,
      ),
    );
  });
  return sheetImages([sheet]);
}
