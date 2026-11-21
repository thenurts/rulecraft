import { describe, expect, test } from 'vitest';
import { advanceSociety } from '@rulecraft/simulation';
import { homeScreen, newSession, previous, villageReadModel, villageScreen, visit } from './world.ts';

describe('playable world', () => {
  test.each([['junior', 'campaign'], ['junior', 'sandbox'], ['full', 'campaign'], ['full', 'sandbox']] as const)(
    'starts %s %s using the same v4 fixture', (mode, track) => {
      const session = newSession({ mode, track }, 'test-run');
      expect(session).toMatchObject({ mode, track, game: { versions: { schemaVersion: 4 } } });
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
