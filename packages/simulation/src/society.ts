import { isRecord, lawRegistryVersion } from './law.ts';
import { lawEvaluator, parsePolicy, replayLegalJournal, startLawGame, type LawPolicy, type LawRun } from './law-game.ts';
import { contentVersion } from './model.ts';
import { rngVersion, uint32 } from './rng.ts';
import { appendDay, canonicalJson, encodeCheckpointPayload, hashCanonicalBytes } from './snapshot.ts';
import { buildContacts, learnAtDawn, type ContactList, type NewsEvent, type NewsPolicy } from './social-news.ts';
import {
  allocationDraw, attitudeKey, behaviourDefaults, initialiseAttitudes, settleExperiences,
  socialMetrics, sortedAttitudes, utilityParts, type Attitude, type BehaviourPolicy, type Experience,
} from './social-behaviour.ts';
import { patrolDefaults, resolvePatrols, type Investigation, type PatrolPolicy, type PatrolReport } from './social-patrol.ts';
import { resolveDay, type AllocationEvidence } from './turn.ts';

const historicalVersions = { schemaVersion: 3, engineVersion: 'headless-society-v1', contentVersion, rngVersion,
  lawRegistryVersion } as const;
const versions = { ...historicalVersions, schemaVersion: 4, engineVersion: 'headless-society-v2' } as const;

export interface SocietyConfig extends NewsPolicy {
  readonly behaviour: BehaviourPolicy;
  readonly patrol: PatrolPolicy;
}
export const societyDefaults: Readonly<SocietyConfig> = Object.freeze({
  bulletinBp: 1_500, peerBp: 2_500, contacts: 3, behaviour: Object.freeze(behaviourDefaults),
  patrol: Object.freeze(patrolDefaults),
});

export interface SocietyDay {
  readonly turn: number;
  readonly news: readonly NewsEvent[];
  readonly experiences: readonly Experience[];
  readonly allocations: readonly AllocationEvidence[];
  readonly metrics: ReturnType<typeof socialMetrics>;
  readonly patrol: PatrolReport;
}

export interface SocietyGame extends LawRun {
  readonly versions: Readonly<typeof versions | typeof historicalVersions>;
  readonly config: SocietyConfig;
  readonly contacts: readonly ContactList[];
  readonly attitudes: readonly Attitude[];
  readonly societyDays: readonly SocietyDay[];
}

function configNumber(input: Record<string, unknown>, key: string, max: number): number {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`Invalid society setting ${key}.`);
  }
  return value;
}

export function startSociety(fixture: unknown, seed: number, config: SocietyConfig = societyDefaults, policy?: LawPolicy): SocietyGame {
  return initialiseSociety(versions, fixture, seed, config, policy);
}

/** Reproduce the original Task 03 engine for historical verification. */
export function startSocietyV3(fixture: unknown, seed: number, config: SocietyConfig = societyDefaults, policy?: LawPolicy): SocietyGame {
  return initialiseSociety(historicalVersions, fixture, seed, config, policy);
}

function initialiseSociety(
  engine: SocietyGame['versions'], fixture: unknown, seed: number, config: SocietyConfig, policy?: LawPolicy,
): SocietyGame {
  if (!isRecord(config)) throw new TypeError('Invalid society settings.');
  if (!isRecord(config.behaviour)) throw new TypeError('Invalid behaviour settings.');
  const behaviour = Object.fromEntries(Object.keys(behaviourDefaults).map((key) =>
    [key, configNumber(config.behaviour, key, 100)])) as BehaviourPolicy;
  if (!isRecord(config.patrol)) throw new TypeError('Invalid patrol settings.');
  const patrol: PatrolPolicy = {
    encountersPerPatrol: configNumber(config.patrol, 'encountersPerPatrol', 20),
    detectionBp: configNumber(config.patrol, 'detectionBp', 10_000),
    warningRiskWeight: configNumber(config.patrol, 'warningRiskWeight', 100),
    warningMemoryDays: configNumber(config.patrol, 'warningMemoryDays', 30),
    warningTrustLoss: configNumber(config.patrol, 'warningTrustLoss', 100),
  };
  const settings = {
    bulletinBp: configNumber(config, 'bulletinBp', 10_000),
    peerBp: configNumber(config, 'peerBp', 10_000),
    contacts: configNumber(config, 'contacts', 12), behaviour, patrol,
  };
  const game = startLawGame(fixture, seed, policy);
  return { ...game, versions: { ...engine }, config: settings,
    contacts: buildContacts(game.state.citizens, seed, settings.contacts), attitudes: [], societyDays: [] };
}

