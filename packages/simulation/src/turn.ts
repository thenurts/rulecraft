import type { LegalDecision } from './law-book.ts';
import { occupationAction, type ExecutableAction } from './law.ts';
import { ResourceLedger, type Movement, type Transaction } from './ledger.ts';
import {
  citizenAccount, compareIds, daySlots, nextTurn, villageAccounts,
  type Citizen, type DaySlot, type Occupation, type Phase, type VillageFixture, type VillageState,
} from './model.ts';
import { keyedDraw, scaleDraw } from './rng.ts';

type Work = typeof occupationAction[Occupation];
type Action = ExecutableAction;
type EventAction = Action | 'guard-wage' | 'resident-meal' | 'sleep-recovery' | 'fixture-genesis';
type Reason = 'occupation-mismatch' | 'unavailable-field' | 'unavailable-forest' | 'capacity-contention' |
  'no-stock' | 'insufficient-funds' | 'fatigue-limit';
type Status = 'not-eligible' | 'not-feasible-at-selection' | 'blocked-at-execution' | 'completed' | 'partial';

export interface LegalCandidate {
  readonly actionId: Action;
  readonly actual: LegalDecision;
  readonly perceived: LegalDecision;
  readonly noticeEventIds: readonly string[];
  readonly pressure: number;
}

interface CandidateEvidence extends LegalCandidate {
  readonly weight: number;
  readonly selectionBarrier: Reason | null;
  readonly perceivedDutyOutcome: 'infeasible-at-selection' | 'not-chosen' | 'blocked-at-execution' |
    'partial-at-execution' | 'completed' | null;
}

export type EvaluateLegal = (
  actor: Citizen, turn: number, slot: DaySlot, action: Action, openingQuantity: (id: string) => number,
) => LegalCandidate;

type Intent = {
  readonly action: Action;
  readonly legal?: readonly Omit<CandidateEvidence, 'perceivedDutyOutcome'>[];
};

export interface VillageEvent {
  readonly id: string;
  readonly turn: number;
  readonly phase: Phase;
  readonly actorId: string;
  readonly action: EventAction;
  readonly status: Status;
  readonly reason: Reason | null;
  readonly quantity: number;
  readonly transactionId: string | null;
  readonly fatigue: Readonly<{ before: number; after: number }> | null;
  readonly hunger: Readonly<{ before: number; after: number }> | null;
  readonly legalChoice?: readonly CandidateEvidence[];
}

export interface DailyMetrics {
  readonly turn: number;
  readonly residentsFed: number;
  readonly residentsUnmet: number;
  readonly foodConsumed: number;
  readonly foodDelivered: number;
  readonly guardsPaid: number;
  readonly marketFood: number;
}

export interface ResolvedDay {
  readonly state: VillageState;
  readonly events: readonly VillageEvent[];
  readonly transactions: readonly Transaction[];
  readonly metrics: DailyMetrics;
}

interface WorkPlan {
  readonly reason: Reason | null;
  readonly quantity: number;
}

function transfer(from: string, to: string | null, quantity: number): Movement {
  return { from, to, quantity };
}

function limit(record: Citizen, fatigue: number): Citizen {
  return { ...record, fatigue: Math.max(0, Math.min(100, fatigue)) };
}

