import assert from 'node:assert/strict';
import {
  advanceSociety, auditSnapshot, confirmLaw, encodeSociety, loadSociety, startSociety, villageScope,
} from '@rulecraft/simulation';
import baseline from '../../../fixtures/task-01-village.json' with { type: 'json' };

const fixture = { ...baseline, population: { farmer: 21, forester: 6, merchant: 5, guard: 8 } };
const law = (lawId, targetSelector, actionId, when) => ({
  operation: 'CREATE', lawId, commandId: `confirm-${lawId}`,
  ast: { ...villageScope, targetSelector, actionId, modality: 'MUST', ...(when && { when }) },
});
const rest = (threshold) => law(`merchant-rest-${threshold}`, 'merchant', 'rest', {
  operand: 'fatigue', operator: 'GTE', value: threshold,
});
const delivery = law('delivery-duty', 'merchant', 'market-delivery');
const policies = {
  control: [],
  delivery: [[0, delivery]],
  rest45: [[0, rest(45)]],
  rest65: [[0, rest(65)]],
  morningRest: [[0, law('morning-merchant-rest', 'merchant', 'rest', { operand: 'slot', operator: 'EQ', value: 'morning' })]],
  deliveryAfterCheckpoint: [[6, delivery]],
};

function simulate(seed, name, keep = false) {
  let game = startSociety(fixture, seed);
  for (let day = 0; day <= fixture.days; day++) {
    for (const [when, command] of policies[name]) if (when === day) game = confirmLaw(game, command).game;
    if (day < fixture.days) game = advanceSociety(game);
  }
  const audit = auditSnapshot(game);
  const roles = new Map(game.state.citizens.map(({ id, occupation }) => [id, occupation]));
  const merchantFatigueBlocks = game.events.filter((event) => roles.get(event.actorId) === 'merchant' &&
    event.action === 'market-delivery' && event.reason === 'fatigue-limit').length;
  const byRole = Object.fromEntries(Object.keys(fixture.population).map((role) => [role, { fed: 0, funds: 0, stockout: 0 }]));
  const missed = new Map();
  const streak = new Map();
  const longest = new Map();
  for (const { actorId, quantity, foodAccess } of game.events) {
    if (!foodAccess) continue;
    const role = byRole[roles.get(actorId)];
    role.fed += quantity;
    role.funds += foodAccess.fundingShortfall;
    role.stockout += foodAccess.supplyShortfall;
    if (quantity === 0) missed.set(actorId, (missed.get(actorId) ?? 0) + 1);
    streak.set(actorId, quantity === 0 ? (streak.get(actorId) ?? 0) + 1 : 0);
    longest.set(actorId, Math.max(longest.get(actorId) ?? 0, streak.get(actorId)));
  }
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  return {
    ...(keep && { game, audit }), byRole, metrics: {
      fed: sum(game.days.map(({ residentsFed }) => residentsFed)),
      fed6: sum(game.days.slice(0, 6).map(({ residentsFed }) => residentsFed)),
      stockout: sum(game.societyDays.map(({ metrics }) => metrics.food.unavailableMarketUnits)),
      affordability: sum(game.societyDays.map(({ metrics }) => metrics.food.unableToAffordUnits)),
      delivered: sum(game.days.map(({ foodDelivered }) => foodDelivered)), stock: game.days.at(-1).marketFood,
      merchantFatigueBlocks,
      feasible: sum(game.societyDays.map(({ metrics }) => metrics.compliance.knownFeasibleDuties)),
      completed: sum(game.societyDays.map(({ metrics }) => metrics.compliance.completedDuties)),
      noticedBySix: game.book.notices.filter(({ learnedAtTurn, citizenId }) =>
        learnedAtTurn <= 6 && roles.get(citizenId) === 'merchant').length,
      residentsMissed3: [...missed.values()].filter((value) => value >= 3).length,
      residentsConsecutive3: [...longest.values()].filter((value) => value >= 3).length,
    },
  };
}
function describe(numbers) {
  const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  const sd = Math.sqrt(numbers.reduce((sum, value) => sum + (value - average) ** 2, 0) / (numbers.length - 1));
  const width = 1.96 * sd / Math.sqrt(numbers.length);
  return { mean: average, sd, confidence95: [average - width, average + width] };
}
function compare(rows, controls) {
  const fed = rows.map(({ metrics }, index) => metrics.fed - controls[index].metrics.fed);
  return {
    metrics: Object.fromEntries(Object.keys(rows[0].metrics).map((key) => [key, {
      absolute: describe(rows.map(({ metrics }) => metrics[key])),
      delta: describe(rows.map(({ metrics }, index) => metrics[key] - controls[index].metrics[key])),
    }])),
    fedPairs: { better: fed.filter((n) => n > 0).length, tied: fed.filter((n) => n === 0).length, worse: fed.filter((n) => n < 0).length },
    byRoleDelta: Object.fromEntries(Object.keys(fixture.population).map((role) => [role, Object.fromEntries(
      ['fed', 'funds', 'stockout'].map((metric) => [metric, describe(rows.map(({ byRole }, index) =>
        byRole[role][metric] - controls[index].byRole[role][metric]))]),
    )])),
  };
}