export function advanceSociety(game: SocietyGame): SocietyGame {
  const turn = game.state.turn + 1;
  const dawn = learnAtDawn(game.book, game.contacts, game.config, game.seed, turn);
  const informed = { ...game, book: dawn.book };
  const experiences: Experience[] = [];
  const attitudes = initialiseAttitudes(informed, experiences);
  const allocations: AllocationEvidence[] = [];
  const historical = game.versions.schemaVersion === 3;
  const rememberedWarnings = new Map<string, Investigation>();
  for (const previous of game.societyDays) {
    if (turn - previous.turn > game.config.patrol.warningMemoryDays) continue;
    for (const inspection of previous.patrol.investigations) {
      if (inspection.disposition === 'warning' || (historical && inspection.disposition === 'education')) {
        rememberedWarnings.set(`${inspection.act.citizenId}:${inspection.act.action}`, inspection);
      }
    }
  }
  const day = resolveDay(game.state, game.fixture, game.seed, undefined, lawEvaluator(informed), {
    rank: (phase, resource, actorId) => allocationDraw(game.seed, turn, phase, resource, actorId),
    allocation: (record) => allocations.push(record),
    utility: (actor, action, quantities, law, pressure) => {
      const base = utilityParts(actor, action, game.fixture, game.config.behaviour, quantities, pressure,
        law ? attitudes.get(attitudeKey(actor.id, law))?.score ?? 0 : 0);
      const remembered = pressure < 0 && (historical || game.config.patrol.warningRiskWeight > 0) ? rememberedWarnings.get(`${actor.id}:${action}`) : undefined;
      return remembered ? { ...base, risk: -game.config.patrol.warningRiskWeight, riskEventIds: [remembered.id] } : base;
    },
  });
  const patrol = resolvePatrols(dawn.book, day, game.seed, game.config.patrol, historical ? 'warning' : 'education');
  const settled = settleExperiences(informed, day, attitudes, experiences, patrol.report.investigations);
  return appendDay({
    ...informed, book: patrol.book, attitudes: sortedAttitudes(attitudes),
    societyDays: [...game.societyDays, { turn, news: dawn.news, experiences, allocations,
      metrics: socialMetrics(day), patrol: patrol.report }],
  }, settled);
}

export function societyHashes(game: SocietyGame): Readonly<{ state: string; events: string }> {
  const { versions, seed, fixture, state, events, transactions, days, book, policy, journal, config, contacts, attitudes, societyDays } = game;
  return {
    state: hashCanonicalBytes(canonicalJson({ versions, seed, fixture, state, book, policy, config, contacts, attitudes })),
    events: hashCanonicalBytes(canonicalJson({ versions, events, transactions, days, journal, societyDays })),
  };
}

export function encodeSociety(game: SocietyGame): string {
  return encodeCheckpointPayload(game);
}

export function loadSociety(encoded: string): SocietyGame {
  const envelope: unknown = JSON.parse(encoded);
  const candidate = isRecord(envelope) ? envelope.snapshot : null;
  const declared = isRecord(candidate) ? candidate.versions : null;
  const engine = isRecord(declared) && [versions, historicalVersions].find((version) =>
    Object.entries(version).every(([name, value]) => declared[name] === value));
  if (!isRecord(candidate) || !engine) {
    throw new Error('UNSUPPORTED_SOCIETY_SAVE_VERSION');
  }
  const bytes = canonicalJson(candidate);
  if (!isRecord(envelope) || envelope.checksum !== hashCanonicalBytes(bytes)) throw new Error('SOCIETY_SAVE_CHECKSUM_MISMATCH');
  const seed = typeof candidate.seed === 'number' ? uint32(candidate.seed, 'Seed') : NaN;
  if (!Number.isInteger(seed)) throw new Error('INVALID_SOCIETY_SAVE_SEED');
  const game = replayLegalJournal(
    initialiseSociety(engine, candidate.fixture, seed, candidate.config as SocietyConfig, parsePolicy(candidate.policy)),
    candidate, advanceSociety,
  );
  if (canonicalJson(game) !== bytes) throw new Error('INCOMPLETE_OR_NON_REPRODUCIBLE_SOCIETY_SAVE');
  return game;
}
