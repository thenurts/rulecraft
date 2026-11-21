import { describe, expect, test } from 'vitest';
import { advanceSociety, auditSnapshot, confirmLaw, encodeSociety, loadSociety, villageScope } from '@rulecraft/simulation';
import { editorProfile, editorTokens, presets, readSeed } from './profiles.ts';
import { homeScreen, newSession, previous, villageReadModel, villageScreen, visit } from './world.ts';

describe('playable world', () => {
  test.each([['junior', 'campaign'], ['junior', 'sandbox'], ['full', 'campaign'], ['full', 'sandbox']] as const)(
    'starts %s %s using a versioned v4 preset', (mode, track) => {
      const session = newSession({ mode, track }, 'test-run');
      expect(session).toMatchObject({ mode, track, setup: { profile: mode, profileVersion: 1, scenarioVersion: 1 }, game: { versions: { schemaVersion: 4 } } });
      expect(villageReadModel(session.game)).toMatchObject({
        day: 0, remaining: 12, count: 40, marketFood: 45, fieldFood: 450, treasury: 500, mealOpportunities: 0,
      });
    },
  );
  test('before the first day results are absent and a real turn populates them', () => {
    const { game } = newSession({ mode: 'full', track: 'campaign' }, 'test');
    expect(villageReadModel(game).latest).toBeUndefined();
    const advanced = advanceSociety(game);
    expect(villageReadModel(advanced)).toMatchObject({
      day: 1, remaining: 11, latest: advanced.days[0], social: advanced.societyDays[0], mealOpportunities: 40,
    });
    expect(villageReadModel(advanced).households).toHaveLength(40);
  });
  test('back respects deliberate navigation and repeated destination does not grow history', () => {
    const history = visit([homeScreen], villageScreen);
    expect(visit(history, villageScreen)).toBe(history);
    expect(previous(history)).toEqual([homeScreen]);
    expect(previous([homeScreen])).toEqual([homeScreen]);
    expect(visit(history, homeScreen)).toEqual([homeScreen]);
  });
});

test('identical legislation on the same preset and seed has byte-identical outcomes across profiles', () => {
  const make = (mode: 'junior' | 'full') => {
    const { game } = newSession({ mode, track: 'campaign', seed: 52001 }, mode);
    return advanceSociety(confirmLaw(game, {
      operation: 'CREATE', lawId: 'delivery-duty', commandId: 'test-delivery',
      ast: { ...villageScope, targetSelector: 'merchant', actionId: 'market-delivery', modality: 'MUST' },
    }).game);
  };
  const junior = make('junior');
  expect(junior.fixture.population).toEqual({ farmer: 21, forester: 6, merchant: 5, guard: 8 });
  expect(junior.fixture.opening).toEqual(presets['standard-village-v1'].fixture.opening);
  expect(encodeSociety(junior)).toBe(encodeSociety(make('full')));
  expect(encodeSociety(loadSociety(encodeSociety(junior)))).toBe(encodeSociety(junior));
  expect(auditSnapshot(junior).remaining.coin).toBe(1500);
});

test('Junior campaign exposes supported predicates at day six while preserving a previously authored clause', () => {
  const session = newSession({ mode: 'junior', track: 'campaign' }, 'junior');
  const profile = editorProfile(session, session.setup);
  const wording = { targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST' } as const;
  expect(editorTokens(wording, profile, 5).when.operands).toEqual([]);
  expect(editorTokens(wording, profile, 6).when.operands).toEqual(['slot', 'fatigue', 'marketFood']);
  const withCondition = { ...wording, when: { operand: 'fieldFood', operator: 'GT', value: 0 } } as const;
  expect(editorTokens(withCondition, profile, 6).when.operands).toContain('fieldFood');
  expect(editorTokens(withCondition, profile, 6).unless.operands).toEqual([]);
  expect(editorTokens(wording, editorProfile(session), 0).when.operands).toContain('treasuryCoin');
});

test.each([['0', 0], ['4294967295', 4294967295], ['-1', undefined], ['1e3', undefined], ['', undefined], ['4294967296', undefined]])(
  'validates uint32 seed input %s', (value, expected) => { expect(readSeed(value)).toBe(expected); });

test('Sandbox records legal seeds and permits only its tested twelve-day presets', () => {
  const [standard, lean] = (['standard-village-v1', 'five-merchants-farmers-v1'] as const).map((preset) =>
    newSession({ mode: 'full', track: 'sandbox', preset, seed: 0 }, preset));
  expect(standard.game.fixture.days).toBe(12);
  expect(lean.game.fixture.days).toBe(12);
  expect(standard.game.seed).toBe(0);
  expect(lean.game.fixture.population.merchant).toBe(5);
  expect(standard.game.fixture.population.merchant).toBe(10);
  expect(standard.game.fixture.opening).toEqual(lean.game.fixture.opening);
  expect(() => newSession({ mode: 'junior', track: 'campaign', preset: 'standard-village-v1' }, 'invalid'))
    .toThrow(/Invalid preset/);
});

test('day-three amendment and day-five repeal leave old versions and avoid fresh sanctions', () => {
  let { game } = newSession({ mode: 'full', track: 'sandbox' }, 'versions');
  const command = { lawId: 'field', ast: { ...villageScope, actionId: 'harvest-food',
    targetSelector: 'farmer', modality: 'MUST_NOT' } } as const;
  game = confirmLaw(game, { ...command, operation: 'CREATE', commandId: 'create-field' }).game;
  while (game.state.turn < 3) game = advanceSociety(game);
  const history = game.events;
  game = confirmLaw(game, { ...command, operation: 'AMEND', commandId: 'amend-field',
    ast: { ...command.ast, when: { operand: 'slot', operator: 'EQ', value: 'morning' } } }).game;
  while (game.state.turn < 5) game = advanceSociety(game);
  game = confirmLaw(game, { lawId: 'field', operation: 'ABOLISH', commandId: 'retire-field' }).game;
  game = advanceSociety(game);
  expect(game.book.versions.map(({ version, effectiveFromTurn }) => [version, effectiveFromTurn]))
    .toEqual([[1, 1], [2, 4], [3, 6]]);
  expect(game.events.slice(0, history.length)).toEqual(history);
  expect(game.societyDays.at(-1)?.patrol.investigations).toEqual([]);
});
