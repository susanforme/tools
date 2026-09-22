import { escapeXml, isHex, isNumberIn, isRecord } from './creative-tools';
export type Furniture = {
  id: string;
  name: string;
  kind: 'bed' | 'desk' | 'wardrobe';
  x: number;
  y: number;
  width: number;
  depth: number;
  rotated: boolean;
  color: string;
};
export type RoomLayout = { width: number; height: number; items: Furniture[] };
export type SavedRoom = RoomLayout & { id: string; name: string };
export type RoomProject = {
  version: 1;
  current: RoomLayout;
  plans: SavedRoom[];
};
export function furnitureRect(item: Furniture): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: item.x,
    y: item.y,
    width: item.rotated ? item.depth : item.width,
    height: item.rotated ? item.width : item.depth,
  };
}
export function roomCollisions(layout: RoomLayout): string[] {
  const invalid = new Set<string>();
  layout.items.forEach((item, index) => {
    const rect = furnitureRect(item);
    if (
      rect.x < 0 ||
      rect.y < 0 ||
      rect.x + rect.width > layout.width ||
      rect.y + rect.height > layout.height
    )
      invalid.add(item.id);
    for (const other of layout.items.slice(index + 1)) {
      const b = furnitureRect(other);
      if (
        rect.x < b.x + b.width &&
        rect.x + rect.width > b.x &&
        rect.y < b.y + b.height &&
        rect.y + rect.height > b.y
      ) {
        invalid.add(item.id);
        invalid.add(other.id);
      }
    }
  });
  return [...invalid];
}
export function furnitureDistance(first: Furniture, second: Furniture): number {
  const a = furnitureRect(first),
    b = furnitureRect(second);
  return Math.hypot(
    Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width),
    Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height),
  );
}
function validateLayout(value: unknown): value is RoomLayout {
  return (
    isRecord(value) &&
    isNumberIn(value.width, 100, 3000) &&
    isNumberIn(value.height, 100, 3000) &&
    Array.isArray(value.items) &&
    value.items.length <= 50 &&
    new Set(value.items.map((item: unknown) => (isRecord(item) ? item.id : '')))
      .size === value.items.length &&
    value.items.every(
      (item: unknown) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        item.id.length <= 100 &&
        typeof item.name === 'string' &&
        item.name.length <= 80 &&
        ['bed', 'desk', 'wardrobe'].includes(String(item.kind)) &&
        ['x', 'y'].every((key) => isNumberIn(item[key], 0, 3000)) &&
        ['width', 'depth'].every((key) => isNumberIn(item[key], 10, 1000)) &&
        typeof item.rotated === 'boolean' &&
        isHex(item.color),
    )
  );
}
export function validateRoomProject(value: unknown): value is RoomProject {
  return (
    isRecord(value) &&
    value.version === 1 &&
    validateLayout(value.current) &&
    Array.isArray(value.plans) &&
    value.plans.length <= 12 &&
    value.plans.every(
      (plan: unknown) =>
        isRecord(plan) &&
        typeof plan.id === 'string' &&
        plan.id.length <= 100 &&
        typeof plan.name === 'string' &&
        plan.name.length <= 80 &&
        validateLayout(plan),
    )
  );
}
export function roomSvg(layout: RoomLayout): string {
  const font = Math.max(layout.width, layout.height) / 45;
  const exportScale = 1600 / Math.max(layout.width, layout.height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width * exportScale}" height="${layout.height * exportScale}" viewBox="0 0 ${layout.width} ${layout.height}"><rect width="100%" height="100%" fill="#ffffff" stroke="#0f172a" stroke-width="${font / 5}"/>${layout.items
    .map((item) => {
      const rect = furnitureRect(item);
      return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${item.color}" stroke="#334155" stroke-width="${font / 8}"/><text x="${rect.x + rect.width / 2}" y="${rect.y + rect.height / 2}" font-family="sans-serif" font-size="${Math.min(font, rect.width / Math.max(item.name.length, 4), rect.height / 4)}" text-anchor="middle" fill="#0f172a">${escapeXml(item.name)} ${item.width}×${item.depth}</text>`;
    })
    .join(
      '',
    )}<text x="${font}" y="${layout.height - font}" font-family="sans-serif" font-size="${font}" fill="#334155">${layout.width} × ${layout.height} cm</text></svg>`;
}
