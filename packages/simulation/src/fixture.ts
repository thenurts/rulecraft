import {
  citizenAccount, compareIds, occupations, villageAccounts,
  type Account, type Citizen, type Resource, type VillageFixture, type VillageState,
} from './model.ts';
import { keyedDraw, scaleDraw, uint32 } from './rng.ts';

function record(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError(`Expected an object for ${label}.`);
  }
  return input as Record<string, unknown>;
}

function integer(input: unknown, label: string, min: number, max: number): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < min || input > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}.`);
  }
  return input;
}

function group<Key extends string>(
  input: unknown, name: string, keys: readonly Key[], max: number, positive: readonly Key[] = [],
): Record<Key, number> {
  const values = record(input, name);
  if (Object.keys(values).some((key) => !keys.some((known) => known === key))) {
    throw new TypeError(`Unexpected field in fixture ${name}.`);
  }
  const result = {} as Record<Key, number>;
  for (const key of keys) {
    result[key] = integer(values[key], `${name}.${key}`, positive.includes(key) ? 1 : 0, max);
  }
  return result;
}

export function parseVillageFixture(input: unknown): VillageFixture {
  const fixture = record(input, 'fixture');
  if (fixture.version !== 1) throw new RangeError('Unsupported village fixture version.');
  const population = group(fixture.population, 'population', occupations, 250);
  if (!Object.values(population).some(Boolean)) throw new RangeError('Fixture needs at least one citizen.');

  const behaviour = group(fixture.behaviour, 'behaviour', [
    'workWeight', 'restWeight', 'fatigueLimit', 'harvestFatigue', 'otherWorkFatigue',
    'restRecovery', 'sleepRecovery', 'startingFatigueMin', 'startingFatigueMax',
    'startingTrustMin', 'startingTrustMax', 'maxWorkDisposition',
  ], 100, ['restWeight']);
  if (behaviour.startingFatigueMin > behaviour.startingFatigueMax ||
      behaviour.startingTrustMin > behaviour.startingTrustMax) {
    throw new RangeError('Starting trait minimum exceeds its maximum.');
  }

  return {
    version: 1,
    days: integer(fixture.days, 'days', 1, 365),
    population,
    opening: group(fixture.opening, 'opening', [
      'marketFood', 'fieldFood', 'forestTimber', 'marketCoin', 'treasuryCoin', 'citizenCoin',
    ], 1_000_000),
    capacity: group(fixture.capacity, 'capacity', [
      'fieldPerSlot', 'forestPerSlot', 'deliveriesPerSlot', 'patrolsPerSlot',
    ], 1_000),
    economy: group(fixture.economy, 'economy', [
      'harvestYield', 'timberYield', 'deliverySize', 'producerPrice', 'deliveryFee',
      'residentPrice', 'foodPerDay', 'guardWage',
    ], 1_000, ['harvestYield', 'timberYield', 'deliverySize', 'producerPrice', 'residentPrice', 'foodPerDay']),
    behaviour,
  };
}

function account(
  id: string, ownerId: string, locationId: string, resource: Resource, quantity = 0,
): Account {
  return { id, ownerId, locationId, resource, quantity };
}

export function createVillage(fixture: VillageFixture, seed: number): VillageState {
  uint32(seed, 'Seed');
  const { opening, behaviour } = fixture;
  const citizens: Citizen[] = [];
  const accounts = [
    account(villageAccounts.fieldFood, 'environment.field', 'location.field', 'food', opening.fieldFood),
    account(villageAccounts.forestTimber, 'environment.forest', 'location.forest', 'timber', opening.forestTimber),
    account(villageAccounts.marketFood, 'institution.market', 'location.granary', 'food', opening.marketFood),
    account(villageAccounts.marketCoin, 'institution.market', 'location.market', 'coin', opening.marketCoin),
    account(villageAccounts.treasuryCoin, 'institution.treasury', 'location.treasury', 'coin', opening.treasuryCoin),
  ];

  for (const occupation of occupations) {
    for (let index = 0; index < fixture.population[occupation]; index++) {
      const suffix = String(citizens.length + 1).padStart(4, '0');
      const id = `citizen.${suffix}`;
      const homeId = `location.home.${suffix}`;
      const draw = (drawIndex: number, min: number, max: number) => min + scaleDraw(keyedDraw({
        seed, turn: 0, slot: 'genesis', actorId: id, subsystem: 'traits', drawIndex,
      }), max - min + 1);
      citizens.push({
        id, occupation, homeId, hunger: 0,
        fatigue: draw(0, behaviour.startingFatigueMin, behaviour.startingFatigueMax),
        trust: draw(1, behaviour.startingTrustMin, behaviour.startingTrustMax),
        workDisposition: draw(2, 0, behaviour.maxWorkDisposition),
      });
      accounts.push(
        account(citizenAccount(id, 'coin'), id, homeId, 'coin', opening.citizenCoin),
        account(citizenAccount(id, 'food'), id, homeId, 'food'),
      );
      if (occupation === 'forester') accounts.push(account(citizenAccount(id, 'timber'), id, homeId, 'timber'));
    }
  }
  accounts.sort((left, right) => compareIds(left.id, right.id));
  return { turn: 0, citizens, accounts };
}
