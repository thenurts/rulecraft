import {
  canonicalJson, listLawTokens, parseVillageFixture, predicateRegistry, societyDefaults,
  type LawDraft, type LawPolicy, type SocietyConfig, type SocietyGame, type VillageFixture,
} from '@rulecraft/simulation';
import original from '../../../fixtures/task-01-village.json';

export type Mode = 'junior' | 'full';
export type Track = 'campaign' | 'sandbox';
export interface Selection { readonly mode: Mode; readonly track: Track }

export interface ModeProfile {
  readonly id: Mode;
  readonly version: number;
  readonly label: string;
  readonly explanation: string;
  readonly guidance: 'guided' | 'detailed';
  readonly optionalClauses: 1 | 2;
  readonly campaignClauseDay: number;
  readonly campaignPredicates: readonly (keyof typeof predicateRegistry)[];
}

const allPredicates = Object.keys(predicateRegistry) as (keyof typeof predicateRegistry)[];
function profile(definition: ModeProfile): ModeProfile {
  const { version, campaignClauseDay, campaignPredicates } = definition;
  if (!Number.isSafeInteger(version) || version < 1 ||
      !Number.isInteger(campaignClauseDay) || campaignClauseDay < 0 || campaignClauseDay >= 12 ||
      !campaignPredicates.length || new Set(campaignPredicates).size !== campaignPredicates.length ||
      !campaignPredicates.every((name) => allPredicates.includes(name))) throw new Error('Invalid mode profile.');
  return Object.freeze({ ...definition, campaignPredicates: Object.freeze([...campaignPredicates]) });
}

export const modeProfiles = Object.freeze({
  junior: profile({
    id: 'junior', version: 1, label: 'Junior', guidance: 'guided', optionalClauses: 1, campaignClauseDay: 6,
    campaignPredicates: ['slot', 'marketFood', 'fatigue'],
    explanation: 'Short explanations and one optional clause. The Hungry Village introduces clauses after day six.',
  }),
  full: profile({
    id: 'full', version: 1, label: 'Full', guidance: 'detailed', optionalClauses: 2, campaignClauseDay: 0,
    campaignPredicates: allPredicates,
    explanation: 'More detail and both supported clause types from the start.',
  }),
});

export type ScenarioId = 'hungry-village' | 'sandbox-experiment';
export type PresetId = 'standard-village-v1' | 'five-merchants-farmers-v1';

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly version: number;
  readonly track: Track;
  readonly label: string;
  readonly defaultPreset: PresetId;
  readonly presets: readonly PresetId[];
  readonly defaultSeed: number;
  readonly config: SocietyConfig;
  readonly policy: LawPolicy;
}

function scenario(definition: ScenarioDefinition): ScenarioDefinition {
  if (!validSeed(definition.defaultSeed) || !Number.isSafeInteger(definition.version) || definition.version < 1 ||
      !definition.presets.includes(definition.defaultPreset) || new Set(definition.presets).size !== definition.presets.length ||
      !definition.presets.every((id) => Object.hasOwn(presets, id))) throw new Error('Invalid scenario definition.');
  return Object.freeze({ ...definition, presets: Object.freeze([...definition.presets]) });
}

function fixture(input: unknown): VillageFixture {
  const parsed = parseVillageFixture(input);
  if (parsed.days !== 12) throw new Error('Task 06 presets must last 12 days.');
  for (const group of Object.values(parsed)) if (typeof group === 'object') Object.freeze(group);
  return Object.freeze(parsed);
}

export const presets = Object.freeze({
  'standard-village-v1': Object.freeze({ label: 'Standard Village', fixture: fixture(original) }),
  'five-merchants-farmers-v1': Object.freeze({ label: 'Five Merchants', fixture: fixture({
    ...original, population: { farmer: 21, forester: 6, merchant: 5, guard: 8 },
  }) }),
});

const legalPolicy = Object.freeze({ changesPerTurn: 2, mustWeight: 60, mustNotWeight: 55 });

export const scenarios = Object.freeze({
  campaign: scenario({
    id: 'hungry-village', version: 1, track: 'campaign', label: 'The Hungry Village',
    config: societyDefaults, policy: legalPolicy,
    defaultPreset: 'five-merchants-farmers-v1', presets: ['five-merchants-farmers-v1'], defaultSeed: 20000,
  }),
  sandbox: scenario({
    id: 'sandbox-experiment', version: 1, track: 'sandbox', label: '12-day Sandbox experiment',
    config: societyDefaults, policy: legalPolicy,
    defaultPreset: 'standard-village-v1', presets: ['standard-village-v1', 'five-merchants-farmers-v1'], defaultSeed: 42,
  }),
});

