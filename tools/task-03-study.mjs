import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { advanceSociety, confirmLaw, notifyLaw, societyDefaults, startSociety, villageScope } from '@rulecraft/simulation';

const fixture = JSON.parse(await readFile(new URL('../fixtures/task-01-village.json', import.meta.url), 'utf8'));
const namedLaw = (game) => confirmLaw(game, {
  operation: 'CREATE', lawId: 'field-ban', commandId: 'create-field-ban',
  ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST_NOT' },
}).game;

const newsConfig = { ...societyDefaults, patrol: { ...societyDefaults.patrol, encountersPerPatrol: 0 } };
const patrolConfig = { ...societyDefaults, bulletinBp: 0, peerBp: 0, contacts: 0 };
const patrolFixture = {
  ...fixture, population: { farmer: 8, guard: 1, forester: 0, merchant: 0 },
  behaviour: { ...fixture.behaviour, workWeight: 100, restWeight: 25, startingFatigueMin: 0, startingFatigueMax: 0 },
};
const focal = { ...fixture, population: { farmer: 1, guard: 0, forester: 0, merchant: 1 } };
const fairness = {
  ...fixture, population: { farmer: 2, guard: 0, forester: 0, merchant: 0 },
  capacity: { ...fixture.capacity, fieldPerSlot: 1 },
  opening: { ...fixture.opening, marketFood: 1 },
  behaviour: { ...fixture.behaviour, workWeight: 100, restWeight: 1, startingFatigueMin: 0, startingFatigueMax: 0 },
};
const byTurn = (game, turn) => {
  while (game.state.turn < turn) game = advanceSociety(game);
  return game;
};
const counts = (total, opportunities = 1) => ({ total, opportunities });
const comparisons = new Map();
function collect(name, control, treatment) {
  if (!comparisons.has(name)) comparisons.set(name, []);
  if (control.opportunities && treatment.opportunities) comparisons.get(name).push([control, treatment]);
}
const keys = ['awareness', 'patrol-capacity', 'formal-warning-risk', 'hunger', 'income-opportunity',
  'fatigue', 'field-lottery-early-id', 'meal-lottery-early-id'];

function learning(seed, bulletinBp) {
  const game = byTurn(namedLaw(startSociety(fixture, seed, { ...newsConfig, bulletinBp })), 3);
  return counts(game.book.notices.length, game.state.citizens.length);
}

function patrol(seed, settings, preInformed = false) {
  let game = namedLaw(startSociety(patrolFixture, seed, {
    ...patrolConfig, patrol: { ...patrolConfig.patrol, ...settings },
  }));
  if (preInformed) {
    for (const { id, occupation } of game.state.citizens) {
      if (occupation === 'farmer') game = notifyLaw(game, id, 'field-ban', 1);
    }
  }
  return advanceSociety(game);
}

function detection(game) {
  const report = game.societyDays[0].patrol;
  return counts(report.investigations.filter(({ detected }) => detected).length, report.prohibitedActs.length);
}

function risk(seed) {
  const control = patrol(seed, { detectionBp: 10_000, warningRiskWeight: 0 }, true);
  const treatment = patrol(seed, { detectionBp: 10_000, warningRiskWeight: 50 }, true);
  const warnedCitizens = (game) => game.societyDays[0].patrol.investigations
    .filter(({ disposition, act }) => disposition === 'warning' && act.knewCurrentVersion)
    .map(({ act }) => act.citizenId);
  assert.deepEqual(warnedCitizens(control), warnedCitizens(treatment));
  const warned = new Set(warnedCitizens(control));
  const choices = (game) => new Map(advanceSociety(game).events
    .filter(({ turn, phase, actorId, choice, legalChoice }) => turn === 2 && phase === 'morning' &&
      warned.has(actorId) && choice?.candidates[0].selectionBarrier === null &&
      legalChoice?.[0].perceived.status === 'prohibited' && legalChoice[0].actual.status === 'prohibited')
    .map(({ actorId, action }) => [actorId, action]));
  const a = choices(control);
  const b = choices(treatment);
  const paired = [...a.keys()].filter((id) => b.has(id));
  return [counts(paired.filter((id) => a.get(id) === 'rest').length, paired.length),
    counts(paired.filter((id) => b.get(id) === 'rest').length, paired.length)];
}

