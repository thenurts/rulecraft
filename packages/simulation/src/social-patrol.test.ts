import { expect, test } from 'vitest';
import fixture from '../../../fixtures/task-01-village.json';
import {
  advanceSociety, auditSnapshot, confirmLaw, encodeSociety, loadSociety, notifyLaw, societyDefaults,
  startSociety, villageScope, type SocietyConfig,
} from '@rulecraft/simulation';

const local = {
  ...fixture, population: { farmer: 4, guard: 2, forester: 0, merchant: 0 },
  behaviour: { ...fixture.behaviour, workWeight: 100, restWeight: 1, startingFatigueMin: 0, startingFatigueMax: 0 },
};
const config: SocietyConfig = {
  ...societyDefaults, bulletinBp: 0, peerBp: 0, contacts: 0,
  patrol: { ...societyDefaults.patrol, detectionBp: 10_000 },
};
const create = {
  operation: 'CREATE', commandId: 'ban', lawId: 'harvest-ban',
  ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST_NOT' },
};
const scenario = (seed = 42, capacity = 1, settings = config) =>
  confirmLaw(startSociety({ ...local, capacity: { ...local.capacity, patrolsPerSlot: capacity } }, seed, settings), create).game;

test('zero completed patrols, including paid guards who cannot patrol, give zero investigations or warnings', () => {
  const day = advanceSociety(scenario(42, 0));
  const patrol = day.societyDays[0].patrol;
  expect(patrol.presence).toEqual([]);
  expect(patrol.prohibitedActs.length).toBeGreaterThan(0);
  expect(patrol.investigations).toEqual([]);
  expect(day.days[0].guardsPaid).toBe(2);
  expect(day.book.notices).toEqual([]);
});

test('limited public patrol capacity uses actual action and current law evidence without duplicate detections', () => {
  const game = scenario();
  const day = advanceSociety(game);
  const { patrol } = day.societyDays[0];
  const blocked = day.events.filter(({ action, status }) => action === 'patrol' && status === 'blocked-at-execution');
  expect(blocked.length).toBeGreaterThan(0);
  expect(patrol.prohibitedActs.length).toBeGreaterThan(patrol.investigations.length);
  expect(patrol.investigations).toHaveLength(2);
  expect(new Set(patrol.investigations.map(({ act }) => act.eventId)).size).toBe(patrol.investigations.length);
  for (const investigation of patrol.investigations) {
    const { patrol: presence, act } = investigation;
    expect(day.events.find(({ id }) => id === presence.eventId)).toMatchObject({ action: 'patrol', status: 'completed' });
    expect(presence.slot).toBe(act.slot);
    expect(blocked.some(({ id }) => id === presence.eventId)).toBe(false);
    expect(day.events.find(({ id }) => id === act.eventId)).toMatchObject({ action: 'harvest-food', status: 'completed' });
    expect(investigation).toMatchObject({
      detected: true, disposition: 'education', act: {
        law: { lawId: 'harvest-ban', version: 1 }, lawEventId: 'law-event.ban',
        knewCurrentVersion: false, perceivedStatus: 'optional',
      },
    });
    expect(patrol.investigations.filter(({ patrol }) => patrol.eventId === presence.eventId).length)
      .toBeLessThanOrEqual(presence.capacity);
  }
  expect(day.book.notices.every(({ learnedAtPhase, learnedAtTurn }) =>
    learnedAtPhase === 'warning' && learnedAtTurn === 1)).toBe(true);
  expect(auditSnapshot(day).remaining).toMatchObject({ coin: 820, timber: 120 });
  expect(encodeSociety(loadSociety(encodeSociety(day)))).toBe(encodeSociety(day));
});

test('resting guards add no capacity and a failed encounter spends one allocated attempt without warning', () => {
  const sleepy = { ...local, behaviour: { ...local.behaviour, workWeight: 0, restWeight: 100 } };
  const noPatrol = confirmLaw(startSociety(sleepy, 42, config), create).game;
  const resting = advanceSociety(noPatrol);
  expect(resting.events.some(({ action, actorId, phase }) => action === 'rest' && actorId === 'citizen.0005' && phase === 'morning'))
    .toBe(true);
  expect(resting.societyDays[0].patrol.presence).toEqual([]);

  const miss = advanceSociety(scenario(42, 1, { ...config, patrol: { ...config.patrol, detectionBp: 0 } }));
  expect(miss.societyDays[0].patrol.investigations).toHaveLength(2);
  expect(miss.societyDays[0].patrol.investigations.every(({ disposition, detected }) => !detected && disposition === null))
    .toBe(true);
  expect(miss.book.notices).toEqual([]);
});

test('a remembered ban can influence citizens after repeal but cannot be sanctioned', () => {
  let game = notifyLaw(scenario(), 'citizen.0001', 'harvest-ban', 1);
  game = advanceSociety(game);
  game = confirmLaw(game, { operation: 'ABOLISH', commandId: 'repeal', lawId: 'harvest-ban' }).game;
  const day = advanceSociety(game);
  expect(day.societyDays[1].patrol.prohibitedActs).toEqual([]);
  expect(day.societyDays[1].patrol.investigations).toEqual([]);
  const remembered = day.events.find(({ turn, actorId, legalChoice }) => turn === 2 && actorId === 'citizen.0001' && legalChoice);
  expect(remembered?.legalChoice?.[0]).toMatchObject({ actual: { status: 'optional' }, perceived: { status: 'prohibited' } });
});

test('education is learned for the next day and remembered risk points to an actual warning', () => {
  const one = advanceSociety(scenario());
  const warned = one.societyDays[0].patrol.investigations.find(({ noticeId }) => noticeId !== null)!;
  const two = advanceSociety(one);
  const morning = two.events.find(({ turn, phase, actorId, choice }) =>
    turn === 2 && phase === 'morning' && actorId === warned.act.citizenId && choice);
  expect(morning?.legalChoice?.[0]).toMatchObject({ perceived: { status: 'prohibited' } });
  expect(morning?.choice?.candidates[0].utility).toMatchObject({
    risk: -50, riskEventIds: expect.arrayContaining([expect.stringMatching(/^inspection\.event\.1\./)]),
  });
  expect(one.societyDays[0].experiences.some(({ sourceEventId, component }) =>
    component === 'patrol-warning' && sourceEventId === warned.id)).toBe(true);
});

test('home rest is a performed prohibited action outside the public patrol route', () => {
  const initial = startSociety({ ...local, opening: { ...local.opening, fieldFood: 0 } }, 42, config);
  const day = advanceSociety(confirmLaw(initial, { ...create, ast: { ...create.ast, actionId: 'rest' } }).game);
  const patrol = day.societyDays[0].patrol;
  expect(patrol.presence.length).toBeGreaterThan(0);
  expect(patrol.prohibitedActs.length).toBeGreaterThan(0);
  expect(patrol.prohibitedActs.every(({ route }) => route === 'home')).toBe(true);
  expect(patrol.investigations).toEqual([]);
});
