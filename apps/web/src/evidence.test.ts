import { expect, test } from 'vitest';
import { advanceSociety, auditSnapshot, confirmLaw, encodeSociety, loadSociety, notifyLaw, startSociety,
  societyDefaults, villageScope } from '@rulecraft/simulation';
import fixture from '../../../fixtures/task-01-village.json';
import { dayDigest, dispositionLabel, inquiryEvidence } from './evidence.ts';

const wording = { ...villageScope, targetSelector: 'farmer', modality: 'MUST_NOT', actionId: 'harvest-food',
  when: { operand: 'slot', operator: 'EQ', value: 'morning' } };
function withLaw(game: ReturnType<typeof startSociety>) {
  return confirmLaw(game, { operation: 'CREATE', lawId: 'harvest', commandId: 'harvest-create', ast: wording }).game;
}

test('a factual digest has no records before day one and every highlight identifies a real event', () => {
  const opening = withLaw(startSociety(fixture, 42));
  expect(dayDigest(opening, 0)).toBeNull();
  expect(inquiryEvidence(opening, 'missing')).toBeNull();
  const game = advanceSociety(opening);
  const digest = dayDigest(game, 1)!;
  expect(digest.highlights.length).toBeGreaterThan(0);
  for (const item of digest.highlights) expect(inquiryEvidence(game, item.id)?.action).toEqual(item);
  const linked = game.events.find(({ transactionId, turn }) => turn === 1 && transactionId)!;
  const evidence = inquiryEvidence(game, linked.id)!;
  expect(evidence.transaction?.eventId).toBe(linked.id);
  expect(evidence.transaction?.legs.every(({ from, to }) => from || to)).toBe(true);
});

test('typed education and formal warnings use distinct labels and preserve action, guard and law references', () => {
  let game = confirmLaw(withLaw(startSociety(fixture, 42)), { operation: 'CREATE', lawId: 'patrol',
    commandId: 'patrol-create', ast: { ...villageScope, targetSelector: 'guard', actionId: 'patrol', modality: 'MUST' } }).game;
  while (game.state.turn < 12) game = advanceSociety(game);
  const dispositions = game.societyDays.flatMap((day) => day.patrol.investigations);
  for (const kind of ['education', 'warning'] as const) {
    const result = dispositions.find(({ disposition }) => disposition === kind)!;
    expect(dispositionLabel(result.disposition)).toBe(kind === 'education' ? 'Education' : 'Formal warning');
    expect(inquiryEvidence(game, result.id)?.inspection).toEqual(result);
    expect(inquiryEvidence(game, result.act.eventId)?.action?.actorId).toBe(result.act.citizenId);
    expect(inquiryEvidence(game, result.patrol.eventId)?.action?.action).toBe('patrol');
    expect(inquiryEvidence(game, result.act.lawEventId)?.version?.version).toBe(result.act.law.version);
    if (result.noticeId) expect(inquiryEvidence(game, result.noticeId)?.noticeOrigin?.id).toBe(result.id);
  }
});

test('a prohibition can stay in a resident’s beliefs after abolition without becoming current law', () => {
  let game = withLaw(startSociety(fixture, 42, { ...societyDefaults, bulletinBp: 0, peerBp: 0 }));
  game = notifyLaw(game, 'citizen.0001', 'harvest', 1);
  game = advanceSociety(game);
  game = confirmLaw(game, { operation: 'ABOLISH', lawId: 'harvest', commandId: 'abolish' }).game;
  game = advanceSociety(loadSociety(encodeSociety(game)));
  const action = game.events.find(({ turn, phase, actorId, legalChoice }) =>
    turn === 2 && phase === 'morning' && actorId === 'citizen.0001' && legalChoice)!;
  expect(inquiryEvidence(game, action.id)?.action?.legalChoice?.[0]).toMatchObject({
    actual: { status: 'optional' }, perceived: { status: 'prohibited' },
  });
  expect(dayDigest(game, 2)?.social.patrol.prohibitedActs).toEqual([]);
  expect(auditSnapshot(game).remaining.coin).toBe(1500);
});

test('an unfunded meal has no transaction and a day with no patrol has no investigation', () => {
  const game = advanceSociety(withLaw(startSociety({ ...fixture,
    opening: { ...fixture.opening, citizenCoin: 0 }, capacity: { ...fixture.capacity, patrolsPerSlot: 0 },
  }, 42)));
  const meal = game.events.find(({ action, foodAccess }) => action === 'resident-meal' && (foodAccess?.fundingShortfall ?? 0) > 0)!;
  expect(inquiryEvidence(game, meal.id)).toMatchObject({ transaction: undefined, action: { quantity: 0 } });
  expect(dayDigest(game, 1)).toMatchObject({ education: 0, warnings: 0, social: { patrol: { presence: [], investigations: [] } } });
});
