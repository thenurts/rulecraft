import { isRecord, lawRegistryVersion, type LawIssue } from './law.ts';
import {
  addLawNotice, LawError, prepareLawCommand, type LawBook, type LawCommand, type LawVersion,
} from './law-book.ts';
import { rngVersion, uint32 } from './rng.ts';
import {
  appendDay, canonicalJson, encodeCheckpointPayload, hashCanonicalBytes, startVillage, type VillageRun,
} from './snapshot.ts';
import { advanceVillage } from './turn.ts';

const versions = { schemaVersion: 2, engineVersion: 'headless-law-v1', contentVersion: 'village-v1', rngVersion, lawRegistryVersion } as const;

export interface LawPolicy {
  readonly changesPerTurn: number | null;
  readonly mustWeight: number;
  readonly mustNotWeight: number;
}

const defaultPolicy: LawPolicy = { changesPerTurn: 2, mustWeight: 60, mustNotWeight: 55 };

type LegalInput = Readonly<{ turn: number }> & (
  | Readonly<{ kind: 'command'; command: LawCommand }>
  | Readonly<{ kind: 'notice'; citizenId: string; lawId: string; version: number }>
);

export interface LawGame extends VillageRun {
  readonly versions: Readonly<typeof versions>;
  readonly policy: LawPolicy;
  readonly book: LawBook;
  readonly journal: readonly LegalInput[];
}

function parsePolicy(input: unknown): LawPolicy {
  if (!isRecord(input)) throw new LawError('INVALID_LAW_POLICY');
  const { changesPerTurn, mustWeight, mustNotWeight } = input;
  const bounded = (value: unknown, max: number): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
  if ((changesPerTurn !== null && !bounded(changesPerTurn, 1_000)) ||
      !bounded(mustWeight, 1_000) || !bounded(mustNotWeight, 1_000)) throw new LawError('INVALID_LAW_POLICY');
  return { changesPerTurn, mustWeight, mustNotWeight };
}

export function startLawGame(fixture: unknown, seed: number, policy: LawPolicy = defaultPolicy): LawGame {
  return {
    ...startVillage(fixture, seed), versions: { ...versions }, policy: parsePolicy(policy),
    book: { versions: [], notices: [] }, journal: [],
  };
}

export interface LawConfirmation {
  readonly game: LawGame;
  readonly version: LawVersion;
  readonly issues: readonly LawIssue[];
}

export function confirmLaw(game: LawGame, command: unknown): LawConfirmation {
  const turn = game.state.turn;
  const prepared = prepareLawCommand(game.book, turn, command, game.policy.changesPerTurn);
  if (prepared.book === game.book) return { game, version: prepared.version, issues: prepared.issues };
  return {
    game: { ...game, book: prepared.book, journal: [...game.journal, { kind: 'command', turn, command: prepared.command }] },
    version: prepared.version, issues: prepared.issues,
  };
}

/** Headless notification input for controlled scenarios. No notice is delivered automatically. */
export function notifyLaw(game: LawGame, citizenId: string, lawId: string, version: number): LawGame {
  if (!game.state.citizens.some(({ id }) => id === citizenId)) throw new LawError('UNKNOWN_CITIZEN');
  const turn = game.state.turn;
  const book = addLawNotice(game.book, turn, citizenId, lawId, version);
  return book === game.book ? game
    : { ...game, book, journal: [...game.journal, { kind: 'notice', turn, citizenId, lawId, version }] };
}

export function advanceLawGame(game: LawGame): LawGame {
  return appendDay(game, advanceVillage(game.state, game.fixture, game.seed));
}

export function lawGameHashes(game: LawGame): Readonly<{ state: string; events: string }> {
  const { versions, seed, fixture, state, events, transactions, days, book, policy, journal } = game;
  return {
    state: hashCanonicalBytes(canonicalJson({ versions, seed, fixture, state, book, policy })),
    events: hashCanonicalBytes(canonicalJson({ versions, events, transactions, days, journal })),
  };
}

export function encodeLawGame(game: LawGame): string {
  return encodeCheckpointPayload(game);
}

export function loadLawGame(encoded: string): LawGame {
  const envelope: unknown = JSON.parse(encoded);
  const candidate = isRecord(envelope) ? envelope.snapshot : null;
  const declared = isRecord(candidate) ? candidate.versions : null;
  if (!isRecord(candidate) || !isRecord(declared) ||
      !Object.entries(versions).every(([name, value]) => declared[name] === value)) {
    throw new LawError('UNSUPPORTED_LAW_SAVE_VERSION');
  }
  const bytes = canonicalJson(candidate);
  if (!isRecord(envelope) || envelope.checksum !== hashCanonicalBytes(bytes)) throw new LawError('LAW_SAVE_CHECKSUM_MISMATCH');
  const seed = typeof candidate.seed === 'number' ? uint32(candidate.seed, 'Seed') : NaN;
  if (!Number.isInteger(seed)) throw new LawError('INVALID_LAW_SAVE_SEED');
  let game = startLawGame(candidate.fixture, seed, parsePolicy(candidate.policy));
  const endTurn = isRecord(candidate.state) ? candidate.state.turn : null;
  if (typeof endTurn !== 'number' || !Number.isInteger(endTurn) || endTurn < 0 || endTurn > game.fixture.days ||
      !Array.isArray(candidate.journal)) throw new LawError('INVALID_LAW_SAVE_CLOCK_OR_JOURNAL');

  for (const entry of candidate.journal as unknown[]) {
    if (!isRecord(entry) || typeof entry.turn !== 'number' || !Number.isInteger(entry.turn) ||
        entry.turn < game.state.turn || entry.turn > endTurn) throw new LawError('INVALID_LEGAL_JOURNAL');
    while (game.state.turn < entry.turn) game = advanceLawGame(game);
    if (entry.kind === 'command') {
      game = confirmLaw(game, entry.command).game;
    } else if (entry.kind === 'notice' && typeof entry.citizenId === 'string' &&
      typeof entry.lawId === 'string' && typeof entry.version === 'number') {
      game = notifyLaw(game, entry.citizenId, entry.lawId, entry.version);
    } else {
      throw new LawError('INVALID_LEGAL_JOURNAL');
    }
  }
  while (game.state.turn < endTurn) game = advanceLawGame(game);
  if (canonicalJson(game) !== bytes) throw new LawError('INCOMPLETE_OR_NON_REPRODUCIBLE_LAW_SAVE');
  return game;
}
