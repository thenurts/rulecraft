import { isRecord, lawRegistryVersion, villageScope, type LawIssue } from './law.ts';
import {
  addLawNotice, authoritativeLaws, LawError, noticeKnownAt, perceivedLaws, prepareLawCommand, resolveLegality, type LawBook, type LawCommand, type LawVersion,
} from './law-book.ts';
import { contentVersion } from './model.ts';
import { rngVersion, uint32 } from './rng.ts';
import {
  appendDay, canonicalJson, encodeCheckpointPayload, hashCanonicalBytes, startVillage, type VillageRun,
} from './snapshot.ts';
import { advanceVillage, resolveDay, type EvaluateLegal } from './turn.ts';

const versions = { schemaVersion: 2, engineVersion: 'headless-law-v1', contentVersion, rngVersion, lawRegistryVersion } as const;

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

export interface LawRun extends VillageRun {
  readonly policy: LawPolicy;
  readonly book: LawBook;
  readonly journal: readonly LegalInput[];
}

export function parsePolicy(input: unknown): LawPolicy {
  if (!isRecord(input)) throw new LawError('INVALID_LAW_POLICY');
  const { changesPerTurn, mustWeight, mustNotWeight } = input;
  const bounded = (value: unknown, max: number): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
  if ((changesPerTurn !== null && !bounded(changesPerTurn, 1_000)) ||
      !bounded(mustWeight, 1_000) || !bounded(mustNotWeight, 1_000)) throw new LawError('INVALID_LAW_POLICY');
  return { changesPerTurn, mustWeight, mustNotWeight };
}

export interface LawGame extends LawRun {
  readonly versions: Readonly<typeof versions>;
}

export function startLawGame(fixture: unknown, seed: number, policy: LawPolicy = defaultPolicy): LawGame {
  return {
    ...startVillage(fixture, seed), versions: { ...versions }, policy: parsePolicy(policy),
    book: Object.freeze({ versions: Object.freeze([]), notices: Object.freeze([]) }), journal: [],
  };
}

export interface LawConfirmation<T extends LawRun> {
  readonly game: T;
  readonly version: LawVersion;
  readonly issues: readonly LawIssue[];
}

export function confirmLaw<T extends LawRun>(game: T, command: unknown): LawConfirmation<T> {
  const turn = game.state.turn;
  const prepared = prepareLawCommand(game.book, turn, command, game.policy.changesPerTurn);
  if (prepared.book === game.book) return { game, version: prepared.version, issues: prepared.issues };
  return {
    game: { ...game, book: prepared.book, journal: [...game.journal, { kind: 'command', turn, command: prepared.command }] },
    version: prepared.version, issues: prepared.issues,
  };
}

/** Headless notification input for controlled scenarios. No notice is delivered automatically. */
export function notifyLaw<T extends LawRun>(game: T, citizenId: string, lawId: string, version: number): T {
  if (!game.state.citizens.some(({ id }) => id === citizenId)) throw new LawError('UNKNOWN_CITIZEN');
  const turn = game.state.turn;
  const book = addLawNotice(game.book, turn, citizenId, lawId, version);
  return book === game.book ? game
    : { ...game, book, journal: [...game.journal, { kind: 'notice', turn, citizenId, lawId, version }] };
}

export function advanceLawGame(game: LawGame): LawGame {
  const evaluate = lawEvaluator(game);
  return appendDay(game, evaluate
    ? resolveDay(game.state, game.fixture, game.seed, undefined, evaluate)
    : advanceVillage(game.state, game.fixture, game.seed));
}

export function lawEvaluator(game: LawRun): EvaluateLegal | undefined {
  const turn = game.state.turn + 1;
  const actual = authoritativeLaws(game.book, turn);
  if (actual.length === 0) return undefined;

  const beliefs = new Map(game.state.citizens.map(({ id }) => [id, perceivedLaws(game.book, id, turn)]));
  const notices = new Map(game.book.notices.filter((notice) => noticeKnownAt(notice, turn))
    .map((notice) => [`${notice.citizenId}:${notice.lawId}:${notice.version}`, notice.eventId]));
  return (actor, day, slot, actionId, accountQuantity) => {
    const frame = {
      turn: day, slot, accountQuantity, occupation: actor.occupation, fatigue: actor.fatigue,
      jurisdictionId: villageScope.jurisdictionId,
    };
    const perceived = resolveLegality(beliefs.get(actor.id) ?? [], frame, actionId);
    const noticeEventIds = perceived.considered.map(({ ref }) => {
      const id = notices.get(`${actor.id}:${ref.lawId}:${ref.version}`);
      if (!id) throw new Error('Perceived law is missing its notice provenance.');
      return id;
    });
    const pressure = perceived.status === 'required' ? game.policy.mustWeight
      : perceived.status === 'prohibited' || perceived.status === 'unlicensed' ? -game.policy.mustNotWeight : 0;
    return {
      actionId, actual: resolveLegality(actual, frame, actionId), perceived,
      noticeEventIds, pressure,
    };
  };
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
  const game = replayLegalJournal(startLawGame(candidate.fixture, seed, parsePolicy(candidate.policy)),
    candidate, advanceLawGame);
  if (canonicalJson(game) !== bytes) throw new LawError('INCOMPLETE_OR_NON_REPRODUCIBLE_LAW_SAVE');
  return game;
}

export function replayLegalJournal<T extends LawRun>(
  initial: T, candidate: Record<string, unknown>, advance: (game: T) => T,
): T {
  let game = initial;
  const endTurn = isRecord(candidate.state) ? candidate.state.turn : null;
  if (typeof endTurn !== 'number' || !Number.isInteger(endTurn) || endTurn < 0 || endTurn > game.fixture.days ||
      !Array.isArray(candidate.journal)) throw new LawError('INVALID_LAW_SAVE_CLOCK_OR_JOURNAL');

  for (const entry of candidate.journal as unknown[]) {
    if (!isRecord(entry) || typeof entry.turn !== 'number' || !Number.isInteger(entry.turn) ||
        entry.turn < game.state.turn || entry.turn > endTurn) throw new LawError('INVALID_LEGAL_JOURNAL');
    while (game.state.turn < entry.turn) game = advance(game);
    if (entry.kind === 'command') {
      game = confirmLaw(game, entry.command).game;
    } else if (entry.kind === 'notice' && typeof entry.citizenId === 'string' &&
      typeof entry.lawId === 'string' && typeof entry.version === 'number') {
      game = notifyLaw(game, entry.citizenId, entry.lawId, entry.version);
    } else {
      throw new LawError('INVALID_LEGAL_JOURNAL');
    }
  }
  while (game.state.turn < endTurn) game = advance(game);
  return game;
}
