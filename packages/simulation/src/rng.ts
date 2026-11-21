import type { Phase } from './model.ts';

export const rngVersion = 'fnv1a32-fmix32-v1';

export interface DrawKey {
  readonly seed: number;
  readonly turn: number;
  readonly slot: Phase;
  readonly actorId: string;
  readonly subsystem: string;
  readonly drawIndex: number;
}

export function uint32(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer.`);
  }
  return value;
}

export function keyedDraw({ seed, turn, slot, actorId, subsystem, drawIndex }: DrawKey): number {
  const token = /^[a-z0-9._-]+$/;
  if (!token.test(actorId) || !token.test(subsystem)) {
    throw new RangeError('RNG actor and subsystem IDs must be lowercase ASCII tokens.');
  }
  if (slot !== 'genesis' && slot !== 'morning' && slot !== 'afternoon' && slot !== 'dusk') {
    throw new RangeError('Invalid RNG slot.');
  }
  const bytes = JSON.stringify([
    rngVersion, uint32(seed, 'Seed'), uint32(turn, 'Turn'), slot, actorId, subsystem,
    uint32(drawIndex, 'Draw index'),
  ]);

  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index++) {
    hash = Math.imul(hash ^ bytes.charCodeAt(index), 0x01000193);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function scaleDraw(draw: number, size: number): number {
  if (!Number.isInteger(size) || size < 1 || size > 1_000_000) {
    throw new RangeError('Draw range must be an integer from 1 to 1,000,000.');
  }
  return Math.floor(uint32(draw, 'Draw') * size / 0x1_0000_0000);
}
