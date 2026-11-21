import { targetMatches } from './law.ts';
import type { LawRef } from './law-book.ts';
import { citizenAccount, compareIds, villageAccounts, type Citizen, type VillageFixture, type Phase } from './model.ts';
import { keyedDraw } from './rng.ts';
import type { SocietyGame } from './society.ts';
import type { Investigation } from './social-patrol.ts';
import type { ResolvedDay, UtilityEvidence, VillageEvent } from './turn.ts';

export const behaviourDefaults = {
  hungerWeight: 4, incomeWeight: 5, fatigueWeight: 50, trustWeight: 15, attitudeWeight: 12,
  mealTrustGain: 1, unmetMealTrustLoss: 2, exertionAttitudeCost: 4,
} as const;
export type BehaviourPolicy = Readonly<Record<keyof typeof behaviourDefaults, number>>;

export interface Attitude extends LawRef {
  readonly citizenId: string;
  readonly score: number;
}

export interface Experience {
  readonly citizenId: string;
  readonly sourceEventId: string;
  readonly component: 'expected-benefit' | 'expected-cost' | 'disposition' | 'meal-access' | 'exertion' | 'patrol-warning' | 'patrol-education';
  readonly law: LawRef | null;
  readonly change: number;
}

export function attitudeKey(citizenId: string, law: LawRef): string {
  return `${citizenId}:${law.lawId}:${law.version}`;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function allocationDraw(seed: number, turn: number, phase: Phase, resource: string, actorId: string): number {
  return keyedDraw({ seed, turn, slot: phase, actorId, subsystem: `allocation.${resource}`, drawIndex: 0 });
}

function earningOpportunity(
  fixture: VillageFixture, action: string, quantity: (accountId: string) => number,
): number {
  const { economy, capacity, population } = fixture;
  const marketCoin = quantity(villageAccounts.marketCoin);
  if (action === 'market-delivery') return Math.min(economy.deliveryFee, marketCoin);
  if (action === 'harvest-food' && population.merchant > 0 && capacity.deliveriesPerSlot > 0) {
    return Math.min(10, economy.producerPrice * economy.harvestYield, Math.max(0, marketCoin - economy.deliveryFee));
  }
  return 0;
}

export function utilityParts(
  citizen: Citizen, action: string, fixture: VillageFixture, policy: BehaviourPolicy,
  quantity: (id: string) => number, pressure: number, attitude: number,
): UtilityEvidence {
  const income = earningOpportunity(fixture, action, quantity);
  const cash = quantity(citizenAccount(citizen.id, 'coin'));
  const hungry = Math.min(citizen.hunger, 10);
  return {
    need: income > 0 ? hungry * policy.hungerWeight : 0,
    income: Math.min(income, 10) * policy.incomeWeight * (cash < fixture.economy.residentPrice ? 2 : 1),
    fatigue: action === 'rest' ? 0 : -Math.floor(citizen.fatigue * policy.fatigueWeight / 100),
    trust: Math.sign(pressure) * Math.floor(citizen.trust * policy.trustWeight / 100),
    acceptance: Math.sign(pressure) * Math.trunc(attitude * policy.attitudeWeight / 100),
    risk: 0, riskEventIds: [],
  };
}

export function initialiseAttitudes(game: SocietyGame, experiences: Experience[]): Map<string, Attitude> {
  const scores = new Map(game.attitudes.map((attitude) => [attitudeKey(attitude.citizenId, attitude), attitude]));
  const citizens = new Map(game.state.citizens.map((citizen) => [citizen.id, citizen]));
  const balances = new Map(game.state.accounts.map(({ id, quantity }) => [id, quantity]));
  for (const notice of game.book.notices) {
    const { citizenId, lawId, version, eventId } = notice;
    const lawRef = { lawId, version };
    const key = attitudeKey(citizenId, lawRef);
    if (scores.has(key)) continue;
    const record = game.book.versions.find((law) => law.lawId === lawId && law.version === version)!;
    const citizen = citizens.get(citizenId)!;
    const ast = record.ast;
    const applies = record.status === 'active' && targetMatches(ast.targetSelector, citizen.occupation);
    let score = 0;
    if (applies && ast.modality !== 'MAY') {
      const earnings = earningOpportunity(game.fixture, ast.actionId, (id) => balances.get(id) ?? 0);
      const work = ast.actionId !== 'rest';
      const components = [
        { component: 'expected-benefit', change: ast.modality === 'MUST' ? work ? earnings : Math.floor(citizen.fatigue / 10) : 0 },
        { component: 'expected-cost', change: ast.modality === 'MUST_NOT' ? -earnings : work ? -5 : 0 },
        { component: 'disposition', change: work ? Math.sign(ast.modality === 'MUST' ? 1 : -1) *
          Math.floor(citizen.workDisposition / 5) : 0 },
      ] as const;
      for (const { component, change } of components) {
        if (change !== 0) experiences.push({ citizenId, sourceEventId: eventId, law: lawRef, component, change });
        score += change;
      }
    }
    scores.set(key, { citizenId, lawId, version, score: clamp(score, -100, 100) });
  }
  return scores;
}

export function settleExperiences(
  game: SocietyGame, day: ResolvedDay, attitudes: Map<string, Attitude>, experiences: Experience[],
  investigations: readonly Investigation[],
) {
  const meals = new Map(day.events.filter(({ action }) => action === 'resident-meal').map((event) => [event.actorId, event]));
  const citizens = day.state.citizens.map((citizen) => {
    const meal = meals.get(citizen.id);
    if (!meal) return citizen;
    const requested = meal.status === 'completed' ? game.config.behaviour.mealTrustGain : -game.config.behaviour.unmetMealTrustLoss;
    let trust = clamp(citizen.trust + requested, 0, 100);
    if (trust !== citizen.trust) experiences.push({
      citizenId: citizen.id, sourceEventId: meal.id, law: null, component: 'meal-access', change: trust - citizen.trust,
    });
    for (const inspection of investigations) {
      if (inspection.disposition === null || inspection.act.citizenId !== citizen.id) continue;
      if (inspection.disposition === 'education' && game.versions.schemaVersion !== 3) {
        experiences.push({
          citizenId: citizen.id, sourceEventId: inspection.id, law: inspection.act.law,
          component: 'patrol-education', change: 0,
        });
        continue;
      }
      const next = clamp(trust - game.config.patrol.warningTrustLoss, 0, 100);
      if (trust !== next) experiences.push({
        citizenId: citizen.id, sourceEventId: inspection.id, law: inspection.act.law,
        component: 'patrol-warning', change: next - trust,
      });
      trust = next;
    }
    return { ...citizen, trust };
  });

  for (const event of day.events) {
    const chosen = event.legalChoice?.find(({ actionId }) => actionId === event.action);
    const ref = chosen?.perceived.winner;
    if (!ref || !event.fatigue || event.fatigue.after <= event.fatigue.before ||
        (chosen.perceivedDutyOutcome !== 'completed' && chosen.perceivedDutyOutcome !== 'partial-at-execution')) continue;
    const key = attitudeKey(event.actorId, ref);
    const attitude = attitudes.get(key)!;
    const score = clamp(attitude.score - game.config.behaviour.exertionAttitudeCost, -100, 100);
    if (score === attitude.score) continue;
    experiences.push({ citizenId: event.actorId, sourceEventId: event.id, law: ref,
      component: 'exertion', change: score - attitude.score });
    attitudes.set(key, { ...attitude, score });
  }
  return { ...day, state: { ...day.state, citizens } };
}

export function socialMetrics(day: ResolvedDay) {
  const compliance = {
    unaware: 0, knownInapplicable: 0, knownFeasibleDuties: 0, infeasibleDuties: 0,
    completedDuties: 0, blockedDuties: 0, partialDuties: 0, unchosenDuties: 0, competingDutySlots: 0,
    performedProhibitions: 0,
  };
  const food = { demand: 0, unableToAffordUnits: 0, unavailableMarketUnits: 0, undeliveredProducerUnits: 0,
    deliveryAllocationShortfallUnits: 0, blockedDeliveryAttempts: 0, shortDeliveryAttempts: 0 };
  for (const account of day.state.accounts) {
    if (account.resource === 'food' && account.ownerId.startsWith('citizen.')) food.undeliveredProducerUnits += account.quantity;
  }

  for (const event of day.events) {
    if (event.foodAccess) {
      food.demand += event.quantity + event.foodAccess.fundingShortfall + event.foodAccess.supplyShortfall;
      food.unableToAffordUnits += event.foodAccess.fundingShortfall;
      food.unavailableMarketUnits += event.foodAccess.supplyShortfall;
    }
    if (event.action === 'market-delivery' && event.status === 'blocked-at-execution') food.blockedDeliveryAttempts++;
    if (event.action === 'market-delivery' && event.status === 'partial') food.shortDeliveryAttempts++;
    let feasible = 0;
    for (const candidate of event.legalChoice ?? []) {
      const knew = (ref: LawRef) => candidate.perceived.considered.some(({ ref: known }) =>
        ref.lawId === known.lawId && ref.version === known.version);
      for (const evidence of candidate.actual.considered) {
        if (evidence.applicable && !knew(evidence.ref)) compliance.unaware++;
        if (!evidence.applicable && knew(evidence.ref)) compliance.knownInapplicable++;
      }
      if (candidate.actual.status === 'prohibited' && event.action === candidate.actionId && performed(event)) {
        compliance.performedProhibitions++;
      }
      // This denominator follows the perceived obligation, including stale beliefs.
      if (candidate.perceivedDutyOutcome === 'infeasible-at-selection') compliance.infeasibleDuties++;
      if (candidate.perceivedDutyOutcome === 'completed') { compliance.completedDuties++; feasible++; }
      if (candidate.perceivedDutyOutcome === 'blocked-at-execution') { compliance.blockedDuties++; feasible++; }
      if (candidate.perceivedDutyOutcome === 'partial-at-execution') { compliance.partialDuties++; feasible++; }
      if (candidate.perceivedDutyOutcome === 'not-chosen') { compliance.unchosenDuties++; feasible++; }
    }
    compliance.knownFeasibleDuties += feasible;
    if (feasible > 1) compliance.competingDutySlots++;
  }
  // This is observed co-occurrence, not attribution of market scarcity solely to distribution.
  food.deliveryAllocationShortfallUnits = Math.min(food.undeliveredProducerUnits, food.unavailableMarketUnits);
  return { food, compliance };
}

export function performed(event: VillageEvent): boolean {
  return event.status === 'completed' || (event.status === 'partial' && event.quantity > 0);
}

export function sortedAttitudes(attitudes: Map<string, Attitude>): Attitude[] {
  return [...attitudes.entries()].sort(([left], [right]) => compareIds(left, right)).map(([, entry]) => entry);
}
