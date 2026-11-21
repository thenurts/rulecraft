import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  auditSnapshot, encodeSnapshot, resolveNextTurn, snapshotHashes, startVillage, villageAccounts,
} from '@rulecraft/simulation';
import { readCheckpoint, writeCheckpoint } from './task-01-file.mjs';

const { values } = parseArgs({
  options: {
    seed: { type: 'string' }, fixture: { type: 'string' }, until: { type: 'string' },
    checkpoint: { type: 'string' }, resume: { type: 'string' }, events: { type: 'boolean' },
    timings: { type: 'boolean' },
  },
});

function integerArgument(raw, label) {
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be an unsigned integer.`);
  }
  return value;
}

async function run() {
  if (values.resume && (values.seed !== undefined || values.fixture !== undefined)) {
    throw new Error('A resumed checkpoint already specifies its seed and fixture.');
  }

  const fixturePath = values.fixture ?? fileURLToPath(new URL('../fixtures/task-01-village.json', import.meta.url));
  const target = values.checkpoint ? resolve(values.checkpoint) : null;
  if (target && resolve(fixturePath) === target) {
    throw new Error('The checkpoint path must differ from the input fixture path.');
  }

  const source = values.resume ? resolve(values.resume) : null;
  const restored = source ? await readCheckpoint(source) : null;
  if (restored?.source === 'previous') console.error('Recovered the previous committed turn.');
  let snapshot = restored?.snapshot ?? startVillage(
    JSON.parse(await readFile(fixturePath, 'utf8')), integerArgument(values.seed ?? '42', 'Seed'),
  );
  const until = values.until === undefined ? snapshot.fixture.days : integerArgument(values.until, 'Final turn');
  if (until < snapshot.state.turn || until > snapshot.fixture.days) throw new Error('Final turn is outside fixture bounds.');

  let previous = restored?.encoded ?? (target ? encodeSnapshot(snapshot) : null);
  if (target && target !== source) await writeCheckpoint(target, previous, null, { create: true });
  const timings = [];
  while (snapshot.state.turn < until) {
    const started = performance.now();
    snapshot = resolveNextTurn(snapshot);
    timings.push(performance.now() - started);
    if (target) {
      const current = encodeSnapshot(snapshot);
      await writeCheckpoint(target, current, previous);
      previous = current;
    }
  }

  const audit = auditSnapshot(snapshot);
  const hashes = snapshotHashes(snapshot);
  const market = snapshot.state.accounts.find(({ id }) => id === villageAccounts.marketFood);
  const summary = {
    versions: snapshot.versions, seed: snapshot.seed, citizens: snapshot.state.citizens.length,
    turn: snapshot.state.turn, marketFood: market.quantity, events: snapshot.events.length, hashes, audit,
    days: snapshot.days,
  };
  console.log(JSON.stringify(values.events
    ? { ...summary, eventLog: snapshot.events, ledger: snapshot.transactions } : summary, null, 2));
  if (values.timings && timings.length > 0) {
    timings.sort((left, right) => left - right);
    const percentile = (p) => Number(timings[Math.ceil(p * timings.length) - 1].toFixed(3));
    console.error(JSON.stringify({
      turns: timings.length, scope: 'in-memory turn resolution only',
      medianMs: percentile(0.5), p95Ms: percentile(0.95), maxMs: percentile(1),
    }));
  }
}

try {
  await run();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
