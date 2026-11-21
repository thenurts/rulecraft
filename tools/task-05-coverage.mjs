import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { advanceSociety } from '@rulecraft/simulation';
import { extractCandidates, families } from '../apps/web/src/narrative/facts.ts';
import { projectNarrative } from '../apps/web/src/narrative/projection.ts';
import { societyExample } from './task-03-scenario.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/task-01-village.json', import.meta.url), 'utf8'));
const seeds = [42, ...Array.from({ length: 32 }, (_, seed) => seed)];
const totals = Object.fromEntries(Object.keys(families).map((family) => [family, { eligible: 0, selected: 0 }]));
const voices = {};
const headlineIds = new Set();
const diagnostics = {};
const example = [];
let emptyEligibleDays = 0;
let emptySelectedDays = 0;
let maxDaily = 0;
let repeatedHeadlines = 0;
let repeatedAdviserTemplates = 0;
let repeatedHeadlinesByText = 0;
let repeatedAdviserLines = 0;
let minimumReuseSeparation = Infinity;
let minHeadlineVariation = Infinity;
for (const seed of seeds) {
  let game = societyExample(fixture, undefined, seed);
  for (let turn = 1; turn <= fixture.days; turn++) game = advanceSociety(game);
  const { candidates } = extractCandidates(game);
  const projected = projectNarrative(game, 'full');
  for (const code of projected.diagnostics) diagnostics[code] = (diagnostics[code] ?? 0) + 1;
  for (const { facts } of candidates) totals[facts.family].eligible++;
  const lastTemplateDay = new Map();
  const adviserTemplates = new Set();
  const headlinesByText = new Set();
  const adviserLines = new Set();
  for (let turn = 1; turn <= fixture.days; turn++) {
    const today = projected.incidents.filter((incident) => incident.turn === turn);
    if (!candidates.some((candidate) => candidate.turn === turn)) emptyEligibleDays++;
    if (!today.length) emptySelectedDays++;
    maxDaily = Math.max(maxDaily, today.length);
    assert.ok(today.length <= 3);
    assert.equal(new Set(today.map(({ facts }) => facts.family)).size, today.length);
    for (const incident of today) {
      const { facts, adviserId, headlineTemplateId, adviserTemplateId } = incident;
      totals[facts.family].selected++;
      voices[adviserId] ??= {};
      voices[adviserId][adviserTemplateId] = (voices[adviserId][adviserTemplateId] ?? 0) + 1;
      const lastDay = lastTemplateDay.get(headlineTemplateId);
      if (lastDay !== undefined) {
        repeatedHeadlines++;
        const completeDaysBetween = turn - lastDay - 1;
        assert.ok(completeDaysBetween >= 3);
        minimumReuseSeparation = Math.min(minimumReuseSeparation, completeDaysBetween);
      }
      if (adviserTemplates.has(adviserTemplateId)) repeatedAdviserTemplates++;
      lastTemplateDay.set(headlineTemplateId, turn);
      adviserTemplates.add(adviserTemplateId);
      headlineIds.add(headlineTemplateId);
      if (headlinesByText.has(incident.headline)) repeatedHeadlinesByText++;
      if (adviserLines.has(incident.response)) repeatedAdviserLines++;
      headlinesByText.add(incident.headline);
      adviserLines.add(incident.response);
    }
    if (seed === 42) example.push({ turn, stories: today.map(({ headline, adviserId, headlineTemplateId }) =>
      ({ headline, adviserId, headlineTemplateId })) });
  }
  minHeadlineVariation = Math.min(minHeadlineVariation, lastTemplateDay.size);
}

console.log(JSON.stringify({
  seeds, sampleDays: seeds.length * fixture.days, totals, emptyEligibleDays, emptySelectedDays, maxDaily,
  headlineTemplates: headlineIds.size, minDistinctHeadlineTemplatesPerTrial: minHeadlineVariation,
  repeatedHeadlines, repeatedHeadlinesByText, repeatedAdviserTemplates, repeatedAdviserLines,
  minimumReuseSeparation, voices, diagnostics, example,
}, null, 2));
