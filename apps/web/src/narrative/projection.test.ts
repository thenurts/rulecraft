import { expect, test } from 'vitest';
import { advanceSociety, confirmLaw, encodeSociety, loadSociety, startSociety, villageScope } from '@rulecraft/simulation';
import fixture from '../../../../fixtures/task-01-village.json';
import { advisers, catalogueV1, narrativeContentVersion } from './copy.ts';
import { projectNarrative } from './projection.ts';

const poorModel = {
  ...fixture, opening: { ...fixture.opening, citizenCoin: 0 },
  population: { farmer: 0, merchant: 0, forester: 2, guard: 0 },
};

test('the pinned catalogue has at least three distinct fact-bounded templates per adviser', () => {
  const counts = new Map(Object.keys(advisers).map((id) => [id, new Set<string>()]));
  for (const { headlines, responses } of Object.values(catalogueV1)) {
    expect(new Set(headlines).size).toBe(4);
    for (const response of responses) {
      counts.get(response.adviser)!.add(response.full);
      expect(response.junior.length).toBeLessThan(response.full.length + 10);
      expect(`${response.junior} ${response.full}`).not.toMatch(/\b(fined|lazy|rebellion|hoarded|exports? boomed|refused)\b/i);
    }
  }
  expect([...counts.values()].every((copies) => copies.size >= 3)).toBe(true);
});

test('a repeated serious welfare fact remains selected with four headlines and three complete days between reuse', () => {
  let game = startSociety(poorModel, 42);
  while (game.state.turn < 12) game = advanceSociety(game);
  const { incidents, diagnostics } = projectNarrative(game, 'full');
  const serious = incidents.filter(({ facts }) => facts.family === 'MEAL_UNAFFORDABLE');
  expect(serious).toHaveLength(12);
  expect(diagnostics).toEqual([]);
  const history = new Map<string, number>();
  for (const incident of serious) {
    const prior = history.get(incident.headlineTemplateId);
    if (prior !== undefined) expect(incident.turn - prior).toBeGreaterThan(3);
    history.set(incident.headlineTemplateId, incident.turn);
    expect(incident.lawVersionRefs).toEqual([]);
    expect(incident.strength).toBe('contextual');
  }
});

test('save replay, reading mode and future-day selection retain earlier chronology and content IDs', () => {
  let game = startSociety(fixture, 42);
  while (game.state.turn < 6) game = advanceSociety(game);
  const full = projectNarrative(game, 'full');
  const saved = encodeSociety(game);
  expect(projectNarrative(loadSociety(saved), 'full')).toEqual(full);
  expect(projectNarrative(game, 'full', 'unsupported')).toEqual({
    incidents: [], diagnostics: ['unsupported-narrative-version'],
  });
  const junior = projectNarrative(game, 'junior');
  expect(junior.incidents.map(({ response: _, ...record }) => record))
    .toEqual(full.incidents.map(({ response: _, ...record }) => record));
  expect(junior.incidents.some((item, index) => item.response !== full.incidents[index].response)).toBe(true);
  game = confirmLaw(game, { operation: 'CREATE', commandId: 'later-decree', lawId: 'later-law',
    ast: { ...villageScope, targetSelector: 'farmer', modality: 'MUST_NOT', actionId: 'harvest-food' },
  }).game;
  while (game.state.turn < 12) game = advanceSociety(game);
  const derived = projectNarrative(game, 'full').incidents;
  expect(derived.filter(({ turn }) => turn <= 6)).toEqual(full.incidents);
  for (let turn = 1; turn <= 12; turn++) {
    const today = derived.filter((incident) => incident.turn === turn);
    expect(today.length).toBeLessThanOrEqual(3);
    expect(new Set(today.map(({ facts }) => facts.family)).size).toBe(today.length);
    expect(today.every(({ narrativeVersion }) => narrativeVersion === narrativeContentVersion)).toBe(true);
  }
});

test('no completed day produces no story or forced flavour', () => {
  expect(projectNarrative(startSociety(fixture, 42), 'junior')).toEqual({ incidents: [], diagnostics: [] });
});

test('a completed day with no eligible evidence remains quiet', () => {
  const quiet = advanceSociety(startSociety({
    ...poorModel, opening: { ...poorModel.opening, marketFood: 0 },
  }, 42));
  expect(quiet.state.turn).toBe(1);
  expect(quiet.events.length).toBeGreaterThan(0);
  expect(projectNarrative(quiet, 'full')).toEqual({ incidents: [], diagnostics: [] });
});
