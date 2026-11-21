import { encodePortabilityFixture } from '@rulecraft/simulation';
import { expect, test } from 'vitest';

test('encodes the same fixture bytes used by the phone-width proof', () => {
  expect(encodePortabilityFixture(42)).toBe('{"fixtureVersion":1,"seed":42}');
});

test.each([
  [0, '{"fixtureVersion":1,"seed":0}'],
  [0xffff_ffff, '{"fixtureVersion":1,"seed":4294967295}'],
] as const)('encodes boundary seed %s without rounding', (seed, fixture) => {
  expect(encodePortabilityFixture(seed)).toBe(fixture);
});

test.each([-1, 0x1_0000_0000, 1.25, NaN, Infinity])(
  'rejects invalid fixture seed %s',
  (seed) => {
    expect(() => encodePortabilityFixture(seed)).toThrow(RangeError);
  },
);
