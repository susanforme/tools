export const SHOPPING_UNITS = {
  g: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  jin: { dimension: 'mass', factor: 500 },
  ml: { dimension: 'volume', factor: 1 },
  l: { dimension: 'volume', factor: 1000 },
  piece: { dimension: 'count', factor: 1 },
} as const;
export type ShoppingUnit = keyof typeof SHOPPING_UNITS;
export type ShoppingDimension =
  (typeof SHOPPING_UNITS)[ShoppingUnit]['dimension'];
export type ShoppingOffer = {
  id: number;
  name: string;
  price: string;
  amount: string;
  packs: string;
  free: string;
  coupon: string;
  shipping: string;
  unit: ShoppingUnit;
};
export type OfferResult = {
  dimension: ShoppingDimension;
  total: number;
  quantity: number;
  unitPrice: number;
};

export function calculateOffer(offer: ShoppingOffer): OfferResult | null {
  const fields = [
    offer.price,
    offer.amount,
    offer.packs,
    offer.free,
    offer.coupon,
    offer.shipping,
  ];
  if (fields.some((value) => !value.trim() || !Number.isFinite(Number(value))))
    return null;
  if (
    [offer.price, offer.coupon, offer.shipping].some(
      (value) => !/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value.trim()),
    )
  )
    return null;
  const [price, amount, packs, free, coupon, shipping] = fields.map(Number);
  if (
    price < 0 ||
    amount <= 0 ||
    packs < 1 ||
    free < 0 ||
    coupon < 0 ||
    shipping < 0 ||
    !Number.isSafeInteger(packs) ||
    !Number.isSafeInteger(free)
  )
    return null;
  const unit = SHOPPING_UNITS[offer.unit];
  if (!unit || (unit.dimension === 'count' && !Number.isInteger(amount)))
    return null;
  // 金额按分计算，优惠券仅抵扣商品金额，运费另外计入。
  const subtotal = Math.round(price * 100) * packs;
  const discount = Math.round(coupon * 100);
  const totalCents = subtotal - discount + Math.round(shipping * 100);
  const quantity = amount * (packs + free) * unit.factor;
  if (
    discount > subtotal ||
    !Number.isSafeInteger(totalCents) ||
    !Number.isSafeInteger(subtotal) ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  )
    return null;
  const total = totalCents / 100;
  const unitPrice = total / quantity;
  if (!Number.isFinite(unitPrice * 1000)) return null;
  return { dimension: unit.dimension, total, quantity, unitPrice };
}

export function tapTempo(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const elapsed = taps[taps.length - 1] - taps[0];
  return elapsed > 0 ? Math.round((60000 * (taps.length - 1)) / elapsed) : null;
}

export function practiceTempo(
  start: number,
  target: number,
  increment: number,
  everyBars: number,
  bar: number,
): number {
  return Math.min(target, start + Math.floor(bar / everyBars) * increment);
}
