import { describe, expect, it } from 'vitest';
import {
  calculateOffer,
  practiceTempo,
  tapTempo,
  type ShoppingOffer,
} from './shopping-music-tools';

const offer: ShoppingOffer = {
  id: 1,
  name: '',
  price: '10',
  amount: '500',
  packs: '2',
  free: '1',
  coupon: '3',
  shipping: '2',
  unit: 'g',
};

describe('shopping and music tools', () => {
  it('normalizes pack quantities and subtracts one coupon before adding shipping', () => {
    expect(calculateOffer(offer)).toEqual({
      dimension: 'mass',
      total: 19,
      quantity: 1500,
      unitPrice: 19 / 1500,
    });
    expect(calculateOffer({ ...offer, amount: '0.5', unit: 'kg' })).toEqual(
      calculateOffer(offer),
    );
    expect(calculateOffer({ ...offer, amount: '1', unit: 'jin' })).toEqual(
      calculateOffer(offer),
    );
    expect(
      calculateOffer({ ...offer, amount: '0.5', unit: 'l' })?.dimension,
    ).toBe('volume');
    expect(
      calculateOffer({ ...offer, amount: '10', unit: 'piece' })?.quantity,
    ).toBe(30);
  });
  it('rejects empty, negative, fractional packs and overflowing quantities', () => {
    for (const patch of [
      { price: '' },
      { price: 'Infinity' },
      { price: '-1' },
      { amount: '0' },
      { packs: '1.5' },
      { free: '-1' },
      { coupon: '21' },
      { shipping: 'NaN' },
      { amount: '1e309' },
      { amount: '1.5', unit: 'piece' as const },
    ])
      expect(calculateOffer({ ...offer, ...patch })).toBeNull();
    expect(
      calculateOffer({ ...offer, price: '0', coupon: '0', shipping: '0' })
        ?.total,
    ).toBe(0);
    expect(
      calculateOffer({
        ...offer,
        price: '0.1',
        packs: '3',
        coupon: '0',
        shipping: '0',
      })?.total,
    ).toBe(0.3);
  });
  it('averages tap intervals and increases tempo only after complete practice groups', () => {
    expect(tapTempo([0])).toBeNull();
    expect(tapTempo([100, 600, 1100, 1600])).toBe(120);
    expect(tapTempo([100, 100])).toBeNull();
    expect(practiceTempo(100, 120, 5, 4, 3)).toBe(100);
    expect(practiceTempo(100, 120, 5, 4, 4)).toBe(105);
    expect(practiceTempo(100, 120, 5, 4, 100)).toBe(120);
  });
});
