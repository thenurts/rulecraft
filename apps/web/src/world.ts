import { citizenAccount, startSociety, villageAccounts, type SocietyGame } from '@rulecraft/simulation';
import { makeSetup, scenarios, presets, type RunSetup, type Selection, type StartSelection } from './profiles.ts';

export type { Mode, Selection } from './profiles.ts';
export interface GameSession extends Selection { readonly id: string; readonly game: SocietyGame; readonly setup?: RunSetup }

export const modeLabel = { junior: 'Junior', full: 'Full' };
const legacyTrackLabel = { campaign: 'Campaign preview', sandbox: '12-day Sandbox trial' };

export function sessionLabel(session: GameSession): string {
  return `${modeLabel[session.mode]} · ${session.setup ? scenarios[session.track].label : legacyTrackLabel[session.track]}`;
}

export function setupLabel(session: GameSession): string {
  const { setup, game } = session;
  return setup
    ? `${presets[setup.preset].label} preset · Scenario v${setup.scenarioVersion} · Profile v${setup.profileVersion} · Seed ${setup.seed}`
    : `Legacy preview · Seed ${game.seed}`;
}

export const occupations = { farmer: 'Farmers', forester: 'Foresters', merchant: 'Merchants', guard: 'Guards' };
export type Screen = { name: 'home' | 'village' | 'book' | 'composer' | 'results' | 'gazette' | 'inquiry' | 'chronicle' | 'share'; id?: string };
export const homeScreen: Screen = { name: 'home' };
export const villageScreen: Screen = { name: 'village' };

export function visit(history: readonly Screen[], screen: Screen): readonly Screen[] {
  const current = history[history.length - 1];
  if (current?.name === screen.name && current.id === screen.id) return history;
  if (screen.name === 'home') return [homeScreen];
  return [...history, screen];
}

export function previous(history: readonly Screen[]): readonly Screen[] {
  return history.length > 1 ? history.slice(0, -1) : history;
}

export function browserId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function newSession(selection: StartSelection, id: string): GameSession {
  const setup = makeSetup(selection);
  const { config, policy } = scenarios[selection.track];
  return { mode: selection.mode, track: selection.track, id, setup,
    game: startSociety(presets[setup.preset].fixture, setup.seed, config, policy) };
}

export function lawRefLabel(game: SocietyGame, lawId: string, version?: number): string {
  const list = game.book.versions;
  const number = [...new Set(list.map((law) => law.lawId))].indexOf(lawId) + 1;
  return `${number > 0 ? `Decree ${number}` : lawId}${version === undefined ? '' : ` · Version ${version}`}`;
}

export function citizenLabel(id: string): string {
  return id.startsWith('citizen.') ? `Citizen ${Number(id.slice(8))}` : id;
}

export function villageReadModel(game: SocietyGame) {
  const latest = game.days.at(-1);
  const social = game.societyDays.at(-1);
  const balances = new Map(game.state.accounts.map((account) => [account.id, account.quantity]));
  const stock = (id: string) => balances.get(id) ?? 0;
  const fed = game.days.reduce((total, day) => total + day.residentsFed, 0);
  const mealOpportunities = game.days.reduce((total, day) => total + day.residentsFed + day.residentsUnmet, 0);
  return {
    day: game.state.turn, limit: game.fixture.days, remaining: game.fixture.days - game.state.turn,
    marketFood: stock(villageAccounts.marketFood), fieldFood: stock(villageAccounts.fieldFood),
    forestTimber: stock(villageAccounts.forestTimber), marketCoin: stock(villageAccounts.marketCoin),
    treasury: stock(villageAccounts.treasuryCoin), count: game.state.citizens.length,
    trust: game.state.citizens.length
      ? Math.round(game.state.citizens.reduce((total, person) => total + person.trust, 0) / game.state.citizens.length)
      : null,
    latest, social, fed, mealOpportunities,
    households: game.state.citizens.map((person) => ({ ...person,
      coin: stock(citizenAccount(person.id, 'coin')), timber: stock(citizenAccount(person.id, 'timber')),
    })),
  };
}
