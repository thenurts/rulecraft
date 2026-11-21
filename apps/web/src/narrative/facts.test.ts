import { expect, test } from 'vitest';
import {
  advanceSociety, auditSnapshot, confirmLaw, encodeSociety, loadSociety,
  societyHashes, startSociety, startSocietyV3, villageScope, type SocietyGame,
} from '@rulecraft/simulation';
import fixture from '../../../../fixtures/task-01-village.json';
import { completedCompetingDutiesDay } from '../../../../tests/fixtures/task-05-competing-duties.ts';
import { extractCandidates } from './facts.ts';

function days(game: SocietyGame, turn: number) {
  while (game.state.turn < turn) game = advanceSociety(game);
  return game;
}

function example(game = startSociety(fixture, 42)) {
  const one = confirmLaw(game, {
    operation: 'CREATE', lawId: 'morning-harvest-ban', commandId: 'create-harvest-ban',
    ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST_NOT',
      when: { operand: 'slot', operator: 'EQ', value: 'morning' } },
  }).game;
  return confirmLaw(one, {
    operation: 'CREATE', lawId: 'village-patrol', commandId: 'create-village-patrol',
    ast: { ...villageScope, targetSelector: 'guard', actionId: 'patrol', modality: 'MUST' },
  }).game;
}

const causes = (game: SocietyGame) => extractCandidates(game).candidates.map(({ facts }) => facts.family);

test('the 12-day example produces independently witnessed families without changing encoded state, audit or hashes', () => {
  const game = days(example(), 12);
  const snapshot = encodeSociety(game);
  const hashes = societyHashes(game);
  const audit = auditSnapshot(game);
  const projection = extractCandidates(game);
  expect(projection.diagnostics).toEqual([]);
  expect(causes(game)).toEqual(expect.arrayContaining([
    'MEAL_UNAFFORDABLE', 'EDUCATION', 'FORMAL_WARNING', 'PATROL_CAPACITY_GAP', 'FOOD_ACCESS_SUCCESS',
  ]));
  expect(encodeSociety(game)).toBe(snapshot);
  expect(societyHashes(game)).toEqual(hashes);
  expect(auditSnapshot(game)).toEqual(audit);
  expect(projection).toEqual(extractCandidates(loadSociety(snapshot)));
});

test('education uses a verified notice and ignorance, while formal warning uses prior knowledge', () => {
  const game = days(example(), 12);
  const encounters = game.societyDays.flatMap((day) => day.patrol.investigations);
  for (const story of extractCandidates(game).candidates) {
    if (story.facts.family !== 'EDUCATION' && story.facts.family !== 'FORMAL_WARNING') continue;
    const entry = encounters.find(({ id }) => id === story.witnessEventIds[0])!;
    expect(entry).toBeDefined();
    expect(entry.act.knewCurrentVersion).toBe(story.facts.family === 'FORMAL_WARNING');
    expect(entry.disposition).toBe(story.facts.family === 'FORMAL_WARNING' ? 'warning' : 'education');
    expect(story.lawVersionRefs).toContainEqual(entry.act.law);
  }
  const missingNotices = { ...game, book: { ...game.book, notices: [] } };
  expect(causes(missingNotices)).not.toContain('EDUCATION');
  expect(extractCandidates(missingNotices).diagnostics).toEqual(expect.arrayContaining([expect.stringMatching(/education-notice/)]));
});

test('removed or duplicate patrol witnesses and invalid legal versions suppress enforcement stories', () => {
  const game = days(example(), 12);
  const removed = { ...game, events: game.events.filter(({ action }) => action !== 'patrol') };
  expect(causes(removed)).not.toContain('EDUCATION');
  expect(causes(removed)).not.toContain('FORMAL_WARNING');
  expect(causes(removed)).not.toContain('PATROL_CAPACITY_GAP');
  const broken = { ...game, book: { ...game.book, versions: [] } };
  expect(causes(broken)).not.toContain('FORMAL_WARNING');
  const inapplicable: SocietyGame = { ...game, events: game.events.map((event) => !event.legalChoice ? event : {
    ...event, legalChoice: event.legalChoice.map((choice) => ({
      ...choice, actual: { ...choice.actual, considered: choice.actual.considered.map((rule) => ({ ...rule, applicable: false })) },
    })),
  }) };
  expect(causes(inapplicable)).not.toContain('FORMAL_WARNING');
  expect(causes(inapplicable)).not.toContain('EDUCATION');
  const duplicate = { ...game, events: [...game.events, ...game.events.filter(({ action }) => action === 'patrol')] };
  expect(causes(duplicate)).not.toContain('EDUCATION');
});

test('stockout and empty purses have different independent evidence, and joint absence does not prove unaffordability with food present', () => {
  const tight = (marketFood: number, citizenCoin: number) => days(startSociety({
    ...fixture, opening: { ...fixture.opening, marketFood, citizenCoin },
    population: { farmer: 0, merchant: 0, guard: 0, forester: 2 },
  }, 42), 1);
  expect(causes(tight(0, 20))).toContain('MEAL_STOCKOUT');
  expect(causes(tight(0, 20))).not.toContain('MEAL_UNAFFORDABLE');
  expect(causes(tight(4, 0))).toContain('MEAL_UNAFFORDABLE');
  expect(causes(tight(4, 0))).not.toContain('MEAL_STOCKOUT');
  expect(causes(tight(0, 0))).not.toContain('MEAL_UNAFFORDABLE');
});

test('an all-fed statistic alone cannot produce a story without each meal witness', () => {
  const game = days(startSociety(fixture, 42), 1);
  expect(causes(game)).toContain('FOOD_ACCESS_SUCCESS');
  const missed = { ...game, events: game.events.filter(({ action }) => action !== 'resident-meal') };
  expect(causes(missed)).not.toContain('FOOD_ACCESS_SUCCESS');
});

test('fatigue requires a work-related feasibility record and competing duties require two feasible perceived winners', () => {
  const tired = days(startSociety({ ...fixture,
    behaviour: { ...fixture.behaviour, startingFatigueMin: 95, startingFatigueMax: 95 },
  }, 42), 1);
  expect(causes(tired)).toContain('FATIGUE_BLOCKED_WORK');
  expect(causes({ ...tired, events: tired.events.filter(({ reason }) => reason !== 'fatigue-limit') }))
    .not.toContain('FATIGUE_BLOCKED_WORK');
  const game = completedCompetingDutiesDay();
  expect(causes(game)).toContain('COMPETING_KNOWN_DUTIES');
  expect(causes({ ...game, book: { ...game.book, notices: [] } })).not.toContain('COMPETING_KNOWN_DUTIES');
  const ineligible = { ...game, events: game.events.map((event) => !event.legalChoice ? event : {
    ...event, legalChoice: event.legalChoice.map((choice) => choice.actionId === 'rest'
      ? { ...choice, selectionBarrier: 'no-stock' as const } : choice),
  }) };
  expect(causes(ineligible)).not.toContain('COMPETING_KNOWN_DUTIES');
});

test('historical education is still education and the detector creates no unsupported family', () => {
  const v3 = days(example(startSocietyV3(fixture, 42)), 12);
  expect(causes(v3)).toContain('EDUCATION');
  const forbidden = /EXPORT|FINE|RENTAL|MOOD|REVOLT/i;
  expect(causes(v3).some((family) => forbidden.test(family))).toBe(false);
  expect(societyHashes(v3)).toEqual({ state: '375123c46edf3305', events: '75b6f979dc9dd357' });
});
