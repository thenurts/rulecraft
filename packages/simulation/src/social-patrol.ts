import { addLawNotice, type LawBook, type LawRef, type LegalDecision } from './law-book.ts';
import { compareIds, daySlots, type DaySlot } from './model.ts';
import { keyedDraw, scaleDraw } from './rng.ts';
import { allocationDraw, performed } from './social-behaviour.ts';
import type { ResolvedDay } from './turn.ts';

export const patrolDefaults = {
  encountersPerPatrol: 1, detectionBp: 4_000, warningRiskWeight: 50, warningMemoryDays: 3, warningTrustLoss: 1,
} as const;
export type PatrolPolicy = Readonly<Record<keyof typeof patrolDefaults, number>>;

const publicRoute = 'village-public';

interface PatrolPresence {
  readonly eventId: string;
  readonly guardId: string;
  readonly slot: DaySlot;
  readonly route: typeof publicRoute;
  readonly capacity: number;
}

interface ProhibitedAct {
  readonly eventId: string;
  readonly citizenId: string;
  readonly action: string;
  readonly slot: DaySlot;
  readonly route: typeof publicRoute | 'home';
  readonly law: LawRef;
  readonly lawEventId: string;
  readonly knewCurrentVersion: boolean;
  readonly perceivedStatus: LegalDecision['status'];
}

export interface Investigation {
  readonly id: string;
  readonly patrol: PatrolPresence;
  readonly act: ProhibitedAct;
  readonly chanceBp: number;
  readonly draw: number;
  readonly detected: boolean;
  readonly disposition: 'warning' | 'education' | null;
  readonly noticeId: string | null;
}

export interface PatrolReport {
  readonly presence: readonly PatrolPresence[];
  readonly prohibitedActs: readonly ProhibitedAct[];
  readonly investigations: readonly Investigation[];
}

export function resolvePatrols(
  initial: LawBook, day: ResolvedDay, seed: number, policy: PatrolPolicy,
): { book: LawBook; report: PatrolReport } {
  const presence: PatrolPresence[] = [];
  const prohibitedActs: ProhibitedAct[] = [];
  const investigations: Investigation[] = [];
  const { turn } = day.state;
  for (const event of day.events) {
    if (!performed(event) || (event.phase !== 'morning' && event.phase !== 'afternoon')) continue;
    if (event.action === 'patrol' && event.status === 'completed') {
      presence.push({ eventId: event.id, guardId: event.actorId, slot: event.phase,
        route: publicRoute, capacity: policy.encountersPerPatrol });
    }
    const candidate = event.legalChoice?.find(({ actionId }) => actionId === event.action);
    const law = candidate?.actual.winner;
    if (candidate?.actual.status !== 'prohibited' || !law) continue;
    const sameLaw = ({ ref }: { ref: LawRef }) => ref.lawId === law.lawId && ref.version === law.version;
    const fact = candidate.actual.considered.find(sameLaw);
    if (!fact?.applicable) throw new Error('Missing authoritative provenance for prohibited action.');
    prohibitedActs.push({ eventId: event.id, citizenId: event.actorId, action: event.action, slot: event.phase,
      route: event.action === 'rest' ? 'home' : publicRoute, law, lawEventId: fact.eventId,
      knewCurrentVersion: candidate.perceived.considered.some(sameLaw), perceivedStatus: candidate.perceived.status });
  }

  let book = initial;
  for (const slot of daySlots) {
    const contenders = <T>(items: readonly T[], resource: string, identify: (item: T) => string) =>
      items.map((item) => ({ item, id: identify(item), rank: allocationDraw(seed, turn, slot, resource, identify(item)) }))
        .sort((a, b) => a.rank - b.rank || compareIds(a.id, b.id)).map(({ item }) => item);
    const guards = contenders(presence.filter((patrol) => patrol.slot === slot), 'patrol-assignment', (patrol) => patrol.guardId)
      .map((patrol) => ({ patrol, remaining: patrol.capacity }));
    const acts = contenders(prohibitedActs.filter((act) => act.slot === slot && act.route === publicRoute),
      'inspection', (act) => act.citizenId);
    for (const act of acts) {
      const guard = guards.find(({ patrol, remaining }) => remaining > 0 && patrol.guardId !== act.citizenId);
      if (!guard) continue;
      guard.remaining--;
      const draw = scaleDraw(keyedDraw({ seed, turn, slot, actorId: guard.patrol.guardId,
        subsystem: `encounter.${act.citizenId}`, drawIndex: 0 }), 10_000);
      const detected = draw < policy.detectionBp;
      let noticeId: string | null = null;
      if (detected && !act.knewCurrentVersion) {
        const taught = addLawNotice(book, turn, act.citizenId, act.law.lawId, act.law.version, 'warning');
        if (taught !== book) {
          book = taught;
          noticeId = taught.notices[taught.notices.length - 1].eventId;
        }
      }
      investigations.push({
        id: `inspection.${act.eventId}`, patrol: guard.patrol, act, chanceBp: policy.detectionBp, draw, detected,
        disposition: detected ? act.knewCurrentVersion ? 'warning' : 'education' : null, noticeId,
      });
    }
  }
  return { book, report: { presence, prohibitedActs, investigations } };
}
