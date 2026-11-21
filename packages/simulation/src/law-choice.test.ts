import { expect, test } from 'vitest';
import fixture from '../../../fixtures/task-01-village.json';
import {
  advanceLawGame, auditSnapshot, confirmLaw, encodeLawGame, lawGameHashes, loadLawGame, notifyLaw,
  resolveNextTurn, snapshotHashes, startLawGame, startVillage, villageScope,
  type LawAst, type LawGame, type Modality,
} from '@rulecraft/simulation';

const harvest: LawAst = {
  ...villageScope, actionId: 'harvest-food', targetSelector: 'farmer', modality: 'MUST', priority: 0,
};

function fieldDecree(game: LawGame, modality: Modality, known: boolean, patch: Partial<LawAst> = {}): LawGame {
  game = confirmLaw(game, { operation: 'CREATE', lawId: 'field', commandId: 'field-create',
    ast: { ...harvest, modality, ...patch } }).game;
  if (known) {
    for (const actor of game.state.citizens.filter(({ occupation }) => occupation === 'farmer')) {
      game = notifyLaw(game, actor.id, 'field', 1);
    }
  }
  return game;
}

function harvested(game: LawGame): number {
  return game.transactions.filter(({ reason }) => reason === 'harvest-food')
    .reduce((sum, transaction) => sum + transaction.legs[0].quantity, 0);
}

test('known MUST and MUST_NOT change harvested units across matched seeds; known MAY matches baseline choices', () => {
  const totals = { baseline: 0, must: 0, mustNot: 0, may: 0 };
  for (let seed = 0; seed < 64; seed++) {
    const initial = startLawGame(fixture, seed);
    const baseline = advanceLawGame(initial);
    const must = advanceLawGame(fieldDecree(initial, 'MUST', true));
    const mustNot = advanceLawGame(fieldDecree(initial, 'MUST_NOT', true));
    const may = advanceLawGame(fieldDecree(initial, 'MAY', true));
    totals.baseline += harvested(baseline);
    totals.must += harvested(must);
    totals.mustNot += harvested(mustNot);
    totals.may += harvested(may);
    expect(may.state).toEqual(baseline.state);
    expect(may.transactions).toEqual(baseline.transactions);
    for (const game of [must, mustNot]) {
      const audit = auditSnapshot(game);
      expect(audit.remaining.coin).toBe(1_500);
      expect(audit.consumed.food + audit.remaining.food).toBe(495);
    }
  }
  expect(totals.must).toBeGreaterThan(totals.baseline);
  expect(totals.mustNot).toBeLessThan(totals.baseline);
  expect(totals.may).toBe(totals.baseline);
});

test('current prohibition is recorded without giving an unaware actor fictional deterrence or sanctions', () => {
  const initial = startLawGame(fixture, 42);
  const baseline = advanceLawGame(initial);
  const prohibited = advanceLawGame(fieldDecree(initial, 'MUST_NOT', false));
  expect(prohibited.state).toEqual(baseline.state);
  expect(prohibited.transactions).toEqual(baseline.transactions);
  const event = prohibited.events.find(({ action, legalChoice }) => action === 'harvest-food' && legalChoice);
  expect(event?.legalChoice?.[0]).toMatchObject({
    actual: { status: 'prohibited', winner: { lawId: 'field', version: 1 } },
    perceived: { status: 'optional', winner: null }, pressure: 0, noticeEventIds: [],
  });
  expect(event?.quantity).toBeGreaterThan(0);
  expect(prohibited.book.notices).toEqual([]);
});

test('stale prohibition influences choices after abolition while all official rulings and transactions remain factual', () => {
  let game = fieldDecree(startLawGame(fixture, 42), 'MUST_NOT', true);
  game = advanceLawGame(game);
  game = confirmLaw(game, { operation: 'ABOLISH', lawId: 'field', commandId: 'field-abolish' }).game;
  const advanced = advanceLawGame(game);
  const event = advanced.events.find(({ turn, actorId, legalChoice }) =>
    turn === 2 && actorId === 'citizen.0001' && legalChoice);
  expect(event?.legalChoice?.[0]).toMatchObject({
    actual: { status: 'optional', winner: null },
    perceived: { status: 'prohibited', winner: { lawId: 'field', version: 1 },
      considered: [{ eventId: 'law-event.field-create' }] },
    pressure: -55, noticeEventIds: ['notice.citizen.0001.field.1'],
  });
  expect(auditSnapshot(advanced).remaining.coin).toBe(1_500);
  expect(loadLawGame(encodeLawGame(advanced))).toEqual(advanced);
});

