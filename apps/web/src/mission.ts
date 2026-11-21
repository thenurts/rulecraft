import { type SocietyGame } from '@rulecraft/simulation';

export const checkpointDay = 6;
export const repeatedMisses = 3;

export function foodReport(game: SocietyGame, day: number) {
  const daily = game.days.filter(({ turn }) => turn <= day);
  const fed = daily.reduce((sum, { residentsFed }) => sum + residentsFed, 0);
  const observed = daily.reduce((sum, { residentsFed, residentsUnmet }) => sum + residentsFed + residentsUnmet, 0);
  const residents = game.state.citizens.map(({ id, occupation }) =>
    ({ id, occupation, fed: 0, missed: 0, streak: 0, longest: 0, lastMiss: null as string | null }));
  const people = new Map(residents.map((person) => [person.id, person]));
  const events = game.events.filter(({ turn }) => turn <= day);
  let supply = 0;
  let affordability = 0;
  for (const event of events) {
    if (event.action !== 'resident-meal' || !event.foodAccess) continue;
    const person = people.get(event.actorId);
    if (!person) continue;
    supply += event.foodAccess.supplyShortfall;
    affordability += event.foodAccess.fundingShortfall;
    if (event.status === 'completed') {
      person.fed++;
      person.streak = 0;
    } else {
      person.missed++;
      person.streak++;
      person.longest = Math.max(person.streak, person.longest);
      person.lastMiss = event.id;
    }
  }
  return {
    fed, observed, total: residents.length * game.fixture.days, supply, affordability,
    delivered: daily.reduce((sum, day) => sum + day.foodDelivered, 0),
    closingStock: daily.at(-1)?.marketFood ?? game.fixture.opening.marketFood,
    residents,
    repeated: residents.filter(({ missed }) => missed >= repeatedMisses),
    consecutive: residents.filter(({ longest }) => longest >= repeatedMisses).length,
  };
}

export function lessonWitnesses(game: SocietyGame, day: number) {
  const events = game.events.filter(({ turn }) => turn > 0 && turn <= day).reverse();
  const transfers = new Map(game.transactions.map((transaction) => [transaction.id, transaction]));
  const notices = new Map(game.book.notices.map((notice) => [notice.eventId, notice]));
  const linked = (event: (typeof events)[number], reason: 'harvest-food' | 'market-delivery') => {
    const transaction = event.transactionId ? transfers.get(event.transactionId) : undefined;
    return transaction?.eventId === event.id && transaction.reason === reason && event.quantity > 0;
  };
  const harvest = events.find((event) => event.action === 'harvest-food' && linked(event, 'harvest-food'));
  const deliveries = events.filter((event) => event.action === 'market-delivery' && linked(event, 'market-delivery'));
  const informed = deliveries.flatMap((event) => {
    if (event.status !== 'completed') return [];
    const choice = event.legalChoice?.find(({ actionId }) => actionId === 'market-delivery');
    if (!choice || choice.actual.status !== 'required' || choice.perceivedDutyOutcome !== 'completed') return [];
    const law = choice.actual.winner;
    const perceived = choice.perceived.winner;
    if (!law || !perceived || law.lawId !== perceived.lawId || law.version !== perceived.version) return [];
    const notice = choice.noticeEventIds.map((id) => notices.get(id)).find((item) => item &&
      item.citizenId === event.actorId && item.lawId === law.lawId && item.version === law.version);
    return notice ? [{ event, notice, law }] : [];
  })[0];
  return {
    harvest, delivery: informed?.event ?? deliveries[0], informed,
    blocked: events.find(({ action, status, reason }) => action === 'market-delivery' && reason &&
      (status === 'blocked-at-execution' || status === 'not-feasible-at-selection')),
    supply: events.find(({ foodAccess }) => foodAccess && foodAccess.supplyShortfall > 0),
    affordability: events.find(({ foodAccess }) => foodAccess && foodAccess.fundingShortfall > 0 && foodAccess.marketAvailableBefore > 0)
      ?? events.find(({ foodAccess }) => foodAccess && foodAccess.fundingShortfall > 0),
  };
}
