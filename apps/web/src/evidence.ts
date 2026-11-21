import { actionRegistry, type SocietyGame, type VillageEvent } from '@rulecraft/simulation';
import { citizenLabel } from './world.ts';

const extraActions = { 'guard-wage': 'guard wage', 'resident-meal': 'resident meal',
  'sleep-recovery': 'sleep recovery', 'fixture-genesis': 'opening balances' } as const;

export function actionLabel(action: VillageEvent['action']): string {
  if (action in actionRegistry) return actionRegistry[action as keyof typeof actionRegistry].label;
  return extraActions[action as keyof typeof extraActions] ?? action;
}

const reasons: Record<NonNullable<VillageEvent['reason']>, string> = {
  'occupation-mismatch': 'Action outside the resident’s occupation',
  'unavailable-field': 'No field place available',
  'unavailable-forest': 'No forest place available',
  'capacity-contention': 'Capacity taken by other eligible residents',
  'no-stock': 'Insufficient stock',
  'insufficient-funds': 'Insufficient funds',
  'fatigue-limit': 'Fatigue limit reached',
};
const outcomes: Record<VillageEvent['status'], string> = {
  'not-eligible': 'Ineligible', 'not-feasible-at-selection': 'Unavailable before choice',
  'blocked-at-execution': 'Attempt blocked', completed: 'Completed', partial: 'Partly completed',
};
export function reasonLabel(reason: VillageEvent['reason']): string {
  return reason ? reasons[reason] : 'No blocking reason recorded';
}
export function outcomeLabel(status: VillageEvent['status']): string {
  return outcomes[status];
}
export function dispositionLabel(disposition: 'education' | 'warning' | null): string {
  return disposition === 'education' ? 'Education' : disposition === 'warning' ? 'Formal warning' : 'No detection';
}

export function dayDigest(game: SocietyGame, day: number) {
  const metrics = game.days.find(({ turn }) => turn === day);
  const social = game.societyDays.find(({ turn }) => turn === day);
  if (!metrics || !social) return null;
  const events = game.events.filter(({ turn }) => turn === day);
  const priorFood = game.days.find(({ turn }) => turn === day - 1)?.marketFood ?? game.fixture.opening.marketFood;
  const featured = new Set<string>();
  for (const encounter of social.patrol.investigations) {
    if (encounter.disposition) featured.add(encounter.act.eventId);
  }
  for (const candidate of [
    events.find(({ foodAccess }) => foodAccess && foodAccess.fundingShortfall > 0),
    events.find(({ foodAccess }) => foodAccess && foodAccess.supplyShortfall > 0),
    events.find(({ status }) => status === 'blocked-at-execution'),
    events.find(({ action, status }) => action === 'harvest-food' && status === 'completed'),
    events.find(({ action, status }) => action === 'market-delivery' && status === 'completed'),
    events.find(({ action, status }) => action === 'resident-meal' && status === 'completed'),
  ]) {
    if (candidate) featured.add(candidate.id);
  }
  return {
    day, metrics, social, events,
    marketChange: metrics.marketFood - priorFood,
    highlights: Array.from(featured).map((id) => events.find((event) => event.id === id)).filter((event) => event !== undefined),
    education: social.patrol.investigations.filter(({ disposition }) => disposition === 'education').length,
    warnings: social.patrol.investigations.filter(({ disposition }) => disposition === 'warning').length,
    learnedAtDawn: social.news.filter((entry) => entry.type === 'learning' && entry.noticeId).length,
  };
}

export function inquiryEvidence(game: SocietyGame, id: string) {
  const action = game.events.find((event) => event.id === id);
  const version = game.book.versions.find((law) => law.eventId === id);
  const notice = game.book.notices.find((entry) => entry.eventId === id);
  const news = game.societyDays.flatMap((day) => day.news).find((entry) => entry.id === id);
  const inspection = game.societyDays.flatMap((day) => day.patrol.investigations).find((entry) => entry.id === id);
  const transaction = game.transactions.find((entry) => entry.id === (action?.transactionId ?? id));
  const social = action ? game.societyDays.find(({ turn }) => turn === action.turn) : undefined;
  const resource = action?.action === 'resident-meal' ? 'market-food' : action?.action;
  const allocations = social?.allocations.filter((allocation) =>
    allocation.winners.some(({ eventId }) => eventId === id) ||
    allocation.phase === action?.phase && allocation.resource === resource &&
      allocation.applicants.some(({ citizenId }) => citizenId === action?.actorId)) ?? [];
  const encounters = social?.patrol.investigations.filter((entry) =>
    entry.act.eventId === id || entry.patrol.eventId === id) ?? [];
  const occurrence = social?.patrol.prohibitedActs.find(({ eventId }) => eventId === id);
  const experience = (social?.experiences ?? game.societyDays.flatMap((day) => day.experiences))
    .filter(({ sourceEventId }) => sourceEventId === id);
  const noticeOrigin = notice
    ? game.societyDays.flatMap((day) => [
      ...day.news.filter((entry) => entry.type === 'learning' && entry.noticeId === id),
      ...day.patrol.investigations.filter((entry) => entry.noticeId === id),
    ])[0]
    : undefined;
  if (!action && !version && !notice && !news && !inspection && !transaction) return null;
  return { action, version, notice, news, inspection, transaction, allocations, encounters, occurrence, experience, noticeOrigin };
}

export function eventLabel(event: VillageEvent): string {
  return `${citizenLabel(event.actorId)} · ${actionLabel(event.action)}`;
}
