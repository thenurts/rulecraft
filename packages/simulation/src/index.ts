export function encodePortabilityFixture(seed: number): string {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('The fixture seed must be an unsigned 32-bit integer.');
  }
  return JSON.stringify({ fixtureVersion: 1, seed });
}

export { createVillage, parseVillageFixture } from './fixture.ts';
export {
  citizenAccount, compareIds, contentVersion, daySlots, engineVersion, nextTurn, schemaVersion, villageAccounts,
} from './model.ts';
export type {
  Account, Citizen, DaySlot, Occupation, Phase, Resource, VillageFixture, VillageState,
} from './model.ts';
export { keyedDraw, rngVersion, scaleDraw } from './rng.ts';
export { auditResources } from './ledger.ts';
export type { ResourceAudit, Transaction } from './ledger.ts';
export { advanceVillage } from './turn.ts';
export type { DailyMetrics, ResolvedDay, VillageEvent } from './turn.ts';
export {
  auditSnapshot, canonicalJson, encodeSnapshot, loadSnapshot, resolveNextTurn, snapshotHashes, startVillage,
} from './snapshot.ts';
export type { VillageSnapshot } from './snapshot.ts';
