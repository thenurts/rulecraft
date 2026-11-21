import { ResourceLedger, type Movement, type Transaction } from './ledger.ts';
import {
  citizenAccount, compareIds, daySlots, nextTurn, villageAccounts,
  type Citizen, type DaySlot, type Occupation, type Phase, type VillageFixture, type VillageState,
} from './model.ts';
import { keyedDraw, scaleDraw } from './rng.ts';

const workByOccupation = {
  farmer: 'harvest-food', forester: 'cut-timber', merchant: 'market-delivery', guard: 'patrol',
} as const satisfies Record<Occupation, string>;

type Work = typeof workByOccupation[Occupation];
type Action = Work | 'rest';
type EventAction = Action | 'guard-wage' | 'resident-meal' | 'sleep-recovery' | 'fixture-genesis';
type Reason = 'occupation-mismatch' | 'unavailable-field' | 'unavailable-forest' | 'capacity-contention' |
  'no-stock' | 'insufficient-funds' | 'fatigue-limit';
type Status = 'not-eligible' | 'not-feasible-at-selection' | 'blocked-at-execution' | 'completed' | 'partial';

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

  function performWork(actor: Citizen, work: Work, phase: DaySlot, plan: WorkPlan): Citizen {
    const { quantity, reason } = plan;
    if (quantity === 0) {
      emit(phase, actor, work, 'blocked-at-execution', plan);
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
    emit(phase, actor, work, reason === null ? 'completed' : 'partial', plan, movements, updated);
    return updated;
  }

  for (const phase of daySlots) {
    const slots = { ...configured };
    // All choices read the slot-opening balances before any action executes.
    const intents = citizens.map((actor): Action => {
      const injected = chooseForTest?.(actor, phase);
      if (injected !== undefined) return injected;
      const work = workByOccupation[actor.occupation];
      const plan = planWork(actor, work, slots[work]);
      if (plan.quantity === 0) {
        emit(phase, actor, work, 'not-feasible-at-selection', plan);
        return 'rest';
      }
      const weight = behaviour.workWeight === 0 ? 0 : behaviour.workWeight + actor.workDisposition;
      const draw = keyedDraw({ seed, turn, slot: phase, actorId: actor.id, subsystem: 'choice', drawIndex: 0 });
      return scaleDraw(draw, weight + behaviour.restWeight) < weight ? work : 'rest';
    });

    for (const [index, actor] of citizens.entries()) {
      const action = intents[index];
      if (action === 'rest') {
        const updated = limit(actor, actor.fatigue - behaviour.restRecovery);
        emit(phase, actor, action, 'completed', { quantity: 0, reason: null }, [], updated);
        citizens[index] = updated;
      } else if (action !== workByOccupation[actor.occupation]) {
        emit(phase, actor, action, 'not-eligible', { quantity: 0, reason: 'occupation-mismatch' });
      } else {
        const plan = planWork(actor, action, slots[action]);
        citizens[index] = performWork(actor, action, phase, plan);
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