export interface StartSelection extends Selection { readonly preset?: PresetId; readonly seed?: number }
export interface RunSetup {
  readonly version: 1;
  readonly profile: Mode;
  readonly profileVersion: number;
  readonly scenario: ScenarioId;
  readonly scenarioVersion: number;
  readonly preset: PresetId;
  readonly seed: number;
}

function validSeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;
}

export function readSeed(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  const number = Number(value);
  return validSeed(number) ? number : undefined;
}

export function makeSetup(selection: StartSelection): RunSetup {
  if (!Object.hasOwn(modeProfiles, selection.mode) || !Object.hasOwn(scenarios, selection.track)) {
    throw new Error('Unknown mode or scenario.');
  }
  const definition = scenarios[selection.track];
  const preset = selection.preset ?? definition.defaultPreset;
  const seed = selection.seed ?? definition.defaultSeed;
  if (!definition.presets.includes(preset) || !validSeed(seed)) throw new Error('Invalid preset or seed.');
  return Object.freeze({ version: 1, profile: selection.mode, profileVersion: modeProfiles[selection.mode].version,
    scenario: definition.id, scenarioVersion: definition.version, preset, seed });
}

// Task 04 preview saves have no scenario metadata. Their starting parameters are
// fixed to seed 42, the original fixture and default v3/v4 society and law settings.
// A save from a newer preset must not be relabelled as a legacy preview.
const legacyPreviewPolicy: LawPolicy = { changesPerTurn: 2, mustWeight: 60, mustNotWeight: 55 };

function isLegacyPreview(game: SocietyGame): boolean {
  return (game.versions.schemaVersion === 3 || game.versions.schemaVersion === 4) &&
    game.seed === 42 &&
    canonicalJson(game.fixture) === canonicalJson(presets['standard-village-v1'].fixture) &&
    canonicalJson(game.config) === canonicalJson(societyDefaults) &&
    canonicalJson(game.policy) === canonicalJson(legacyPreviewPolicy);
}

export function verifiedSetup(selection: Selection, game: SocietyGame, input: unknown): RunSetup | undefined {
  if (input === undefined) {
    if (!isLegacyPreview(game)) throw new Error('Missing scenario setup is not a valid historical preview.');
    return undefined;
  }
  if (!input || typeof input !== 'object') throw new Error('Invalid saved scenario metadata.');
  const { preset, seed } = input as Partial<RunSetup>;
  if (!preset || !validSeed(seed)) throw new Error('Invalid saved preset or seed.');
  const known = makeSetup({ ...selection, preset, seed });
  const definition = scenarios[selection.track];
  if (canonicalJson(known) !== canonicalJson(input) || game.versions.schemaVersion !== 4 ||
      game.seed !== known.seed || canonicalJson(game.config) !== canonicalJson(definition.config) ||
      canonicalJson(game.policy) !== canonicalJson(definition.policy) || canonicalJson(game.fixture) !== canonicalJson(presets[known.preset].fixture)) {
    throw new Error('Saved starting setup does not match its scenario or engine snapshot.');
  }
  return known;
}

export interface EditorProfile {
  readonly clauseDay: number;
  readonly optionalClauses: 1 | 2;
  readonly predicates: readonly (keyof typeof predicateRegistry)[];
}

export function editorProfile(selection: Selection, setup?: RunSetup): EditorProfile {
  const mode = modeProfiles[selection.mode];
  return {
    clauseDay: setup && selection.track === 'campaign' ? mode.campaignClauseDay : 0,
    optionalClauses: mode.optionalClauses,
    predicates: setup && selection.track === 'campaign' ? mode.campaignPredicates : allPredicates,
  };
}

export function editorTokens(wording: LawDraft, profile: EditorProfile, day: number) {
  const tokens = listLawTokens(wording, profile.optionalClauses === 1 ? 'junior' : 'full');
  for (const field of ['when', 'unless'] as const) {
    const clause = wording[field];
    // Existing clauses stay visible and editable, including clauses outside a newer teaching palette.
    const operands = tokens[field].operands.filter((operand) =>
      clause?.operand === operand || day >= profile.clauseDay && profile.predicates.includes(operand));
    tokens[field] = { ...tokens[field], operands };
  }
  return tokens;
}
