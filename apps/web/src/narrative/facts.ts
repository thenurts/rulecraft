import { authoritativeLaws, compareIds, type LawRef, type SocietyGame, type VillageEvent } from '@rulecraft/simulation';

export const families = {
  MEAL_UNAFFORDABLE: 'Food costs', MEAL_STOCKOUT: 'Stockout', EDUCATION: 'Education',
  FORMAL_WARNING: 'Warning', PATROL_CAPACITY_GAP: 'Patrol capacity', FATIGUE_BLOCKED_WORK: 'Fatigue',
  COMPETING_KNOWN_DUTIES: 'Duties', FOOD_ACCESS_SUCCESS: 'Meals served',
} as const;
export type Family = keyof typeof families;

export type Facts =
  | { family: 'MEAL_UNAFFORDABLE' | 'MEAL_STOCKOUT'; residents: number; units: number }
  | { family: 'EDUCATION' | 'FORMAL_WARNING'; encounters: number }
  | { family: 'PATROL_CAPACITY_GAP'; missed: number; attempts: number; patrols: number }
  | { family: 'FATIGUE_BLOCKED_WORK'; workRecords: number }
  | { family: 'COMPETING_KNOWN_DUTIES'; duties: number }
  | { family: 'FOOD_ACCESS_SUCCESS'; fed: number; total: number };

export interface Candidate {
  readonly id: string;
  readonly turn: number;
  readonly facts: Readonly<Facts>;
  readonly witnessEventIds: readonly string[];
  readonly relatedEventIds: readonly string[];
  readonly lawVersionRefs: readonly LawRef[];
  readonly strength: 'direct' | 'contextual';
  readonly salience: number;
}

type Day = SocietyGame['societyDays'][number];
type Act = Day['patrol']['prohibitedActs'][number];
type Investigation = Day['patrol']['investigations'][number];
type Presence = Day['patrol']['presence'][number];
type Notice = SocietyGame['book']['notices'][number];

const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
const same = (a: LawRef | null | undefined, b: LawRef): boolean => a?.lawId === b.lawId && a.version === b.version;
const performed = (event: VillageEvent) => event.status === 'completed' || event.status === 'partial' && positive(event.quantity);
const ordered = <T extends { id: string }>(records: readonly T[]) => [...records].sort((a, b) => compareIds(a.id, b.id));
const key = ({ lawId, version }: LawRef): string => `${lawId}:${version}`;

