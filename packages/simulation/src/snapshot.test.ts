import { expect, test } from 'vitest';
import input from '../../../fixtures/task-01-village.json';
import {
  auditSnapshot, canonicalJson, encodeSnapshot, loadSnapshot, resolveNextTurn, snapshotHashes, startVillage,
  type VillageSnapshot,
} from '@rulecraft/simulation';

function finish(snapshot: VillageSnapshot, until = snapshot.fixture.days): VillageSnapshot {
  while (snapshot.state.turn < until) snapshot = resolveNextTurn(snapshot);
  return snapshot;
}

test('rule-free seed 42 has fixed 12-day state, ledger and event hashes', () => {
  const run = finish(startVillage(input, 42));
  const hashes = { state: '713a9e709bf6e873', events: '72f67e9184e65e5f' };
  expect(snapshotHashes(run)).toEqual(hashes);
  expect(snapshotHashes(finish(startVillage(input, 42)))).toEqual(hashes);
  expect(run.events).toHaveLength(2_356);
  expect(run.days.map(({ turn }) => turn)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(run.days.reduce((sum, { residentsFed }) => sum + residentsFed, 0)).toBe(468);
  expect(auditSnapshot(run)).toEqual({
    transactions: 888, movements: 2_262,
    genesis: { food: 495, timber: 120, coin: 1_500 },
    consumed: { food: 468, timber: 0, coin: 0 },
    remaining: { food: 27, timber: 120, coin: 1_500 },
  });
  expect(() => resolveNextTurn(run)).toThrow(/complete/);
});

test('a different seed changes actual choices while preserving resource invariants', () => {
  const run = finish(startVillage(input, 42));
  const other = finish(startVillage(input, 43));
  expect(other.days).not.toEqual(run.days);
  expect(snapshotHashes(other).events).not.toEqual(snapshotHashes(run).events);
  expect(auditSnapshot(other).remaining.coin).toBe(1_500);
});

test('40-citizen baseline reconciles across multiple seeds and reaches the horizon', () => {
  for (const seed of [0, 1, 5, 11, 43, 0xffff_ffff]) {
    const run = finish(startVillage(input, seed));
    const audit = auditSnapshot(run);
    expect(run.state.turn).toBe(12);
    expect(run.state.accounts.every(({ quantity }) => quantity >= 0)).toBe(true);
    expect(audit.remaining.food + audit.consumed.food).toBe(495);
    expect(audit.remaining.timber).toBe(120);
    expect(audit.remaining.coin).toBe(1_500);
  }
});

test('advancement leaves the prior committed state untouched; reloading day 6 reproduces day 12', () => {
  const six = finish(startVillage(input, 42), 6);
  const encoded = encodeSnapshot(six);
  const uninterrupted = finish(six);
  const restored = loadSnapshot(encoded);
  const replayed = finish(restored);
  expect(six.state.turn).toBe(6);
  expect(encodeSnapshot(six)).toBe(encoded);
  expect(encodeSnapshot(restored)).toBe(encoded);
  expect(snapshotHashes(replayed)).toEqual(snapshotHashes(uninterrupted));
  expect(encodeSnapshot(replayed)).toBe(encodeSnapshot(uninterrupted));
});

test('snapshot loader rejects incompatible versions, truncation and corrupt checksums', () => {
  const encoded = encodeSnapshot(startVillage(input, 42));
  expect(() => loadSnapshot(encoded.replace('"schemaVersion":1', '"schemaVersion":9'))).toThrow(/version/);
  expect(() => loadSnapshot(encoded.replace('"seed":42', '"seed":43'))).toThrow(/checksum/);
  expect(() => loadSnapshot(encoded.slice(0, -10))).toThrow(SyntaxError);
});

test('a valid checksum cannot make an incomplete day loadable', () => {
  const complete = finish(startVillage(input, 42), 1);
  const interrupted = { ...complete, events: complete.events.slice(0, -1) };
  expect(() => loadSnapshot(encodeSnapshot(interrupted))).toThrow(/complete reproducible turn/);
});

test('snapshot audit rejects missing and incorrectly linked transactions', () => {
  const complete = finish(startVillage(input, 42), 1);
  const [opening, ...later] = complete.transactions;
  expect(() => auditSnapshot({ ...complete, transactions: later })).toThrow(/Missing transaction/);
  expect(() => auditSnapshot({
    ...complete, transactions: [{ ...opening, eventId: 'event.1.1' }, ...later],
  })).toThrow(/provenance/);
});

test('canonical encoding sorts object keys and escapes UTF-16 while preserving array order', () => {
  expect(canonicalJson({ b: ['☀', 1], a: '☃' })).toBe('{"a":"\\u2603","b":["\\u2600",1]}');
  expect(canonicalJson({ a: '☃', b: ['☀', 1] })).toBe(canonicalJson({ b: ['☀', 1], a: '☃' }));
  expect(() => canonicalJson({ unsafe: Number.MAX_SAFE_INTEGER + 1 })).toThrow(/safe integers/);
  expect(() => canonicalJson(new Array(1))).toThrow(/plain JSON/);
});


test('resource audit rejects a missing owner, a duplicated account and attempted currency creation', () => {
  const run = finish(startVillage(input, 42), 1);
  const [first, ...rest] = run.state.accounts;
  expect(() => auditSnapshot({ ...run, state: { ...run.state, accounts: [{ ...first, ownerId: '' }, ...rest] } }))
    .toThrow(/account mismatch/);
  expect(() => auditSnapshot({ ...run, state: { ...run.state, accounts: [first, first, ...rest] } }))
    .toThrow(/inventory changed/);
  const tx = run.transactions.find(({ reason }) => reason === 'guard-wage')!;
  const forged = { ...tx, legs: tx.legs.map((leg) => ({ ...leg, from: null })) };
  expect(() => auditSnapshot({
    ...run, transactions: run.transactions.map((item) => item.id === tx.id ? forged : item),
  })).toThrow(/unregistered source/);
});
