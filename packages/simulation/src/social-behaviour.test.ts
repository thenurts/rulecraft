import { expect, test } from 'vitest';
import fixture from '../../../fixtures/task-01-village.json';
import {
  advanceSociety, auditSnapshot, confirmLaw, encodeSociety, loadSociety, societyDefaults,
  startSociety, villageAccounts, villageScope,
} from '@rulecraft/simulation';
import { utilityParts } from './social-behaviour.ts';

const command = {
  operation: 'CREATE', lawId: 'field', commandId: 'field',
  ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST' },
};

test('slot and meal allocation draw independent lotteries, link applicants and winners and ignore input order', () => {
  const scarce = {
    ...fixture, population: { farmer: 2, guard: 0, forester: 0, merchant: 0 },
    opening: { ...fixture.opening, marketFood: 1 },
    capacity: { ...fixture.capacity, fieldPerSlot: 1 },
    behaviour: { ...fixture.behaviour, workWeight: 100, restWeight: 1, startingFatigueMin: 0, startingFatigueMax: 0 },
  };
  const config = { ...societyDefaults, behaviour: { ...societyDefaults.behaviour, fatigueWeight: 0 } };
  const harvest = new Set();
  const meals = new Set();
  for (let seed = 0; seed < 32; seed++) {
    const opening = startSociety(scarce, seed, config);
    const day = advanceSociety(opening);
    for (const event of day.societyDays[0].allocations) {
      if (event.resource === 'harvest-food' && event.phase === 'morning') {
        expect(event.reason).toBe('slot-capacity');
        expect(event.applicants).toHaveLength(2);
        harvest.add(event.winners[0].citizenId);
      }
      if (event.resource === 'market-food') {
        expect(event.reason).toBe('stock');
        meals.add(event.winners[0].citizenId);
      }
      for (const winner of event.winners) expect(day.events.some(({ id }) => id === winner.eventId)).toBe(true);
    }
    expect(day).toEqual(advanceSociety({ ...opening, state: {
      ...opening.state, citizens: [...opening.state.citizens].reverse(), accounts: [...opening.state.accounts].reverse(),
    } }));
    expect(auditSnapshot(day).remaining.coin).toBe(740);
  }
  expect(harvest.size).toBe(2);
  expect(meals.size).toBe(2);
});

test('poor foresters cannot get food through unfunded transfers and shortage counts are separate', () => {
  const local = { ...fixture, population: { farmer: 0, forester: 2, merchant: 0, guard: 0 },
    opening: { ...fixture.opening, citizenCoin: 0 } };
  const poor = advanceSociety(startSociety(local, 42));
  expect(poor.societyDays[0].metrics.food).toMatchObject({ demand: 2, unableToAffordUnits: 2, unavailableMarketUnits: 0 });
  expect(poor.state.citizens.every(({ hunger }) => hunger === 1)).toBe(true);
  expect(poor.transactions.every(({ reason }) => reason !== 'resident-meal')).toBe(true);
  expect(auditSnapshot(poor).remaining).toMatchObject({ food: 495, coin: 700, timber: 120 });

  const supply = advanceSociety(startSociety({ ...local,
    opening: { ...local.opening, citizenCoin: 20, marketFood: 0 },
  }, 42));
  expect(supply.societyDays[0].metrics.food).toMatchObject({ demand: 2, unableToAffordUnits: 0, unavailableMarketUnits: 2 });
  expect(supply.societyDays[0].allocations.find(({ resource }) => resource === 'market-food')?.winners).toEqual([]);
});

test('the market records unavailable food alongside grower inventory without inventing a delivery', () => {
  const local = { ...fixture, population: { farmer: 2, forester: 0, merchant: 0, guard: 0 },
    opening: { ...fixture.opening, marketFood: 0 },
    behaviour: { ...fixture.behaviour, workWeight: 100, restWeight: 1, startingFatigueMin: 0, startingFatigueMax: 0 } };
  const day = advanceSociety(startSociety(local, 42));
  expect(day.societyDays[0].metrics.food).toMatchObject({
    demand: 2, unavailableMarketUnits: 2, unableToAffordUnits: 0, deliveryAllocationShortfallUnits: 2,
  });
  expect(day.societyDays[0].metrics.food.undeliveredProducerUnits).toBeGreaterThan(0);
  expect(day.days[0].foodDelivered).toBe(0);
});

test('utility separately explains income, hunger, fatigue, trust and acceptance; rest is not free income', () => {
  const { fixture: model, state } = startSociety(fixture, 42);
  const actor = { ...state.citizens[0], hunger: 3, fatigue: 40, trust: 80 };
  const available = (id: string) => id === villageAccounts.marketCoin ? 200 : 0;
  const utility = utilityParts(actor, 'harvest-food', model, societyDefaults.behaviour, available, 60, 75);
  expect(utility).toMatchObject({ need: 12, income: 30, fatigue: -20, trust: 12, acceptance: 9 });
  expect(utilityParts(actor, 'harvest-food', model, societyDefaults.behaviour, () => 0, 60, 75))
    .toMatchObject({ need: 0, income: 0 });
  expect(utilityParts(actor, 'rest', model, societyDefaults.behaviour, available, 0, 75))
    .toMatchObject({ need: 0, income: 0, fatigue: 0, trust: 0, acceptance: 0 });
});

test('triangulates known feasible duties, blocked work and experience-grounded attitude and trust', () => {
  const local = { ...fixture, capacity: { ...fixture.capacity, fieldPerSlot: 1 },
    behaviour: { ...fixture.behaviour, restWeight: 1, startingFatigueMin: 0, startingFatigueMax: 0 } };
  const initial = startSociety(local, 42, { ...societyDefaults, bulletinBp: 10_000 });
  const legislated = confirmLaw(initial, command).game;
  expect(legislated.state).toEqual(initial.state);
  expect(legislated.attitudes).toEqual([]);
  const day = advanceSociety(legislated);
  const metrics = day.societyDays[0].metrics.compliance;
  expect(metrics.unaware).toBe(0);
  expect(metrics.blockedDuties).toBeGreaterThan(0);
  expect(metrics.knownFeasibleDuties).toBe(metrics.blockedDuties + metrics.completedDuties +
    metrics.unchosenDuties + metrics.partialDuties);
  const experiences = day.societyDays[0].experiences;
  expect(experiences.some(({ component }) => component === 'exertion')).toBe(true);
  for (const record of experiences.filter(({ component }) => component === 'meal-access' || component === 'exertion')) {
    expect(day.events.some(({ id }) => id === record.sourceEventId)).toBe(true);
  }
  expect(day.attitudes.every(({ score }) => score >= -100 && score <= 100)).toBe(true);
  expect(loadSociety(encodeSociety(day))).toEqual(day);
});