test('threshold crossed in morning cannot change a later morning decision but applies in afternoon', () => {
  const local = {
    ...fixture, population: { farmer: 2, forester: 0, merchant: 0, guard: 0 },
    opening: { ...fixture.opening, fieldFood: 5 },
    behaviour: { ...fixture.behaviour, restWeight: 1 },
    capacity: { ...fixture.capacity, fieldPerSlot: 1 },
  };
  const game = fieldDecree(
    startLawGame(local, 42, { changesPerTurn: 2, mustWeight: 1_000, mustNotWeight: 55 }),
    'MUST', true, { when: { operand: 'fieldFood', operator: 'GTE', value: 5 } },
  );
  const result = advanceLawGame(game);
  const morning = result.events.filter(({ phase, legalChoice }) => phase === 'morning' && legalChoice);
  expect(morning).toHaveLength(2);
  expect(morning[0]).toMatchObject({ action: 'harvest-food', quantity: 3, status: 'completed' });
  expect(morning[1]).toMatchObject({ action: 'harvest-food', quantity: 0, reason: 'capacity-contention',
    legalChoice: [{ perceivedDutyOutcome: 'blocked-at-execution' }, expect.anything()] });
  for (const event of morning) {
    expect(event.legalChoice?.[0].actual.considered[0].when).toMatchObject({ observed: 5, matched: true });
    expect(event.legalChoice?.[0].perceived.considered[0].when).toMatchObject({ observed: 5, matched: true });
  }
  const afternoon = result.events.filter(({ phase, legalChoice }) => phase === 'afternoon' && legalChoice);
  expect(afternoon).toHaveLength(2);
  for (const event of afternoon) {
    expect(event.legalChoice?.[0].actual.considered[0].when).toMatchObject({ observed: 2, matched: false });
    expect(event.legalChoice?.[0]).toMatchObject({ pressure: 0, perceivedDutyOutcome: null });
  }
});

test('a physically infeasible duty is distinct from another feasible duty that was not chosen', () => {
  const local = { ...fixture, opening: { ...fixture.opening, fieldFood: 0 } };
  let game = fieldDecree(startLawGame(local, 42), 'MUST', true);
  const rest = confirmLaw(game, {
    operation: 'CREATE', commandId: 'rest-create', lawId: 'rest', ast: { ...harvest, actionId: 'rest' },
  });
  expect(rest.issues).toContainEqual({ severity: 'WARNING', code: 'COMPETING_DUTIES', relatedLawId: 'field' });
  game = notifyLaw(rest.game, 'citizen.0001', 'rest', 1);
  const result = advanceLawGame(game);
  const event = result.events.find(({ actorId, phase, legalChoice }) =>
    actorId === 'citizen.0001' && phase === 'morning' && legalChoice);
  expect(event).toMatchObject({ action: 'rest', legalChoice: [
    { actionId: 'harvest-food', selectionBarrier: 'no-stock', weight: 0, perceivedDutyOutcome: 'infeasible-at-selection' },
    { actionId: 'rest', perceivedDutyOutcome: 'completed' },
  ] });
  expect(harvested(result)).toBe(0);

  game = fieldDecree(startLawGame(fixture, 42), 'MUST', true);
  game = confirmLaw(game, {
    operation: 'CREATE', commandId: 'rest-create', lawId: 'rest', ast: { ...harvest, actionId: 'rest' },
  }).game;
  for (const actor of game.state.citizens.filter(({ occupation }) => occupation === 'farmer')) {
    game = notifyLaw(game, actor.id, 'rest', 1);
  }
  const decisions = advanceLawGame(game).events.flatMap((entry) => entry.legalChoice ?? []);
  expect(decisions.some((decision) => decision.selectionBarrier === null && decision.perceivedDutyOutcome === 'not-chosen')).toBe(true);
});

test('v2 without decrees keeps the full v1 outcome and law-aware reload reproduces events and balances', () => {
  let legacy = startVillage(fixture, 42);
  let empty = startLawGame(fixture, 42);
  while (legacy.state.turn < 12) {
    legacy = resolveNextTurn(legacy);
    empty = advanceLawGame(empty);
  }
  expect(snapshotHashes(legacy)).toEqual({ state: '713a9e709bf6e873', events: '72f67e9184e65e5f' });
  expect(empty.state).toEqual(legacy.state);
  expect(empty.events).toEqual(legacy.events);
  expect(empty.transactions).toEqual(legacy.transactions);

  let legislated = fieldDecree(startLawGame(fixture, 42), 'MUST', true);
  while (legislated.state.turn < 6) legislated = advanceLawGame(legislated);
  legislated = confirmLaw(legislated, { operation: 'SUSPEND', lawId: 'field', commandId: 'suspend-field' }).game;
  let restored = loadLawGame(encodeLawGame(legislated));
  while (legislated.state.turn < 12) {
    legislated = advanceLawGame(legislated);
    restored = advanceLawGame(restored);
  }
  expect(lawGameHashes(restored)).toEqual(lawGameHashes(legislated));
  expect(encodeLawGame(restored)).toBe(encodeLawGame(legislated));
  expect(auditSnapshot(legislated).remaining.coin).toBe(1_500);
});
