import { expect, test } from 'vitest';
import input from '../../../fixtures/task-01-village.json';
import {
  advanceVillage, auditResources, citizenAccount, createVillage, parseVillageFixture, villageAccounts,
  type VillageFixture, type VillageState,
} from '@rulecraft/simulation';
import { genesisTransactions, ResourceLedger } from './ledger.ts';
import { resolveDay } from './turn.ts';

const seed = 42;
const fixture = parseVillageFixture(input);
const opening = createVillage(fixture, seed);
const balance = (state: VillageState, id: string) => state.accounts.find((account) => account.id === id)?.quantity;
const changed = (patch: Partial<VillageFixture>) => parseVillageFixture({ ...input, ...patch });

test('selection rejects unavailable harvests and the injected executor explicitly blocks empty stock', () => {
  const dry = changed({ opening: { ...fixture.opening, fieldFood: 0 } });
  const state = createVillage(dry, seed);
  const natural = advanceVillage(state, dry, seed);
  expect(natural.events).toContainEqual(expect.objectContaining({
    actorId: 'citizen.0001', phase: 'morning', action: 'harvest-food',
    status: 'not-feasible-at-selection', reason: 'no-stock', quantity: 0, transactionId: null,
  }));
  const injected = resolveDay(state, dry, seed, (actor, phase) =>
    actor.id === 'citizen.0001' && phase === 'morning' ? 'harvest-food' : 'rest');
  expect(injected.events.filter((event) => event.actorId === 'citizen.0001' && event.phase === 'morning'))
    .toEqual([expect.objectContaining({
      action: 'harvest-food', status: 'blocked-at-execution', reason: 'no-stock', quantity: 0, transactionId: null,
    })]);
  expect(injected.transactions.some(({ reason }) => reason === 'harvest-food')).toBe(false);
  expect(balance(injected.state, citizenAccount('citizen.0001', 'food'))).toBe(0);
});

test('distinguishes occupation mismatch, unavailable field and contention after selection', () => {
  const limited = changed({ capacity: { ...fixture.capacity, fieldPerSlot: 1 } });
  const state = createVillage(limited, seed);
  const result = resolveDay(state, limited, seed, (actor, phase) =>
    phase === 'morning' && ['citizen.0001', 'citizen.0002', 'citizen.0040'].includes(actor.id)
      ? 'harvest-food' : 'rest');
  expect(result.events.filter(({ action }) => action === 'harvest-food')).toMatchObject([
    { actorId: 'citizen.0001', status: 'completed', quantity: 3 },
    { actorId: 'citizen.0002', status: 'blocked-at-execution', reason: 'capacity-contention', quantity: 0 },
    { actorId: 'citizen.0040', status: 'not-eligible', reason: 'occupation-mismatch', quantity: 0 },
  ]);
  const closed = changed({ capacity: { ...fixture.capacity, fieldPerSlot: 0 } });
  expect(advanceVillage(createVillage(closed, seed), closed, seed).events).toContainEqual(expect.objectContaining({
    action: 'harvest-food', status: 'not-feasible-at-selection', reason: 'unavailable-field',
  }));
});

test('revalidates stock for actors who chose on the same slot-opening state', () => {
  const scarce = changed({
    opening: { ...fixture.opening, fieldFood: 2 },
    behaviour: { ...fixture.behaviour, workWeight: 100, restWeight: 1 },
  });
  const result = advanceVillage(createVillage(scarce, seed), scarce, seed);
  const harvests = result.events.filter(({ phase, action }) => phase === 'morning' && action === 'harvest-food');
  expect(harvests[0]).toMatchObject({ status: 'partial', quantity: 2, reason: 'no-stock' });
  expect(harvests.some((event) => event.status === 'blocked-at-execution' && event.reason === 'no-stock')).toBe(true);
  expect(balance(result.state, villageAccounts.fieldFood)).toBe(0);
});

test('producer stock stays out of a market with no deliveries', () => {
  const noDelivery = changed({ opening: { ...fixture.opening, marketFood: 0 } });
  const state = createVillage(noDelivery, seed);
  const result = resolveDay(state, noDelivery, seed, (actor) => actor.occupation === 'farmer' ? 'harvest-food' : 'rest');
  expect(balance(result.state, villageAccounts.marketFood)).toBe(0);
  expect(balance(result.state, citizenAccount('citizen.0001', 'food'))).toBe(6);
  expect(result.metrics).toMatchObject({ foodDelivered: 0, foodConsumed: 0, residentsUnmet: 40 });
  expect(result.state.citizens[0].hunger).toBe(1);
});

