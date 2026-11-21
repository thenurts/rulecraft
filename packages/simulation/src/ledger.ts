import { citizenAccount, compareIds, villageAccounts, type Account, type Phase, type Resource } from './model.ts';

export type TransactionReason = 'fixture-genesis' | 'harvest-food' | 'cut-timber' |
  'market-delivery' | 'resident-meal' | 'guard-wage';

export interface Movement {
  readonly from: string | null;
  readonly to: string | null;
  readonly quantity: number;
}

interface BalanceChange {
  readonly accountId: string;
  readonly before: number;
  readonly after: number;
}

export interface LedgerLeg {
  readonly resource: Resource;
  readonly quantity: number;
  readonly from: BalanceChange | null;
  readonly to: BalanceChange | null;
}

export interface Transaction {
  readonly id: string;
  readonly eventId: string;
  readonly turn: number;
  readonly phase: Phase;
  readonly actorId: string;
  readonly reason: TransactionReason;
  readonly legs: readonly LedgerLeg[];
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Resource ledger: ${message}`);
}

function validQuantity(quantity: number): boolean {
  return Number.isSafeInteger(quantity) && quantity >= 0;
}

export class ResourceLedger {
  readonly transactions: Transaction[] = [];
  private readonly accounts = new Map<string, Account>();

  private readonly turn: number;

  constructor(accounts: readonly Account[], turn: number) {
    this.turn = turn;
    for (const account of accounts) {
      invariant(account.id && account.ownerId && account.locationId &&
        ['food', 'timber', 'coin'].includes(account.resource) && validQuantity(account.quantity),
      `invalid account ${account.id}`);
      invariant(!this.accounts.has(account.id), `duplicate account ${account.id}`);
      this.accounts.set(account.id, { ...account });
    }
  }

  private account(id: string): Account {
    const account = this.accounts.get(id);
    invariant(account, `unknown account ${id}`);
    return account;
  }

  quantity(id: string): number {
    return this.account(id).quantity;
  }

  balances(): Account[] {
    return Array.from(this.accounts.values()).sort((left, right) => compareIds(left.id, right.id));
  }

  post(
    reason: TransactionReason, actorId: string, phase: Phase, eventId: string, movements: readonly Movement[],
  ): Transaction {
    invariant(movements.length > 0, 'empty transaction');
    const draft = new Map<string, number>();
    const change = (account: Account, delta: number): BalanceChange => {
      const before = draft.get(account.id) ?? account.quantity;
      const after = before + delta;
      invariant(validQuantity(after), `invalid balance for ${account.id}`);
      draft.set(account.id, after);
      return { accountId: account.id, before, after };
    };

    const legs = movements.map((movement): LedgerLeg => {
      const { quantity } = movement;
      const from = movement.from === null ? null : this.account(movement.from);
      const to = movement.to === null ? null : this.account(movement.to);
      invariant(validQuantity(quantity) && quantity > 0, 'invalid movement quantity');
      invariant(from || to, 'movement is missing both endpoints');
      invariant(!from || !to || (from.id !== to.id && from.resource === to.resource),
        'movement must connect distinct accounts of the same resource');
      invariant(from || (this.turn === 0 && phase === 'genesis' && reason === 'fixture-genesis'),
        'unregistered source');
      invariant(to || (reason === 'resident-meal' && phase === 'dusk' &&
        from?.resource === 'food' && from.ownerId === actorId), 'unregistered sink');
      return {
        resource: (from ?? to)!.resource,
        quantity,
        from: from && change(from, -quantity),
        to: to && change(to, quantity),
      };
    });

    this.validatePosting(reason, actorId, phase, movements);
    for (const [id, quantity] of draft) {
      this.accounts.set(id, { ...this.account(id), quantity });
    }
    const transaction = {
      id: `tx.${this.turn}.${this.transactions.length + 1}`,
      eventId, turn: this.turn, phase, actorId, reason, legs,
    };
    this.transactions.push(transaction);
    return transaction;
  }

  private validatePosting(
    reason: TransactionReason, actor: string, phase: Phase, movements: readonly Movement[],
  ): void {
    const [first, second, third] = movements;
    if (reason === 'fixture-genesis') {
      invariant(phase === 'genesis' && this.turn === 0 && actor === 'scenario.village' &&
        this.transactions.length === 0 && movements.every(({ from }) => from === null), 'invalid genesis');
      return;
    }
    invariant(this.turn > 0, 'only genesis may post at turn zero');
    if (reason === 'harvest-food' || reason === 'cut-timber') {
      const source = reason === 'harvest-food' ? villageAccounts.fieldFood : villageAccounts.forestTimber;
      const resource = reason === 'harvest-food' ? 'food' : 'timber';
      invariant((phase === 'morning' || phase === 'afternoon') && movements.length === 1 &&
        first.from === source && first.to === citizenAccount(actor, resource), 'invalid harvest');
    } else if (reason === 'guard-wage') {
      invariant(phase === 'dusk' && movements.length === 1 && first.from === villageAccounts.treasuryCoin &&
        first.to === citizenAccount(actor, 'coin'), 'invalid wage');
    } else if (reason === 'resident-meal') {
      const food = citizenAccount(actor, 'food');
      invariant(phase === 'dusk' && movements.length === 3 && first.from === citizenAccount(actor, 'coin') &&
        first.to === villageAccounts.marketCoin && second.from === villageAccounts.marketFood &&
        second.to === food && third.from === food && third.to === null && second.quantity === third.quantity,
      'invalid meal');
    } else {
      invariant(reason === 'market-delivery' && (phase === 'morning' || phase === 'afternoon') &&
        movements.length >= 2, 'invalid delivery');
      let index = 0;
      for (; index + 1 < movements.length; index += 2) {
        const goods = movements[index];
        const payment = movements[index + 1];
        const producer = goods.from && this.account(goods.from).ownerId;
        invariant(producer && goods.from === citizenAccount(producer, 'food') &&
          goods.to === villageAccounts.marketFood && payment.from === villageAccounts.marketCoin &&
          payment.to === citizenAccount(producer, 'coin'), 'delivery must pay the owner of the food');
      }
      const fee = movements[index];
      invariant(!fee || (fee.from === villageAccounts.marketCoin && fee.to === citizenAccount(actor, 'coin')),
        'invalid delivery fee');
    }
  }
}

export function genesisTransactions(accounts: readonly Account[], eventId: string): readonly Transaction[] {
  const ledger = new ResourceLedger(accounts.map((account) => ({ ...account, quantity: 0 })), 0);
  const movements = accounts.filter(({ quantity }) => quantity > 0)
    .map(({ id, quantity }) => ({ from: null, to: id, quantity }));
  if (movements.length > 0) ledger.post('fixture-genesis', 'scenario.village', 'genesis', eventId, movements);
  return ledger.transactions;
}

type Totals = Record<Resource, number>;

export interface ResourceAudit {
  readonly transactions: number;
  readonly movements: number;
  readonly genesis: Readonly<Totals>;
  readonly consumed: Readonly<Totals>;
  readonly remaining: Readonly<Totals>;
}

const emptyTotals = (): Totals => ({ food: 0, timber: 0, coin: 0 });

export function auditResources(
  opening: readonly Account[], final: readonly Account[], transactions: readonly Transaction[],
): ResourceAudit {
  let ledger = new ResourceLedger(opening.map((account) => ({ ...account, quantity: 0 })), 0);
  let turn = 0;
  const genesis = emptyTotals();
  const consumed = emptyTotals();
  const remaining = emptyTotals();
  let movements = 0;
  const compare = (expectedAccounts: readonly Account[]) => {
    const actual = ledger.balances();
    invariant(actual.length === expectedAccounts.length, 'account inventory changed');
    const expected = [...expectedAccounts].sort((left, right) => compareIds(left.id, right.id));
    for (const [index, account] of expected.entries()) {
      const found = actual[index];
      invariant(found.id === account.id && found.ownerId === account.ownerId &&
        found.locationId === account.locationId && found.resource === account.resource &&
        found.quantity === account.quantity, `account mismatch for ${account.id}`);
    }
  };

  for (const transaction of transactions) {
    invariant(transaction.turn >= turn, 'transaction is out of order');
    if (transaction.turn > turn) {
      if (turn === 0) compare(opening);
      turn = transaction.turn;
      ledger = new ResourceLedger(ledger.balances(), turn);
    }
    invariant(transaction.reason !== 'fixture-genesis' ||
      (turn === 0 && transaction.legs.every(({ from }) => from === null)), 'invalid genesis');
    const replayed = ledger.post(transaction.reason, transaction.actorId, transaction.phase, transaction.eventId,
      transaction.legs.map(({ from, to, quantity }) => ({
        from: from?.accountId ?? null, to: to?.accountId ?? null, quantity,
      })));
    invariant(replayed.id === transaction.id, `transaction ID mismatch for ${transaction.id}`);
    for (const [index, leg] of transaction.legs.entries()) {
      const actual = replayed.legs[index];
      invariant(leg.resource === actual.resource, `resource mismatch in ${transaction.id}`);
      for (const endpoint of ['from', 'to'] as const) {
        invariant(leg[endpoint]?.before === actual[endpoint]?.before &&
          leg[endpoint]?.after === actual[endpoint]?.after, `balance mismatch in ${transaction.id}`);
      }
      if (!leg.from) genesis[leg.resource] += leg.quantity;
      if (!leg.to) consumed[leg.resource] += leg.quantity;
      movements++;
    }
  }
  if (turn === 0) compare(opening);
  compare(final);
  for (const { resource, quantity } of final) remaining[resource] += quantity;
  for (const resource of ['food', 'timber', 'coin'] as const) {
    invariant(genesis[resource] - consumed[resource] === remaining[resource], `${resource} does not reconcile`);
  }
  return { transactions: transactions.length, movements, genesis, consumed, remaining };
}
