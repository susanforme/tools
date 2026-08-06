export type UnitCategory =
  | 'length'
  | 'area'
  | 'mass'
  | 'volume'
  | 'speed'
  | 'data';

export type UnitDefinition = {
  id: string;
  symbol: string;
  toBase: number;
};

export const UNIT_CATEGORIES: Record<UnitCategory, readonly UnitDefinition[]> =
  {
    length: [
      { id: 'mm', symbol: 'mm', toBase: 0.001 },
      { id: 'cm', symbol: 'cm', toBase: 0.01 },
      { id: 'm', symbol: 'm', toBase: 1 },
      { id: 'km', symbol: 'km', toBase: 1_000 },
      { id: 'in', symbol: 'in', toBase: 0.0254 },
      { id: 'ft', symbol: 'ft', toBase: 0.3048 },
      { id: 'yd', symbol: 'yd', toBase: 0.9144 },
      { id: 'mi', symbol: 'mi', toBase: 1_609.344 },
    ],
    area: [
      { id: 'mm2', symbol: 'mm²', toBase: 0.000001 },
      { id: 'cm2', symbol: 'cm²', toBase: 0.0001 },
      { id: 'm2', symbol: 'm²', toBase: 1 },
      { id: 'km2', symbol: 'km²', toBase: 1_000_000 },
      { id: 'ft2', symbol: 'ft²', toBase: 0.09290304 },
      { id: 'acre', symbol: 'acre', toBase: 4_046.8564224 },
      { id: 'hectare', symbol: 'ha', toBase: 10_000 },
    ],
    mass: [
      { id: 'mg', symbol: 'mg', toBase: 0.000001 },
      { id: 'g', symbol: 'g', toBase: 0.001 },
      { id: 'kg', symbol: 'kg', toBase: 1 },
      { id: 'tonne', symbol: 't', toBase: 1_000 },
      { id: 'oz', symbol: 'oz', toBase: 0.028349523125 },
      { id: 'lb', symbol: 'lb', toBase: 0.45359237 },
    ],
    volume: [
      { id: 'ml', symbol: 'mL', toBase: 0.001 },
      { id: 'l', symbol: 'L', toBase: 1 },
      { id: 'm3', symbol: 'm³', toBase: 1_000 },
      { id: 'tsp', symbol: 'tsp', toBase: 0.00492892159375 },
      { id: 'tbsp', symbol: 'tbsp', toBase: 0.01478676478125 },
      { id: 'cup', symbol: 'cup', toBase: 0.2365882365 },
      { id: 'floz', symbol: 'fl oz', toBase: 0.0295735295625 },
      { id: 'gal', symbol: 'US gal', toBase: 3.785411784 },
    ],
    speed: [
      { id: 'mps', symbol: 'm/s', toBase: 1 },
      { id: 'kmh', symbol: 'km/h', toBase: 1 / 3.6 },
      { id: 'mph', symbol: 'mph', toBase: 0.44704 },
      { id: 'fps', symbol: 'ft/s', toBase: 0.3048 },
      { id: 'knot', symbol: 'kn', toBase: 0.5144444444444445 },
    ],
    data: [
      { id: 'b', symbol: 'B', toBase: 1 },
      { id: 'kb', symbol: 'KB', toBase: 1_000 },
      { id: 'mb', symbol: 'MB', toBase: 1_000_000 },
      { id: 'gb', symbol: 'GB', toBase: 1_000_000_000 },
      { id: 'tb', symbol: 'TB', toBase: 1_000_000_000_000 },
      { id: 'kib', symbol: 'KiB', toBase: 1_024 },
      { id: 'mib', symbol: 'MiB', toBase: 1_048_576 },
      { id: 'gib', symbol: 'GiB', toBase: 1_073_741_824 },
      { id: 'tib', symbol: 'TiB', toBase: 1_099_511_627_776 },
    ],
  };

export const DEFAULT_UNITS: Record<
  UnitCategory,
  readonly [from: string, to: string]
> = {
  length: ['m', 'ft'],
  area: ['m2', 'ft2'],
  mass: ['kg', 'lb'],
  volume: ['l', 'gal'],
  speed: ['kmh', 'mph'],
  data: ['mb', 'mib'],
};

export function convertUnit(
  value: number,
  category: UnitCategory,
  fromId: string,
  toId: string,
): number {
  const units = UNIT_CATEGORIES[category];
  const from = units.find((unit) => unit.id === fromId);
  const to = units.find((unit) => unit.id === toId);
  if (!from || !to) throw new Error('Unsupported unit');
  return (value * from.toBase) / to.toBase;
}
