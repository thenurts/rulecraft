import { describe, expect, test } from 'vitest';
import input from '../../../fixtures/task-01-village.json';
import {
  createVillage, daySlots, keyedDraw, nextTurn, parseVillageFixture, rngVersion, scaleDraw, villageAccounts,
} from '@rulecraft/simulation';
import type { DrawKey } from './rng.ts';

const fixture = parseVillageFixture(input);

describe('village fixture v1', () => {
  test('generates 40 adults with stable IDs and explicit ownership and locations', () => {
    const state = createVillage(fixture, 42);
    expect(state.citizens).toHaveLength(40);
    for (const [occupation, count] of Object.entries(fixture.population)) {
      expect(state.citizens.filter((citizen) => citizen.occupation === occupation)).toHaveLength(count);
    }
    expect(state.citizens[0].id).toBe('citizen.0001');
    expect(state.citizens[39].id).toBe('citizen.0040');
    expect(new Set(state.accounts.map(({ id }) => id)).size).toBe(state.accounts.length);
    expect(state.accounts.find(({ id }) => id === villageAccounts.marketFood)).toEqual({
      id: villageAccounts.marketFood, ownerId: 'institution.market', locationId: 'location.granary',
      resource: 'food', quantity: 45,
    });
    expect(state.accounts.filter(({ resource }) => resource === 'food')
      .reduce((total, { quantity }) => total + quantity, 0)).toBe(495);
    expect(state.accounts.filter(({ resource }) => resource === 'coin')
      .reduce((total, { quantity }) => total + quantity, 0)).toBe(1_500);
  });

  test('starting traits are stable under reordered JSON and depend on the seed', () => {
    const reordered = parseVillageFixture({
      ...input, population: { guard: 8, merchant: 10, forester: 6, farmer: 16 },
    });
    expect(createVillage(reordered, 42)).toEqual(createVillage(fixture, 42));
    expect(createVillage(fixture, 43).citizens).not.toEqual(createVillage(fixture, 42).citizens);
  });

  test('rejects incompatible versions, invalid quantities and an invalid seed', () => {
    expect(() => parseVillageFixture({ ...input, version: 2 })).toThrow(/version/);
    expect(() => parseVillageFixture({ ...input, opening: { ...input.opening, fieldFood: -1 } })).toThrow(/fieldFood/);
    expect(() => parseVillageFixture({ ...input, economy: { ...input.economy, producerPrice: 0.5 } })).toThrow(/producerPrice/);
    expect(() => parseVillageFixture({ ...input, behaviour: { ...input.behaviour, startingFatigueMin: 99 } })).toThrow(/minimum/);
    expect(() => createVillage(fixture, -1)).toThrow(/Seed/);
  });

  test('clock starts at genesis, orders two slots and ends after the configured day', () => {
    expect(daySlots).toEqual(['morning', 'afternoon']);
    expect(nextTurn(0, fixture)).toBe(1);
    expect(nextTurn(11, fixture)).toBe(12);
    expect(nextTurn(12, fixture)).toBeNull();
    expect(() => nextTurn(13, fixture)).toThrow(/clock/);
  });
});

describe('keyed RNG v1', () => {
  const base: DrawKey = {
    seed: 42, turn: 1, slot: 'morning', actorId: 'citizen.0001', subsystem: 'choice', drawIndex: 0,
  };

  test.each<[Partial<DrawKey>, number]>([
    [{}, 1_345_397_066],
    [{ slot: 'afternoon' }, 3_899_484_680],
    [{ seed: 0 }, 2_632_678_294],
    [{ seed: 0xffff_ffff }, 1_343_050_239],
    [{ drawIndex: 1 }, 1_139_733_016],
    [{ actorId: 'citizen.0002' }, 995_608_940],
    [{ turn: 12 }, 2_529_570_343],
    [{ subsystem: 'traits' }, 2_021_255_947],
  ])('pins the draw for %j', (change, draw) => {
    expect(rngVersion).toBe('fnv1a32-fmix32-v1');
    expect(keyedDraw({ ...base, ...change })).toBe(draw);
  });

  test('keeps scale boundaries exact and rejects invalid keys and draw ranges', () => {
    expect(scaleDraw(0, 1_000_000)).toBe(0);
    expect(scaleDraw(0xffff_ffff, 1_000_000)).toBe(999_999);
    expect(() => scaleDraw(0, 0)).toThrow(/range/);
    expect(() => keyedDraw({ ...base, actorId: 'citizen Ö' })).toThrow(/ASCII/);
    expect(() => keyedDraw({ ...base, drawIndex: 0x1_0000_0000 })).toThrow(/index/);
  });
});
