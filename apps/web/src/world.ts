import { citizenAccount, startSociety, villageAccounts, type SocietyGame } from '@rulecraft/simulation';
import fixture from '../../../fixtures/task-01-village.json';

export type Mode = 'junior' | 'full';
export type Track = 'campaign' | 'sandbox';
export interface Selection { mode: Mode; track: Track }
export interface GameSession extends Selection { id: string; game: SocietyGame }

export const modeLabel = { junior: 'Junior', full: 'Full' };
export const trackLabel = { campaign: 'Campaign preview', sandbox: '12-day Sandbox trial' };
export const occupations = { farmer: 'Farmers', forester: 'Foresters', merchant: 'Merchants', guard: 'Guards' };
export type Screen = { name: 'home' | 'village' | 'book' | 'composer' | 'results' | 'gazette' | 'inquiry'; id?: string };
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

export function newSession(selection: Selection, id: string, seed = 42): GameSession {
  return { ...selection, id, game: startSociety(fixture, seed) };
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