/** Injection is scoped to kernel tests. The package entry point exposes autonomous advancement only. */
export function resolveDay(
  state: VillageState, fixture: VillageFixture, seed: number,
  chooseForTest?: (actor: Citizen, slot: DaySlot) => Action | undefined,
  evaluateLegal?: EvaluateLegal,
): ResolvedDay {
  const next = nextTurn(state.turn, fixture);
  if (next === null) throw new RangeError('The fixture is complete.');
  const turn: number = next;
  const ledger = new ResourceLedger(state.accounts, turn);
  const events: VillageEvent[] = [];
  const citizens = [...state.citizens].sort((a, b) => compareIds(a.id, b.id));
  const farmers = citizens.filter(({ occupation }) => occupation === 'farmer');
  const { capacity, economy, behaviour } = fixture;
  let foodDelivered = 0;
  let foodConsumed = 0;
  let residentsFed = 0;
  let guardsPaid = 0;

  function emit(
    phase: Phase, actor: Citizen, action: EventAction, status: Status,
    plan: WorkPlan, movements: readonly Movement[] = [], updated?: Citizen,
    legalChoice?: readonly CandidateEvidence[],
  ): void {
    const id = `event.${turn}.${events.length + 1}`;
    let transaction: Transaction | null = null;
    if (movements.length > 0) {
      if (action === 'rest' || action === 'patrol' || action === 'sleep-recovery') {
        throw new Error(`Unexpected transaction for ${action}.`);
      }
      transaction = ledger.post(action, actor.id, phase, id, movements);
    }
    events.push({
      id, turn, phase, actorId: actor.id, action, status, ...plan, transactionId: transaction?.id ?? null,
      fatigue: updated ? { before: actor.fatigue, after: updated.fatigue } : null,
      hunger: updated ? { before: actor.hunger, after: updated.hunger } : null,
      ...(legalChoice && { legalChoice }),
    });
  }

  function deliver(merchant: Citizen, quantity: number): Movement[] {
    const movements: Movement[] = [];
    let remaining = quantity;
    for (const farmer of farmers) {
      if (remaining === 0) break;
      const goods = citizenAccount(farmer.id, 'food');
      const taken = Math.min(remaining, ledger.quantity(goods));
      if (taken === 0) continue;
      movements.push(
        transfer(goods, villageAccounts.marketFood, taken),
        transfer(villageAccounts.marketCoin, citizenAccount(farmer.id, 'coin'), taken * economy.producerPrice),
      );
      remaining -= taken;
    }
    if (economy.deliveryFee > 0) {
      movements.push(transfer(villageAccounts.marketCoin, citizenAccount(merchant.id, 'coin'), economy.deliveryFee));
    }
    return movements;
  }

  const target: Readonly<Record<Work, number>> = {
    'harvest-food': economy.harvestYield, 'cut-timber': economy.timberYield,
    'market-delivery': economy.deliverySize, patrol: 1,
  };

  const configured: Readonly<Record<Work, number>> = {
    'harvest-food': capacity.fieldPerSlot, 'cut-timber': capacity.forestPerSlot,
    'market-delivery': capacity.deliveriesPerSlot, patrol: capacity.patrolsPerSlot,
  };

  function planWork(actor: Citizen, work: Work, slots: number): WorkPlan {
    if (slots === 0) {
      const reason = configured[work] === 0 && work === 'harvest-food' ? 'unavailable-field'
        : configured[work] === 0 && work === 'cut-timber' ? 'unavailable-forest' : 'capacity-contention';
      return { reason, quantity: 0 };
    }
    if (actor.fatigue >= behaviour.fatigueLimit) return { reason: 'fatigue-limit', quantity: 0 };
    if (work === 'patrol') return { reason: null, quantity: 1 };
    const supply = work === 'harvest-food' ? ledger.quantity(villageAccounts.fieldFood)
      : work === 'cut-timber' ? ledger.quantity(villageAccounts.forestTimber)
      : farmers.reduce((sum, farmer) => sum + ledger.quantity(citizenAccount(farmer.id, 'food')), 0);
    const funds = work === 'market-delivery'
      ? Math.max(0, Math.floor((ledger.quantity(villageAccounts.marketCoin) - economy.deliveryFee) / economy.producerPrice))
      : target[work];
    const quantity = Math.min(target[work], supply, funds);
    const reason = quantity === target[work] ? null
      : funds < supply && funds < target[work] ? 'insufficient-funds' : 'no-stock';
    return { reason, quantity };
  }

  function evidence(intent: Intent, status: 'completed' | 'partial' | 'blocked-at-execution') {
    return intent.legal?.map((candidate): CandidateEvidence => {
      let perceivedDutyOutcome: CandidateEvidence['perceivedDutyOutcome'] = null;
      if (candidate.perceived.status === 'required') {
        perceivedDutyOutcome = candidate.selectionBarrier ? 'infeasible-at-selection'
          : candidate.actionId !== intent.action ? 'not-chosen'
          : status === 'partial' ? 'partial-at-execution' : status;
      }
      return { ...candidate, perceivedDutyOutcome };
    });
  }

  function performWork(actor: Citizen, work: Work, phase: DaySlot, plan: WorkPlan, intent: Intent): Citizen {
    const { quantity, reason } = plan;
    if (quantity === 0) {
      emit(phase, actor, work, 'blocked-at-execution', plan, [], undefined, evidence(intent, 'blocked-at-execution'));
      return actor;
    }
    let movements: Movement[] = [];
    if (work === 'harvest-food') {
      movements = [transfer(villageAccounts.fieldFood, citizenAccount(actor.id, 'food'), quantity)];
    } else if (work === 'cut-timber') {
      movements = [transfer(villageAccounts.forestTimber, citizenAccount(actor.id, 'timber'), quantity)];
    } else if (work === 'market-delivery') {
      movements = deliver(actor, quantity);
      foodDelivered += quantity;
    }
    const updated = limit(actor, actor.fatigue +
      (work === 'harvest-food' ? behaviour.harvestFatigue : behaviour.otherWorkFatigue));
    const status = reason === null ? 'completed' : 'partial';
    emit(phase, actor, work, status, plan, movements, updated, evidence(intent, status));
    return updated;
  }

  for (const phase of daySlots) {
    const slots = { ...configured };
    // All choices read the same opening balances before execution mutates the ledger.
    const opening = evaluateLegal && new Map(ledger.balances().map(({ id, quantity }) => [id, quantity]));
    const openingQuantity = (id: string): number => {
      const quantity = opening?.get(id);
      if (quantity === undefined) throw new Error(`Unknown slot-opening account ${id}.`);
      return quantity;
    };
    const intents = citizens.map((actor): Intent => {
      const injected = chooseForTest?.(actor, phase);
      if (injected !== undefined) return { action: injected };
      const work = occupationAction[actor.occupation];
      const plan = planWork(actor, work, slots[work]);
      const workLaw = evaluateLegal?.(actor, turn, phase, work, openingQuantity);
      const restLaw = evaluateLegal?.(actor, turn, phase, 'rest', openingQuantity);
      const base = behaviour.workWeight === 0 ? 0 : behaviour.workWeight + actor.workDisposition;
      const workWeight = plan.quantity > 0 ? Math.max(base > 0 ? 1 : 0, base + (workLaw?.pressure ?? 0)) : 0;
      const restWeight = Math.max(1, behaviour.restWeight + (restLaw?.pressure ?? 0));
      const selectionBarrier = plan.quantity === 0 ? plan.reason : null;
      const legal = workLaw && restLaw && [workLaw, restLaw].some((rule) =>
        rule.actual.considered.length > 0 || rule.perceived.considered.length > 0)
        ? [{ ...workLaw, weight: workWeight, selectionBarrier },
          { ...restLaw, weight: restWeight, selectionBarrier: null }]
        : undefined;

      if (plan.quantity === 0) {
        emit(phase, actor, work, 'not-feasible-at-selection', plan);
        return { action: 'rest', legal };
      }
      const draw = keyedDraw({ seed, turn, slot: phase, actorId: actor.id, subsystem: 'choice', drawIndex: 0 });
      const action = scaleDraw(draw, workWeight + restWeight) < workWeight ? work : 'rest';
      return { action, legal };
    });

    for (const [index, actor] of citizens.entries()) {
      const intent = intents[index];
      const { action } = intent;
      if (action === 'rest') {
        const updated = limit(actor, actor.fatigue - behaviour.restRecovery);
        emit(phase, actor, action, 'completed', { quantity: 0, reason: null }, [], updated, evidence(intent, 'completed'));
        citizens[index] = updated;
      } else if (action !== occupationAction[actor.occupation]) {
        emit(phase, actor, action, 'not-eligible', { quantity: 0, reason: 'occupation-mismatch' });
      } else {
        const plan = planWork(actor, action, slots[action]);
        citizens[index] = performWork(actor, action, phase, plan, intent);
        if (plan.quantity > 0) slots[action]--;
      }
    }
  }

  // Dusk settles wages before meals. A guard's daily wage is payable in full or logged as unfunded.
  for (const actor of citizens) {
    if (actor.occupation !== 'guard' || economy.guardWage === 0) continue;
    const funded = ledger.quantity(villageAccounts.treasuryCoin) >= economy.guardWage;
    if (funded) {
      guardsPaid++;
      emit('dusk', actor, 'guard-wage', 'completed', { quantity: economy.guardWage, reason: null }, [
        transfer(villageAccounts.treasuryCoin, citizenAccount(actor.id, 'coin'), economy.guardWage),
      ]);
    } else {
      emit('dusk', actor, 'guard-wage', 'blocked-at-execution', { quantity: 0, reason: 'insufficient-funds' });
    }
  }

  for (const [index, actor] of citizens.entries()) {
    const coin = citizenAccount(actor.id, 'coin');
    const food = citizenAccount(actor.id, 'food');
    const stock = ledger.quantity(villageAccounts.marketFood);
    const affordable = Math.floor(ledger.quantity(coin) / economy.residentPrice);
    const quantity = Math.min(economy.foodPerDay, stock, affordable);
    const shortfall = economy.foodPerDay - quantity;
    const reason = shortfall === 0 ? null : affordable < stock ? 'insufficient-funds' : 'no-stock';
    const afterMeal = {
      ...actor,
      hunger: shortfall > 0 ? actor.hunger + shortfall : Math.max(0, actor.hunger - economy.foodPerDay),
    };
    const movements = quantity > 0 ? [
      transfer(coin, villageAccounts.marketCoin, quantity * economy.residentPrice),
      transfer(villageAccounts.marketFood, food, quantity),
      transfer(food, null, quantity),
    ] : [];
    emit('dusk', actor, 'resident-meal',
      shortfall === 0 ? 'completed' : quantity > 0 ? 'partial' : 'blocked-at-execution',
      { quantity, reason }, movements, afterMeal);
    foodConsumed += quantity;
    if (shortfall === 0) residentsFed++;

    const recovered = limit(afterMeal, actor.fatigue - behaviour.sleepRecovery);
    emit('dusk', afterMeal, 'sleep-recovery', 'completed', { quantity: 0, reason: null }, [], recovered);
    citizens[index] = recovered;
  }

  return {
    state: { turn, citizens, accounts: ledger.balances() }, events, transactions: ledger.transactions,
    metrics: {
      turn, residentsFed, residentsUnmet: citizens.length - residentsFed, foodConsumed,
      foodDelivered, guardsPaid, marketFood: ledger.quantity(villageAccounts.marketFood),
    },
  };
}

export function advanceVillage(state: VillageState, fixture: VillageFixture, seed: number): ResolvedDay {
  return resolveDay(state, fixture, seed);
}
