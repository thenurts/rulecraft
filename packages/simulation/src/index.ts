export function encodePortabilityFixture(seed: number): string {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('The fixture seed must be an unsigned 32-bit integer.');
  }
  return JSON.stringify({ fixtureVersion: 1, seed });
}
