import { addLawNotice, authoritativeLaws, type LawBook, type LawRef, type LawVersion } from './law-book.ts';
import { compareIds, type Citizen } from './model.ts';
import { keyedDraw, scaleDraw } from './rng.ts';

export interface NewsPolicy {
  readonly bulletinBp: number;
  readonly peerBp: number;
  readonly contacts: number;
}

export interface ContactList {
  readonly citizenId: string;
  readonly peers: readonly string[];
}

export function buildContacts(citizens: readonly Citizen[], seed: number, contacts: number): ContactList[] {
  const ring = citizens.map(({ id }) => ({
    id, draw: keyedDraw({ seed, turn: 0, slot: 'genesis', actorId: id, subsystem: 'contact-ring', drawIndex: 0 }),
  })).sort((a, b) => a.draw - b.draw || compareIds(a.id, b.id));
  return ring.map(({ id }, index) => ({
    citizenId: id,
    peers: Array.from({ length: Math.min(contacts, ring.length - 1) }, (_, offset) =>
      ring[(index + offset + 1) % ring.length].id),
  })).sort((a, b) => compareIds(a.citizenId, b.citizenId));
}

interface Source {
  readonly channel: 'bulletin' | 'peer';
  readonly eventId: string;
  readonly peerId: string | null;
  readonly chanceBp: number;
}

export type NewsEvent = Readonly<{ id: string; turn: number; phase: 'dawn'; law: LawRef; status: LawVersion['status'] }> & (
  | Readonly<{ type: 'publication'; sourceEventId: string }>
  | Readonly<{
    type: 'learning'; citizenId: string; sources: readonly Source[]; draw: number;
    learnedFrom: Source | null; noticeId: string | null;
  }>
);

function bulletinId(law: LawVersion): string {
  return `bulletin.${law.effectiveFromTurn}.${law.lawId}.${law.version}`;
}

export function learnAtDawn(
  prior: LawBook, graph: readonly ContactList[], policy: NewsPolicy, seed: number, day: number,
): { book: LawBook; news: NewsEvent[] } {
  const known = new Map(prior.notices.map((notice) => [`${notice.citizenId}:${notice.lawId}`, notice]));
  const news: NewsEvent[] = [];
  let book = prior;
  const laws = [...authoritativeLaws(prior, day)].sort((a, b) => compareIds(a.lawId, b.lawId));
  for (const law of laws) {
    const { lawId, version, status } = law;
    const common = { turn: day, phase: 'dawn' as const, law: { lawId, version }, status };
    if (policy.bulletinBp > 0 && law.effectiveFromTurn === day) {
      news.push({ ...common, id: bulletinId(law), type: 'publication', sourceEventId: law.eventId });
    }
    for (const { citizenId, peers } of [...graph].sort((a, b) => compareIds(a.citizenId, b.citizenId))) {
      if ((known.get(`${citizenId}:${lawId}`)?.version ?? 0) >= version) continue;
      const sources: Source[] = [];
      if (policy.bulletinBp > 0) sources.push({
        channel: 'bulletin', eventId: bulletinId(law), peerId: null, chanceBp: policy.bulletinBp,
      });
      const peerChance = Math.min(policy.peerBp, 10_000 - policy.bulletinBp);
      if (peerChance > 0) {
        const peer = peers.map((id) => known.get(`${id}:${lawId}`))
          .find((notice) => notice?.version === version && notice.learnedAtTurn < day);
        if (peer) sources.push({ channel: 'peer', eventId: peer.eventId, peerId: peer.citizenId, chanceBp: peerChance });
      }
      if (sources.length === 0) continue;
      const draw = scaleDraw(keyedDraw({ seed, turn: day, slot: 'dawn', actorId: citizenId,
        subsystem: `learn.${lawId}`, drawIndex: version }), 10_000);
      let ceiling = 0;
      const learnedFrom = sources.find((source) => draw < (ceiling += source.chanceBp)) ?? null;
      let noticeId: string | null = null;
      if (learnedFrom) {
        book = addLawNotice(book, day, citizenId, lawId, version, 'dawn');
        noticeId = book.notices[book.notices.length - 1].eventId;
      }
      news.push({ ...common, id: `news.${day}.${citizenId}.${lawId}.${version}`,
        type: 'learning', citizenId, sources, draw, learnedFrom, noticeId });
    }
  }
  return { book, news };
}
