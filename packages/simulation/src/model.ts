export const schemaVersion = 1;
export const engineVersion = 'headless-v1';
export const contentVersion = 'village-v1';

export const occupations = ['farmer', 'forester', 'merchant', 'guard'] as const;
export const daySlots = ['morning', 'afternoon'] as const;
export type Occupation = typeof occupations[number];
export type DaySlot = typeof daySlots[number];
export type Phase = 'genesis' | DaySlot | 'dusk';
export type Resource = 'food' | 'timber' | 'coin';

export interface VillageFixture {
  readonly version: 1;
  readonly days: number;
  readonly population: Readonly<Record<Occupation, number>>;
  readonly opening: Readonly<Record<
    'marketFood' | 'fieldFood' | 'forestTimber' | 'marketCoin' | 'treasuryCoin' | 'citizenCoin', number
  >>;
  readonly capacity: Readonly<Record<
    'fieldPerSlot' | 'forestPerSlot' | 'deliveriesPerSlot' | 'patrolsPerSlot', number
  >>;
  readonly economy: Readonly<Record<
    'harvestYield' | 'timberYield' | 'deliverySize' | 'producerPrice' | 'deliveryFee' |
    'residentPrice' | 'foodPerDay' | 'guardWage', number
  >>;
  readonly behaviour: Readonly<Record<
    'workWeight' | 'restWeight' | 'fatigueLimit' | 'harvestFatigue' | 'otherWorkFatigue' |
    'restRecovery' | 'sleepRecovery' | 'startingFatigueMin' | 'startingFatigueMax' |
    'startingTrustMin' | 'startingTrustMax' | 'maxWorkDisposition', number
  >>;
}

export interface Citizen {
  readonly id: string;
  readonly occupation: Occupation;
  readonly homeId: string;
  readonly fatigue: number;
  readonly hunger: number;
  readonly trust: number;
  readonly workDisposition: number;
}

export interface Account {
  readonly id: string;
  readonly ownerId: string;
  readonly locationId: string;
  readonly resource: Resource;
  readonly quantity: number;
}

export interface VillageState {
  readonly turn: number;
  readonly citizens: readonly Citizen[];
  readonly accounts: readonly Account[];
}

export const villageAccounts = {
  fieldFood: 'account.field.food',
  forestTimber: 'account.forest.timber',
  marketFood: 'account.market.food',
  marketCoin: 'account.market.coin',
  treasuryCoin: 'account.treasury.coin',
} as const;

export function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function citizenAccount(citizenId: string, resource: Resource): string {
  return `account.${citizenId}.${resource}`;
}

export function nextTurn(turn: number, fixture: VillageFixture): number | null {
  if (!Number.isInteger(turn) || turn < 0 || turn > fixture.days) {
    throw new RangeError('Turn is outside the fixture clock.');
  }
  return turn === fixture.days ? null : turn + 1;
}
