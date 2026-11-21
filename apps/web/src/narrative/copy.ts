import type { Facts, Family } from './facts.ts';

export const narrativeContentVersion = 'village-record-1';
export const advisers = { zoey: 'Zoey', liam: 'Liam', mia: 'Mia', noah: 'Noah' } as const;
export type Adviser = keyof typeof advisers;
export type ReadingMode = 'junior' | 'full';

interface Response { adviser: Adviser; junior: string; full: string }
type Variants<T> = readonly [T, T, T, T];
interface FamilyCopy {
  headlines: Variants<string>;
  responses: Variants<Response>;
  caption?: string;
}

function line(adviser: Adviser, junior: string, full: string): Response {
  return { adviser, junior, full };
}

/** This catalogue is the frozen v1 text. Future copy needs its own version. */
export const catalogueV1: Readonly<Record<Family, FamilyCopy>> = {
  MEAL_UNAFFORDABLE: {
    headlines: ['Food on the shelf, coins short', 'The price of a meal', 'The market had food', 'A gap at the counter'],
    responses: [
      line('zoey', 'Food was there. The coins were short.', 'I keep stock and spending power in separate columns. There’s a reason for that.'),
      line('noah', 'Having food in stock was only half the job.', 'A shelf can be stocked while the meal is still out of reach. That’s the part I’d look at.'),
      line('zoey', 'More stock won’t put coins in a purse.', 'A stock count can’t tell us who can afford what’s on the shelf. The meal record can.'),
      line('noah', 'The price mattered for these meals.', 'The food was on hand. Let’s look at what the residents needed to pay for it.'),
    ],
  },
  MEAL_STOCKOUT: {
    headlines: ['The market ran short', 'Coins ready, food short', 'Orders the market could not fill', 'Too little food at the counter'],
    responses: [
      line('zoey', 'The money was ready. There wasn’t enough food.', 'The orders were funded. The available market stock was the limit this time.'),
      line('noah', 'Having the coins didn’t cover the missing food.', 'The residents could pay for these portions. The market couldn’t supply them.'),
      line('zoey', 'The stock count explains this gap.', 'Add up the funded orders, then look at the stock. That’s the comparison that matters here.'),
      line('noah', 'These meals needed more food at the market.', 'I’d follow the missing portions to the counter before drawing any broader conclusion.'),
    ],
  },
  EDUCATION: {
    headlines: ['A rule learned on patrol', 'An encounter became a lesson', 'News of a prohibition', 'A patrol carried a notice'],
    responses: [
      line('liam', 'The patrol explained a rule that was new to the resident.', 'The rule was already in force. The patrol supplied the part the resident was missing: the notice.'),
      line('liam', 'First came the encounter, then the notice.', 'The patrol found a prohibited act and passed on the current rule. That’s education in the record.'),
      line('liam', 'The patrol helped someone learn the rule.', 'Writing a rule and getting it to the right resident are two different jobs. This patrol did the second one.'),
      line('liam', 'The rule was in force before the resident learned it.', 'The action came before the notice. Keep that order straight when you look up who knew what.'),
    ],
    caption: 'One encounter and a version of the rules to read.',
  },
  FORMAL_WARNING: {
    headlines: ['Formal warning recorded', 'A patrol issued a warning', 'Known rule, recorded warning', 'A warning in the patrol log'],
    responses: [
      line('liam', 'The resident knew the rule. A patrol gave a warning.', 'The current version was known at the time. The record gives us an act, a patrol and a warning.'),
      line('liam', 'The warning has an action and a patrol behind it.', 'I’d keep the evidence in order: the act, the current prohibition and the completed patrol.'),
      line('liam', 'There was a warning after this act.', 'The warning tells us what the patrol recorded. The decision record is where I’d look for the next part.'),
      line('liam', 'The patrol and the warning are both in the log.', 'Knowing a rule and carrying it out are separate entries. Here we have a formal warning.'),
    ],
  },
  PATROL_CAPACITY_GAP: {
    headlines: ['Patrol time ran out', 'More cases than patrol time', 'Acts left uninvestigated', 'Patrols filled their slots'],
    responses: [
      line('liam', 'The patrols used all their investigation slots.', 'In those slots the eligible patrols were fully assigned. There were still public acts left to investigate.'),
      line('liam', 'Some public acts got no investigation.', 'Check the assignments alongside the acts. There’s only so much investigation time in a patrol.'),
      line('liam', 'The patrol log shows where time ran short.', 'An act without an investigation is a separate entry from an investigation without a detection.'),
      line('liam', 'The patrols had more cases than time.', 'A full patrol schedule still leaves a question of coverage. These records show the cases it couldn’t reach.'),
    ],
  },
  FATIGUE_BLOCKED_WORK: {
    headlines: ['Work met the fatigue limit', 'Too tired for the task', 'Fatigue narrowed the choices', 'A task hit its limit'],
    responses: [
      line('mia', 'The job was on the list. The energy was short.', 'The job fitted the roster. It didn’t fit the resident’s available energy.'),
      line('noah', 'Fatigue took the work out of reach.', 'The work record names fatigue. That’s useful evidence about what the resident could actually do.'),
      line('mia', 'Even a tidy work list needs room for tired people.', 'The schedule had a box for work. The recorded fatigue limit put a line through it.'),
      line('noah', 'The fatigue limit mattered here.', 'Look at what the resident could manage at the time. The work record already gives us that starting point.'),
    ],
    caption: 'An open work slot meets a tired set of legs.',
  },
  COMPETING_KNOWN_DUTIES: {
    headlines: ['Two duties, one slot', 'Duties met in the same slot', 'The limits of a crowded timetable', 'More than one feasible duty'],
    responses: [
      line('mia', 'Two duties found one space on the timetable.', 'Two musts walked into one slot. Only one could leave as an action.'),
      line('mia', 'Both duties fitted. The clock had one slot.', 'The duties fit separately. Fitting them both into one action is a trick the clock hasn’t learned.'),
      line('noah', 'The resident knew both duties and had one slot.', 'The record shows both duties were feasible on their own. One resident still had one slot to work with.'),
      line('mia', 'One slot can only hold one action.', 'The timetable is an excellent judge of how many actions fit in a slot. It’s also a very strict one.'),
    ],
    caption: 'Two entries on the timetable and one slot to spend.',
  },
  FOOD_ACCESS_SUCCESS: {
    headlines: ['A full meal for everyone', 'All meals accounted for', 'Everyone ate enough today', 'A full table in the village record'],
    responses: [
      line('noah', 'Everyone had a full meal today.', 'A full meal for everyone today. That’s the line I’d read twice.'),
      line('zoey', 'Every resident’s meal is in the record.', 'The total balances with the individual meal records. Every resident was fully fed today.'),
      line('mia', 'Give this row of the ledger a ribbon.', 'Put a ribbon round this row of the ledger. Every resident’s meal on it was served.'),
      line('zoey', 'The meal totals add up for everyone.', 'A pleasing total, and we can check every line of it. The meal records cover the whole village today.'),
    ],
    caption: 'A full table, for this day’s record.',
  },
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function describeFacts(facts: Facts): string {
  switch (facts.family) {
    case 'MEAL_UNAFFORDABLE':
      return `${plural(facts.residents, 'resident')} could not afford ${plural(facts.units, 'food unit')} while the market still held food.`;
    case 'MEAL_STOCKOUT':
      return `${plural(facts.residents, 'resident')} went without ${plural(facts.units, 'food unit')} they could pay for because there was too little market stock.`;
    case 'EDUCATION':
      return `${plural(facts.encounters, 'patrol encounter')} delivered a notice to a resident who did not know the current prohibition at the time of the act.`;
    case 'FORMAL_WARNING':
      return `${plural(facts.encounters, 'formal warning')} followed a recorded prohibited act. The current version was known at the time.`;
    case 'PATROL_CAPACITY_GAP':
      return `${plural(facts.missed, 'public act')} went uninvestigated in slots where eligible patrols had used their investigation capacity. Those slots recorded ${plural(facts.attempts, 'attempt')} across ${plural(facts.patrols, 'patrol')}.`;
    case 'FATIGUE_BLOCKED_WORK':
      return `${plural(facts.workRecords, 'work record')} gave the fatigue limit as the reason work was unavailable or blocked.`;
    case 'COMPETING_KNOWN_DUTIES':
      return `One resident had ${facts.duties} known feasible duties for different actions in the same slot.`;
    case 'FOOD_ACCESS_SUCCESS':
      return `${facts.fed} of ${facts.total} residents were fully fed, according to their completed meal records.`;
  }
}