test('bounded delivery buys the food and funds the fee together; unfunded meals and wages log failures', () => {
  const tight = changed({
    opening: { ...fixture.opening, marketFood: 0, marketCoin: 3, citizenCoin: 0, treasuryCoin: 1 },
  });
  const state = createVillage(tight, seed);
  const result = resolveDay(state, tight, seed, (actor, phase) => {
    if (phase === 'morning' && actor.id === 'citizen.0001') return 'harvest-food';
    if (phase === 'afternoon' && ['citizen.0023', 'citizen.0024'].includes(actor.id)) return 'market-delivery';
    return 'rest';
  });
  const [delivery, unfunded] = result.events.filter(({ action }) => action === 'market-delivery');
  expect(delivery).toMatchObject({ status: 'partial', quantity: 2, reason: 'insufficient-funds' });
  expect(unfunded).toMatchObject({ status: 'blocked-at-execution', quantity: 0, reason: 'insufficient-funds' });
  expect(result.transactions.find(({ id }) => id === delivery.transactionId)).toMatchObject({
    eventId: delivery.id, legs: [
      { resource: 'food', quantity: 2, from: { before: 3, after: 1 }, to: { before: 0, after: 2 } },
      { resource: 'coin', quantity: 2, from: { before: 3, after: 1 }, to: { before: 0, after: 2 } },
      { resource: 'coin', quantity: 1, from: { before: 1, after: 0 }, to: { before: 0, after: 1 } },
    ],
  });
  expect(result.metrics).toMatchObject({ residentsFed: 1, residentsUnmet: 39, guardsPaid: 0, marketFood: 1 });
  expect(result.events).toContainEqual(expect.objectContaining({
    action: 'resident-meal', status: 'blocked-at-execution', reason: 'insufficient-funds',
  }));
  expect(result.events).toContainEqual(expect.objectContaining({
    action: 'guard-wage', status: 'blocked-at-execution', reason: 'insufficient-funds',
  }));
  expect(auditResources(state.accounts, result.state.accounts, [
    ...genesisTransactions(state.accounts, 'event.0.1'), ...result.transactions,
  ])).toMatchObject({ genesis: { coin: 4 }, remaining: { coin: 4 }, consumed: { food: 1 } });
});

test('the ledger discards all legs of failed transactions and rejects negative input accounts', () => {
  const ledger = new ResourceLedger(opening.accounts, 1);
  expect(() => ledger.post('market-delivery', 'citizen.0023', 'morning', 'event.1.1', [
    { from: villageAccounts.marketCoin, to: citizenAccount('citizen.0001', 'coin'), quantity: 1 },
    { from: villageAccounts.marketCoin, to: citizenAccount('citizen.0023', 'coin'), quantity: 200 },
  ])).toThrow(/invalid balance/);
  expect(ledger.balances()).toEqual(opening.accounts);
  expect(ledger.transactions).toHaveLength(0);
  expect(() => new ResourceLedger([{ ...opening.accounts[0], quantity: -1 }], 1)).toThrow(/invalid account/);
});

test('finite woodland and dusk transfers conserve resources with stable ordering', () => {
  const sparse = changed({ opening: { ...fixture.opening, forestTimber: 1 } });
  const state = createVillage(sparse, seed);
  const result = resolveDay(state, sparse, seed, (actor) => actor.occupation === 'forester' ? 'cut-timber' : 'rest');
  expect(balance(result.state, villageAccounts.forestTimber)).toBe(0);
  expect(result.events.find(({ action }) => action === 'cut-timber')).toMatchObject({ status: 'partial', quantity: 1 });
  const tx = [...genesisTransactions(state.accounts, 'event.0.1'), ...result.transactions];
  expect(auditResources(state.accounts, result.state.accounts, tx)).toMatchObject({
    genesis: { food: 495, timber: 1, coin: 1_500 },
    consumed: { food: 40, timber: 0, coin: 0 },
    remaining: { food: 455, timber: 1, coin: 1_500 },
  });
  expect(() => auditResources(state.accounts, result.state.accounts, tx.slice(0, -1))).toThrow(/mismatch/);
  expect(advanceVillage({ ...state, citizens: [...state.citizens].reverse(), accounts: [...state.accounts].reverse() },
    sparse, seed)).toEqual(advanceVillage(state, sparse, seed));
});
