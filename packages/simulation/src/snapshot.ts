import { createVillage, parseVillageFixture } from './fixture.ts';
import { auditResources, genesisTransactions, type ResourceAudit, type Transaction } from './ledger.ts';
import { compareIds, contentVersion, engineVersion, schemaVersion, type VillageFixture, type VillageState } from './model.ts';
import { rngVersion, uint32 } from './rng.ts';
import { advanceVillage, type DailyMetrics, type VillageEvent } from './turn.ts';

const versions = { schemaVersion, engineVersion, contentVersion, rngVersion };

export interface VillageSnapshot {
  readonly versions: Readonly<typeof versions>;
  readonly seed: number;
  readonly fixture: VillageFixture;
  readonly state: VillageState;
  readonly events: readonly VillageEvent[];
  readonly transactions: readonly Transaction[];
  readonly days: readonly DailyMetrics[];
}

export function startVillage(fixtureInput: unknown, seed: number): VillageSnapshot {
  const fixture = parseVillageFixture(fixtureInput);
  const state = createVillage(fixture, seed);
  const id = 'event.0.1';
  const transactions = genesisTransactions(state.accounts, id);
  const event: VillageEvent = {
    id, turn: 0, phase: 'genesis', actorId: 'scenario.village', action: 'fixture-genesis',
    status: 'completed', reason: null, quantity: 0, transactionId: transactions[0]?.id ?? null,
    fatigue: null, hunger: null,
  };
  return { versions: { ...versions }, seed, fixture, state, events: [event], transactions, days: [] };
}

export function resolveNextTurn(snapshot: VillageSnapshot): VillageSnapshot {
  const day = advanceVillage(snapshot.state, snapshot.fixture, snapshot.seed);
  return {
    ...snapshot,
    state: day.state,
    days: [...snapshot.days, day.metrics],
    events: [...snapshot.events, ...day.events],
    transactions: [...snapshot.transactions, ...day.transactions],
  };
}

export function auditSnapshot(snapshot: VillageSnapshot): ResourceAudit {
  const events = new Map(snapshot.events.map((event) => [event.id, event]));
  const transactions = new Set<string>();
  if (events.size !== snapshot.events.length) throw new Error('Duplicate event ID.');
  for (const tx of snapshot.transactions) {
    const event = events.get(tx.eventId);
    if (!event || event.transactionId !== tx.id || event.turn !== tx.turn || event.phase !== tx.phase ||
        event.actorId !== tx.actorId || event.action !== tx.reason || transactions.has(tx.id)) {
      throw new Error(`Invalid event provenance for ${tx.id}.`);
    }
    transactions.add(tx.id);
  }
  for (const event of events.values()) {
    if (event.transactionId !== null && !transactions.has(event.transactionId)) {
      throw new Error(`Missing transaction for ${event.id}.`);
    }
  }
  const opening = createVillage(snapshot.fixture, snapshot.seed);
  return auditResources(opening.accounts, snapshot.state.accounts, snapshot.transactions);
}

function jsonString(value: string): string {
  // JSON strings are escaped to ASCII, including UTF-16 surrogate code units.
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g,
    (unit) => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (typeof value === 'string') return jsonString(value);
  if (Array.isArray(value)) return '[' + Array.from(value, canonicalJson).join(',') + ']';
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort(compareIds)
      .map((key) => jsonString(key) + ':' + canonicalJson(record[key])).join(',') + '}';
  }
  throw new TypeError('Canonical JSON requires plain JSON data and safe integers.');
}

function hash(bytes: string): string {
  let word = 0xcbf29ce484222325n;
  for (let index = 0; index < bytes.length; index++) {
    word = BigInt.asUintN(64, (word ^ BigInt(bytes.charCodeAt(index))) * 0x100000001b3n);
  }
  return word.toString(16).padStart(16, '0');
}

export function snapshotHashes(snapshot: VillageSnapshot): Readonly<{ state: string; events: string }> {
  const { versions, seed, fixture, state, events, transactions, days } = snapshot;
  return {
    state: hash(canonicalJson({ versions, seed, fixture, state })),
    events: hash(canonicalJson({ versions, events, transactions, days })),
  };
}

export function encodeSnapshot(snapshot: VillageSnapshot): string {
  const payload = canonicalJson(snapshot);
  return `{"checksum":"${hash(payload)}","snapshot":${payload}}`;
}

export function loadSnapshot(encoded: string): VillageSnapshot {
  const envelope = JSON.parse(encoded);
  const candidate = envelope?.snapshot;
  if (!candidate || !Object.entries(versions).every(([key, value]) => candidate.versions?.[key] === value)) {
    throw new Error('Unsupported snapshot schema, engine, content or RNG version.');
  }
  const bytes = canonicalJson(candidate);
  if (envelope.checksum !== hash(bytes)) throw new Error('Snapshot checksum mismatch.');

  let restored = startVillage(candidate.fixture, uint32(candidate.seed, 'Seed'));
  const turn = candidate.state?.turn;
  if (!Number.isInteger(turn) || turn < 0 || turn > restored.fixture.days) throw new Error('Invalid snapshot clock.');
  while (restored.state.turn < turn) restored = resolveNextTurn(restored);
  if (canonicalJson(restored) !== bytes) {
    throw new Error('Snapshot is not a complete reproducible turn.');
  }
  return restored;
}