function choice(seed, model, target, hunger = 0) {
  const initial = startSociety(model, seed, newsConfig);
  // A controlled starting-state intervention for this study only.
  const state = hunger === 0 ? initial.state : { ...initial.state,
    citizens: initial.state.citizens.map((actor) => actor.id === 'citizen.0001' ? { ...actor, hunger } : actor) };
  const event = advanceSociety({ ...initial, state }).events.find(({ actorId, phase, choice }) =>
    actorId === 'citizen.0001' && phase === 'morning' && choice);
  if (!event || event.choice.candidates[0].selectionBarrier !== null) return counts(0, 0);
  return counts(Number(event.action === target));
}

function earlyWinner(day, resource) {
  const competition = day.societyDays[0].allocations.find((record) => record.resource === resource &&
    (record.phase === 'morning' || record.phase === 'dusk') && record.applicants.length === 2 && record.winners.length === 1);
  if (!competition) return [counts(0, 0), counts(0, 0)];
  return [counts(0.5), counts(Number(competition.winners[0].citizenId === 'citizen.0001'))];
}

for (let seed = 0; seed < 256; seed++) {
  collect(keys[0], learning(seed, 750), learning(seed, 3_000));
  collect(keys[1], detection(patrol(seed, { detectionBp: 6_000, encountersPerPatrol: 1 })),
    detection(patrol(seed, { detectionBp: 6_000, encountersPerPatrol: 3 })));
  collect(keys[2], ...risk(seed));
  collect(keys[3], choice(seed, focal, 'harvest-food'), choice(seed, focal, 'harvest-food', 5));
  collect(keys[4], choice(seed, { ...focal, opening: { ...focal.opening, marketCoin: 0 } }, 'harvest-food'),
    choice(seed, { ...focal, opening: { ...focal.opening, marketCoin: 200 } }, 'harvest-food'));
  const tired = (fatigue) => ({ ...focal, behaviour: { ...focal.behaviour, startingFatigueMin: fatigue, startingFatigueMax: fatigue } });
  collect(keys[5], choice(seed, tired(10), 'rest'), choice(seed, tired(75), 'rest'));
  const fair = advanceSociety(startSociety(fairness, seed, { ...newsConfig,
    behaviour: { ...newsConfig.behaviour, fatigueWeight: 0 } }));
  collect(keys[6], ...earlyWinner(fair, 'harvest-food'));
  collect(keys[7], ...earlyWinner(fair, 'market-food'));
}

function summarise(pairs) {
  if (pairs.length < 2) throw new Error('Fewer than two comparable seed pairs.');
  const arm = (index) => pairs.reduce((sum, pair) => ({
    total: sum.total + pair[index].total, opportunities: sum.opportunities + pair[index].opportunities,
  }), counts(0, 0));
  const diff = pairs.map(([a, b]) => b.total / b.opportunities - a.total / a.opportunities);
  const mean = diff.reduce((sum, value) => sum + value, 0) / diff.length;
  const variance = diff.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (diff.length - 1);
  const radius = 1.96 * Math.sqrt(variance / diff.length);
  const points = (fraction) => Math.round(fraction * 10000) / 100;
  return { pairs: pairs.length, control: arm(0), treatment: arm(1), changePp: points(mean),
    confidence95Pp: [points(mean - radius), points(mean + radius)] };
}

console.log(JSON.stringify(Object.fromEntries([...comparisons].map(([label, rows]) => [label, summarise(rows)])), null, 2));
