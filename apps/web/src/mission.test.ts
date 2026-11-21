import { expect, test } from 'vitest';
import { advanceSociety, confirmLaw, villageScope } from '@rulecraft/simulation';
import { inquiryEvidence } from './evidence.ts';
import { foodReport, lessonWitnesses } from './mission.ts';
import { newSession } from './world.ts';

test('the day-six summary is stable after day 12 and meal diagnostics reconcile with the recorded actions', () => {
  let { game } = newSession({ mode: 'junior', track: 'campaign', seed: 20000 }, 'mission');
  expect(foodReport(game, 0)).toMatchObject({ fed: 0, observed: 0, total: 480, supply: 0, affordability: 0 });
  while (game.state.turn < 6) game = advanceSociety(game);
  const checkpoint = foodReport(game, 6);
  expect(checkpoint.observed).toBe(240);
  expect(checkpoint.residents.reduce((sum, { fed }) => sum + fed, 0)).toBe(checkpoint.fed);
  expect(lessonWitnesses(game, 6).informed).toBeUndefined();
  while (game.state.turn < 12) game = advanceSociety(game);
  const final = foodReport(game, 12);
  expect(foodReport(game, 6)).toEqual(checkpoint);
  expect(final.fed + final.supply + final.affordability).toBe(480);
  expect(final.consecutive).toBeLessThanOrEqual(final.repeated.length);
  for (const person of final.repeated) {
    expect(inquiryEvidence(game, person.lastMiss!)?.action?.actorId).toBe(person.id);
  }
});

test('lesson only credits an informed recorded delivery with matching notice, ruling and transfer', () => {
  let { game } = newSession({ mode: 'full', track: 'campaign', seed: 20000 }, 'lesson');
  game = confirmLaw(game, {
    operation: 'CREATE', lawId: 'delivery-duty', commandId: 'confirm-delivery-duty',
    ast: { ...villageScope, targetSelector: 'merchant', actionId: 'market-delivery', modality: 'MUST' },
  }).game;
  expect(lessonWitnesses(game, 0)).toMatchObject({ harvest: undefined, delivery: undefined, informed: undefined });
  while (game.state.turn < 6) game = advanceSociety(game);
  const source = lessonWitnesses(game, 6).informed!;
  expect(source.law).toEqual({ lawId: 'delivery-duty', version: 1 });
  expect(inquiryEvidence(game, source.event.id)?.transaction).toMatchObject({ reason: 'market-delivery' });
  expect(inquiryEvidence(game, source.notice.eventId)?.notice?.citizenId).toBe(source.event.actorId);
  const absentNotice = { ...game, book: { ...game.book, notices: [] } };
  expect(lessonWitnesses(absentNotice, 6).informed).toBeUndefined();
});
