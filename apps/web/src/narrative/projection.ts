import { compareIds, type SocietyGame } from '@rulecraft/simulation';
import { catalogueV1, describeFacts, narrativeContentVersion, type Adviser, type ReadingMode } from './copy.ts';
import { extractCandidates, type Candidate, type Family } from './facts.ts';

export interface Incident extends Candidate {
  readonly narrativeVersion: typeof narrativeContentVersion;
  readonly headlineTemplateId: string;
  readonly adviserTemplateId: string;
  readonly adviserId: Adviser;
  readonly headline: string;
  readonly summary: string;
  readonly response: string;
  readonly caption?: string;
}

const maxPerDay = 3;
const completedDaysBetweenHeadlines = 3;

function rank(key: string): number {
  let word = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) {
    word = Math.imul(word ^ key.charCodeAt(index), 0x01000193);
  }
  return word >>> 0;
}

export function projectNarrative(game: SocietyGame, mode: ReadingMode, version: string = narrativeContentVersion) {
  const incidents: Incident[] = [];
  if (version !== narrativeContentVersion) return { incidents, diagnostics: ['unsupported-narrative-version'] };
  const { candidates, diagnostics } = extractCandidates(game);
  const usedHeadlines = new Map<string, number>();
  const usedAdvisers = new Map<string, number>();
  const orderKey = (candidate: Candidate, slot: string) =>
    `narrative:${version}:${game.seed}:${candidate.turn}:${candidate.facts.family}:${candidate.witnessEventIds[0]}:${slot}`;

  for (let turn = 1; turn <= game.state.turn; turn++) {
    const today = candidates.filter((candidate) => candidate.turn === turn).sort((left, right) =>
      right.salience - left.salience ||
      rank(orderKey(left, 'rank')) - rank(orderKey(right, 'rank')) || compareIds(left.id, right.id));
    const familiesToday = new Set<Family>();
    for (const candidate of today) {
      const { family } = candidate.facts;
      if (familiesToday.size === maxPerDay) break;
      if (familiesToday.has(family)) continue;
      const copy = catalogueV1[family];

      function options<T>(entries: readonly T[], type: string) {
        // Rotate the catalogue using a separate keyed draw. Do not consume simulation draws.
        const offset = rank(orderKey(candidate, type)) % entries.length;
        return Array.from({ length: entries.length }, (_, step) => (step + offset) % entries.length)
          .map((index) => ({ id: `${family}.${type}.${index + 1}`, value: entries[index] }));
      }

      const headlines = options(copy.headlines, 'headline');
      const headline = headlines.find(({ id }) => turn - (usedHeadlines.get(id) ?? -Infinity) > completedDaysBetweenHeadlines);
      if (!headline) {
        diagnostics.push(`headline-cooldown:${turn}:${family}`);
        continue;
      }
      const responses = options(copy.responses, 'adviser');
      const response = responses.find(({ id }) => turn - (usedAdvisers.get(id) ?? -Infinity) > 2) ?? responses[0];
      incidents.push({
        ...candidate, narrativeVersion: narrativeContentVersion, headlineTemplateId: headline.id,
        adviserTemplateId: response.id, adviserId: response.value.adviser, headline: headline.value,
        summary: describeFacts(candidate.facts), response: response.value[mode],
        ...(copy.caption ? { caption: copy.caption } : {}),
      });
      familiesToday.add(family);
      usedHeadlines.set(headline.id, turn);
      usedAdvisers.set(response.id, turn);
    }
  }
  return { incidents, diagnostics };
}
