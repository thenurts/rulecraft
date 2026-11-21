import { expect, test } from 'vitest';
import fixture from '../fixtures/task-01-village.json';
import {
  advanceSociety, auditSnapshot, encodeSociety, loadSociety, societyHashes,
} from '@rulecraft/simulation';
import { societyExample } from './task-03-scenario.mjs';

function play(game, turn) {
  while (game.state.turn < turn) game = advanceSociety(game);
  return game;
}

test('the v3 seed-42 golden replay conserves the village through a day-six checkpoint', () => {
  const six = play(societyExample(fixture), 6);
  const expected = play(six, 12);
  const resumed = play(loadSociety(encodeSociety(six)), 12);
  expect(encodeSociety(resumed)).toBe(encodeSociety(expected));
  expect(societyHashes(resumed)).toEqual({ state: '375123c46edf3305', events: '75b6f979dc9dd357' });
  expect(auditSnapshot(resumed)).toEqual({
    transactions: 888, movements: 2254,
    genesis: { food: 495, timber: 120, coin: 1500 },
    consumed: { food: 468, timber: 0, coin: 0 },
    remaining: { food: 27, timber: 120, coin: 1500 },
  });
  expect(resumed.state.accounts.every(({ quantity }) => quantity >= 0)).toBe(true);
  expect(resumed.societyDays[0].patrol.investigations.some(({ detected }) => detected)).toBe(true);
  expect(resumed.societyDays[1].news.some((entry) => entry.learnedFrom?.channel === 'peer')).toBe(true);
  expect(resumed.societyDays[11].metrics.food).toMatchObject({ unableToAffordUnits: 6, unavailableMarketUnits: 0 });
});