export function extractCandidates(game: SocietyGame) {
  const diagnostics: string[] = [];
  const events = new Map<string, VillageEvent>();
  const notices = new Map<string, Notice>();
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  function register(id: string) {
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }
  for (const event of game.events) { register(event.id); events.set(event.id, event); }
  for (const notice of game.book.notices) { register(notice.eventId); notices.set(notice.eventId, notice); }
  for (const law of game.book.versions) register(law.eventId);
  for (const day of game.societyDays) {
    for (const event of [...day.news, ...day.patrol.investigations]) register(event.id);
  }
  const resolves = (id: string) => ids.has(id) && !duplicates.has(id);
  const candidate: Candidate[] = [];

  for (const day of [...game.societyDays].sort((a, b) => a.turn - b.turn)) {
    const turn = day.turn;
    if (!positive(turn) || turn > game.state.turn) continue;
    const daily = ordered(game.events.filter((event) => event.turn === turn && resolves(event.id)));
    const laws = authoritativeLaws(game.book, turn);
    function add(
      facts: Facts, primary: readonly string[], salience: number, strength: Candidate['strength'] = 'direct',
      related: readonly string[] = [], refs: readonly LawRef[] = [],
    ) {
      if (!primary.length || ![...primary, ...related].every(resolves) ||
          refs.some((ref) => !game.book.versions.some((version) =>
            same(version, ref) && version.effectiveFromTurn <= turn && resolves(version.eventId)))) {
        diagnostics.push(`unresolved-evidence:${turn}:${facts.family}`);
        return;
      }
      const witnessEventIds = [...new Set(primary)];
      candidate.push({
        id: `incident:${turn}:${facts.family}:${witnessEventIds[0]}`,
        turn, facts, witnessEventIds, relatedEventIds: [...new Set(related)].filter((id) => !witnessEventIds.includes(id)),
        lawVersionRefs: [...new Map(refs.map((ref) => [key(ref), { lawId: ref.lawId, version: ref.version }])).values()],
        strength, salience,
      });
    }

    const meals = daily.filter((event) => event.action === 'resident-meal' && event.phase === 'dusk');
    for (const [family, field] of [
      ['MEAL_UNAFFORDABLE', 'fundingShortfall'], ['MEAL_STOCKOUT', 'supplyShortfall'],
    ] as const) {
      const records = meals.filter(({ foodAccess }) => foodAccess && positive(foodAccess[field]) &&
        (family === 'MEAL_STOCKOUT' || positive(foodAccess.marketAvailableBefore)));
      if (!records.length) continue;
      add({ family, residents: new Set(records.map(({ actorId }) => actorId)).size,
        units: records.reduce((sum, event) => sum + event.foodAccess![field], 0) },
        records.map(({ id }) => id), family === 'MEAL_UNAFFORDABLE' ? 120 : 125, 'contextual');
    }

    const people = new Set(game.state.citizens.map(({ id }) => id));
    const fed = new Set(meals.filter(({ status, quantity, foodAccess }) => status === 'completed' &&
      quantity === game.fixture.economy.foodPerDay && foodAccess?.fundingShortfall === 0 && foodAccess.supplyShortfall === 0)
      .map(({ actorId }) => actorId));
    const metrics = game.days.find((entry) => entry.turn === turn);
    if (people.size > 0 && fed.size === people.size && [...fed].every((id) => people.has(id)) &&
        metrics?.residentsFed === people.size && metrics.residentsUnmet === 0) {
      add({ family: 'FOOD_ACCESS_SUCCESS', fed: fed.size, total: people.size },
        meals.filter(({ status }) => status === 'completed').map(({ id }) => id), 68);
    }

    function actWitness(act: Act): VillageEvent | undefined {
      const event = events.get(act.eventId);
      if (!event || !resolves(event.id) || event.turn !== turn || event.phase !== act.slot ||
          event.actorId !== act.citizenId || event.action !== act.action || !performed(event)) return;
      const law = laws.find((version) => same(version, act.law));
      const choice = event.legalChoice?.find(({ actionId }) => actionId === event.action);
      const known = choice?.perceived.considered.some((rule) => same(rule.ref, act.law)) ?? false;
      if (act.route !== (event.action === 'rest' ? 'home' : 'village-public') ||
          !law || law.status !== 'active' || law.ast.modality !== 'MUST_NOT' || law.eventId !== act.lawEventId ||
          !resolves(law.eventId) || choice?.actual.status !== 'prohibited' || !same(choice.actual.winner, act.law) ||
          !choice.actual.considered.some((rule) => same(rule.ref, act.law) && rule.applicable && rule.eventId === law.eventId) ||
          act.knewCurrentVersion !== known) return;
      return event;
    }

    function patrolWitness(patrol: Presence): boolean {
      const event = events.get(patrol.eventId);
      return !!event && resolves(event.id) && positive(patrol.capacity) && event.turn === turn &&
        event.phase === patrol.slot && event.actorId === patrol.guardId && event.action === 'patrol' &&
        event.status === 'completed' && positive(event.quantity) && patrol.route === 'village-public';
    }

    const validPresence = day.patrol.presence.filter(patrolWitness);
    function investigationWitness(entry: Investigation): boolean {
      return resolves(entry.id) && entry.act.route === 'village-public' && entry.patrol.slot === entry.act.slot &&
        entry.patrol.guardId !== entry.act.citizenId && validPresence.some((presence) =>
          presence.eventId === entry.patrol.eventId && presence.slot === entry.patrol.slot &&
          presence.guardId === entry.patrol.guardId && presence.capacity === entry.patrol.capacity) &&
        !!actWitness(entry.act);
    }
    const investigations = ordered(day.patrol.investigations).filter(investigationWitness);
    if (investigations.length !== day.patrol.investigations.length) diagnostics.push(`invalid-investigation:${turn}`);

    const education = investigations.filter((entry) => {
      if (!entry.detected || entry.disposition !== 'education' || entry.act.knewCurrentVersion || !entry.noticeId) return false;
      const notice = notices.get(entry.noticeId);
      const phase = game.versions.schemaVersion === 3 ? 'warning' : 'education';
      if (notice && resolves(notice.eventId) && same(notice, entry.act.law) && notice.citizenId === entry.act.citizenId &&
          notice.learnedAtTurn === turn && notice.learnedAtPhase === phase) return true;
      diagnostics.push(`invalid-education-notice:${turn}`);
      return false;
    });
    const warning = investigations.filter(({ disposition, detected, act }) =>
      detected && disposition === 'warning' && act.knewCurrentVersion);
    for (const [family, encounters] of [['EDUCATION', education], ['FORMAL_WARNING', warning]] as const) {
      if (!encounters.length) continue;
      add({ family, encounters: encounters.length }, encounters.flatMap(({ id, act, patrol }) => [id, act.eventId, patrol.eventId]),
        family === 'EDUCATION' ? 105 : 110, 'direct',
        encounters.flatMap(({ act, noticeId }) => noticeId ? [noticeId, act.lawEventId] : [act.lawEventId]),
        encounters.map(({ act }) => act.law));
    }

    const taken = new Set(investigations.map(({ act }) => act.eventId));
    const publicMisses = day.patrol.prohibitedActs.filter((act) => {
      if (act.route !== 'village-public' || taken.has(act.eventId) || !actWitness(act)) return false;
      const eligible = validPresence.filter((patrol) => patrol.slot === act.slot && patrol.guardId !== act.citizenId);
      return eligible.length > 0 && eligible.every((patrol) =>
        investigations.filter((entry) => entry.patrol.eventId === patrol.eventId).length === patrol.capacity);
    });
    if (publicMisses.length) {
      const slots = new Set(publicMisses.map(({ slot }) => slot));
      const attempts = investigations.filter(({ act }) => slots.has(act.slot));
      const patrols = validPresence.filter(({ slot }) => slots.has(slot));
      add({ family: 'PATROL_CAPACITY_GAP', missed: publicMisses.length, attempts: attempts.length, patrols: patrols.length },
        publicMisses.map(({ eventId }) => eventId), 91, 'direct',
        [...attempts.map(({ id }) => id), ...patrols.map(({ eventId }) => eventId)], publicMisses.map(({ law }) => law));
    }

    const tired = daily.filter((event) => event.reason === 'fatigue-limit' &&
      (event.status === 'not-feasible-at-selection' || event.status === 'blocked-at-execution') &&
      ['harvest-food', 'cut-timber', 'market-delivery', 'patrol'].includes(event.action));
    if (tired.length) add({ family: 'FATIGUE_BLOCKED_WORK', workRecords: tired.length },
      tired.map(({ id }) => id), 80);

    for (const event of daily) {
      const requirements = (event.legalChoice ?? []).flatMap((choice) => {
        const winner = choice.perceived.winner;
        if (!winner || choice.perceived.status !== 'required' || choice.selectionBarrier !== null ||
            !choice.perceived.considered.some((rule) => same(rule.ref, winner) && rule.applicable && rule.modality === 'MUST')) return [];
        const source = choice.noticeEventIds.map((id) => notices.get(id)).find((notice) => notice &&
          resolves(notice.eventId) && notice.citizenId === event.actorId && same(notice, winner) &&
          (notice.learnedAtTurn < turn || notice.learnedAtTurn === turn && notice.learnedAtPhase === 'dawn'));
        return source ? [{ choice: choice.actionId, law: winner, notice: source.eventId }] : [];
      });
      if (new Set(requirements.map(({ law }) => key(law))).size < 2 ||
          new Set(requirements.map(({ choice }) => choice)).size < 2) continue;
      add({ family: 'COMPETING_KNOWN_DUTIES', duties: requirements.length }, [event.id], 96, 'direct',
        requirements.map(({ notice }) => notice), requirements.map(({ law }) => law));
      break;
    }
  }
  return { candidates: candidate, diagnostics };
}
