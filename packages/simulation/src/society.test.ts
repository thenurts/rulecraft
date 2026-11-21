import { expect, test } from 'vitest';
import fixture from '../../../fixtures/task-01-village.json';
import {
  advanceSociety, confirmLaw, encodeLawGame, encodeSociety, loadLawGame, loadSociety, notifyLaw,
  societyDefaults, startLawGame, startSociety, villageScope,
} from '@rulecraft/simulation';
import { buildContacts, learnAtDawn } from './social-news.ts';

const command = {
  operation: 'CREATE', lawId: 'field', commandId: 'create-field',
  ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST_NOT' },
};

test('zero reach, no informed source and isolated citizens give no unsupported learning', () => {
  for (const config of [
    { bulletinBp: 0, peerBp: 0, contacts: 3 },
    { bulletinBp: 0, peerBp: 10_000, contacts: 3 },
    { bulletinBp: 0, peerBp: 10_000, contacts: 0 },
  ]) {
    const game = confirmLaw(startSociety(fixture, 42, { ...societyDefaults, ...config }), command).game;
    const initial = config.contacts === 0 ? notifyLaw(game, 'citizen.0001', 'field', 1) : game;
    const day = advanceSociety(initial);
    expect(day.book.notices).toEqual(initial.book.notices);
    expect(day.societyDays[0].news).toEqual([]);
  }
});

test('a bulletin links to the confirmed version and known dawn learning applies in that morning', () => {
  const game = confirmLaw(startSociety(fixture, 42, { ...societyDefaults, bulletinBp: 10_000, peerBp: 0 }), command).game;
  const day = advanceSociety(game);
  expect(day.societyDays[0].news[0]).toMatchObject({
    type: 'publication', sourceEventId: 'law-event.create-field', law: { lawId: 'field', version: 1 },
  });
  expect(day.book.notices).toHaveLength(40);
  expect(day.book.notices[0]).toMatchObject({ learnedAtTurn: 1, learnedAtPhase: 'dawn' });
  expect(day.events.find(({ actorId, phase, legalChoice }) => actorId === 'citizen.0001' && phase === 'morning' && legalChoice))
    .toMatchObject({ legalChoice: [expect.objectContaining({
      perceived: expect.objectContaining({ status: 'prohibited' }), noticeEventIds: ['notice.citizen.0001.field.1'],
    }), expect.anything()] });
});

test('peer-only learning refers to one named prior-day notice and never cascades in the same dawn', () => {
  let game = confirmLaw(startSociety(fixture, 42, { ...societyDefaults, bulletinBp: 0, peerBp: 10_000, contacts: 1 }), command).game;
  game = notifyLaw(game, 'citizen.0001', 'field', 1);
  const one = advanceSociety(game);
  expect(one.societyDays[0].news).toEqual([expect.objectContaining({
    type: 'learning', learnedFrom: expect.objectContaining({
      channel: 'peer', peerId: 'citizen.0001', eventId: 'notice.citizen.0001.field.1',
    }),
  })]);
  expect(one.book.notices).toHaveLength(2);
  expect(advanceSociety(one).book.notices).toHaveLength(3);
});

test('gradual awareness stays stable when input order changes and can differ across seeds', () => {
  const initial = startSociety(fixture, 42);
  expect(buildContacts([...initial.state.citizens].reverse(), 42, 3)).toEqual(initial.contacts);
  expect(buildContacts(initial.state.citizens, 43, 3)).not.toEqual(initial.contacts);
  expect(initial.contacts.every(({ peers, citizenId }) =>
    peers.length === 3 && !peers.includes(citizenId) && new Set(peers).size === 3)).toBe(true);
  const game = confirmLaw(initial, command).game;
  const one = advanceSociety(game);
  expect(one.book.notices.length).toBeGreaterThan(0);
  expect(one.book.notices.length).toBeLessThan(40);
  expect(advanceSociety(one).book.notices.length).toBeGreaterThan(one.book.notices.length);
  expect(learnAtDawn(game.book, [...game.contacts].reverse(), game.config, 42, 1))
    .toEqual(learnAtDawn(game.book, game.contacts, game.config, 42, 1));
});

test('the bulletin covers only the final same-turn version, then suspension and repeal statuses', () => {
  let game = confirmLaw(startSociety(fixture, 42, { ...societyDefaults, bulletinBp: 10_000 }), command).game;
  game = confirmLaw(game, { ...command, operation: 'AMEND', commandId: 'amend', ast: { ...command.ast, modality: 'MUST' } }).game;
  game = advanceSociety(game);
  expect(game.societyDays[0].news.every(({ law }) => law.version === 2)).toBe(true);
  for (const [operation, status, version] of [['SUSPEND', 'suspended', 3], ['ABOLISH', 'abolished', 4]] as const) {
    game = advanceSociety(confirmLaw(game, { operation, commandId: status, lawId: 'field' }).game);
    expect(game.societyDays[game.societyDays.length - 1].news[0]).toMatchObject({ status, law: { version } });
  }
  expect(game.book.notices.filter(({ citizenId }) => citizenId === 'citizen.0001').map(({ version }) => version))
    .toEqual([2, 3, 4]);
});

test('dawn is part of the atomic turn and replay preserves missed repeal knowledge and historical codecs', () => {
  let old = startLawGame(fixture, 42);
  expect(loadLawGame(encodeLawGame(old))).toEqual(old);
  expect(() => loadSociety(encodeLawGame(old))).toThrow('UNSUPPORTED_SOCIETY_SAVE_VERSION');
  let game = confirmLaw(startSociety(fixture, 42, { bulletinBp: 0, peerBp: 0, contacts: 0 }), command).game;
  game = notifyLaw(game, 'citizen.0001', 'field', 1);
  game = advanceSociety(game);
  game = confirmLaw(game, { operation: 'ABOLISH', lawId: 'field', commandId: 'abolish' }).game;
  const saved = encodeSociety(game);
  const next = advanceSociety(game);
  expect(game.state.turn).toBe(1);
  expect(loadSociety(saved)).toEqual(game);
  expect(encodeSociety(advanceSociety(loadSociety(saved)))).toBe(encodeSociety(next));
  expect(next.events.find(({ turn, actorId, legalChoice }) => turn === 2 && actorId === 'citizen.0001' && legalChoice))
    .toMatchObject({ legalChoice: [expect.objectContaining({
      actual: expect.objectContaining({ status: 'optional' }), perceived: expect.objectContaining({ status: 'prohibited' }),
    }), expect.anything()] });
});
