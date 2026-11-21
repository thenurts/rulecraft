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
export { actionRegistry, lawRegistryVersion, listLawTokens, predicateRegistry, renderLaw, updateLawDraft, validateLaw, villageScope } from './law.ts';
export type { ExecutableAction, LawAction, LawAst, LawDraft, LawIssue, Modality, Predicate, TargetSelector } from './law.ts';
export { authoritativeLaws, perceivedLaws, resolveLegality, LawError } from './law-book.ts';
export type { LawBook, LawCommand, LawRef, LawVersion, LegalDecision, LegalFrame } from './law-book.ts';
export { advanceLawGame, confirmLaw, encodeLawGame, lawGameHashes, loadLawGame, notifyLaw, startLawGame } from './law-game.ts';
export type { LawGame, LawPolicy } from './law-game.ts';
export { advanceSociety, encodeSociety, loadSociety, societyDefaults, societyHashes, startSociety, startSocietyV3 } from './society.ts';
export type { SocietyConfig, SocietyDay, SocietyGame } from './society.ts';