const phase = process.argv[2];
if (phase === 'trace') {
  const policy = process.argv[3] ?? 'rest45';
  assert.ok(['rest45', 'rest65', 'morningRest'].includes(policy));
  let result;
  for (let seed = 52000; seed < 52064 && !result; seed++) {
    const control = simulate(seed, 'control', true);
    const treatment = simulate(seed, policy, true);
    const oldChoices = new Map(control.game.events.filter(({ choice }) => choice)
      .map((event) => [`${event.turn}|${event.phase}|${event.actorId}`, event]));
    const notice = treatment.game.book.notices;
    const witness = treatment.game.events.find((event) => {
      const other = oldChoices.get(`${event.turn}|${event.phase}|${event.actorId}`);
      return event.action === 'rest' && event.choice && other?.action === 'market-delivery' &&
        other.transactionId && other.choice.draw === event.choice.draw &&
        event.choice.candidates.find(({ actionId }) => actionId === 'market-delivery')?.selectionBarrier === null &&
        event.legalChoice?.some(({ actionId, actual, perceived, perceivedDutyOutcome }) =>
          actionId === 'rest' && actual.status === 'required' && perceived.status === 'required' && perceivedDutyOutcome === 'completed') &&
        treatment.game.days[event.turn - 1].residentsFed < control.game.days[event.turn - 1].residentsFed;
    });
    if (!witness) continue;
    const other = oldChoices.get(`${witness.turn}|${witness.phase}|${witness.actorId}`);
    const txn = control.game.transactions.find(({ eventId }) => eventId === other.id);
    const record = (run) => ({
      day: run.game.days[witness.turn - 1],
      nextDay: run.game.days[witness.turn],
      metrics: run.metrics,
      audit: run.audit,
      actorFollowUp: run.game.events.filter(({ actorId, turn, choice }) =>
        actorId === witness.actorId && turn === witness.turn + 1 && choice).map(({ id, phase, action, fatigue }) => ({ id, phase, action, fatigue })),
    });
    for (const run of [control, treatment]) {
      const bytes = encodeSociety(run.game);
      assert.equal(encodeSociety(loadSociety(bytes)), bytes);
    }
    result = { seed, policy, control: { ...record(control), choice: other, transaction: txn },
      treatment: { ...record(treatment), choice: witness, notice: notice.find(({ eventId }) =>
        witness.legalChoice.some(({ noticeEventIds }) => noticeEventIds.includes(eventId))) } };
  }
  assert.ok(result, 'No qualifying witness in exploratory range.');
  console.log(JSON.stringify(result, null, 2));
} else {
  assert.ok(['explore', 'holdout'].includes(phase));
  const selected = process.argv[3] ?? 'rest45';
  if (phase === 'holdout') assert.ok(['rest45', 'rest65', 'morningRest'].includes(selected));
  const first = phase === 'explore' ? 52000 : 53000;
  const count = phase === 'explore' ? 64 : 128;
  const cohort = Array.from({ length: count }, (_, index) => first + index);
  const controls = cohort.map((seed) => simulate(seed, 'control'));
  const names = phase === 'explore' ? Object.keys(policies) : ['control', 'delivery', selected, 'deliveryAfterCheckpoint'];
  console.log(JSON.stringify({ phase, first, count, policies, results: Object.fromEntries(names.map((name) =>
    [name, compare(name === 'control' ? controls : cohort.map((seed) => simulate(seed, name)), controls)])) }, null, 2));
}
