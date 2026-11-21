import { daySlots, occupations, villageAccounts, type DaySlot, type Occupation } from './model.ts';

export const lawRegistryVersion = 'village-law-v1';
export const villageScope = { issuerId: 'council.village', jurisdictionId: 'jurisdiction.village' } as const;
export const selectors = [...occupations, 'all-citizens'] as const;
export const modalities = ['MUST', 'MUST_NOT', 'MAY'] as const;
const numericOperators = ['LT', 'LTE', 'EQ', 'GTE', 'GT'] as const;

export type TargetSelector = typeof selectors[number];
export type Modality = typeof modalities[number];
type NumericOperator = typeof numericOperators[number];

export const occupationAction = {
  farmer: 'harvest-food', forester: 'cut-timber', merchant: 'market-delivery', guard: 'patrol',
} as const satisfies Record<Occupation, string>;

export type ExecutableAction = typeof occupationAction[Occupation] | 'rest';
export type LawAction = ExecutableAction | 'export-food';

interface ActionEntry {
  readonly label: string;
  readonly eligible: readonly Occupation[];
  readonly capability: string;
  readonly executable: boolean;
  readonly licenceRequired: boolean;
  readonly defaultOpen: boolean;
  readonly slots: 1;
}

export const actionRegistry: Readonly<Record<LawAction, ActionEntry>> = {
  'harvest-food': { label: 'harvest food', eligible: ['farmer'], capability: 'field', executable: true, licenceRequired: false, defaultOpen: true, slots: 1 },
  'cut-timber': { label: 'cut timber', eligible: ['forester'], capability: 'forest', executable: true, licenceRequired: false, defaultOpen: true, slots: 1 },
  'market-delivery': { label: 'deliver food to the market', eligible: ['merchant'], capability: 'market', executable: true, licenceRequired: false, defaultOpen: true, slots: 1 },
  patrol: { label: 'patrol', eligible: ['guard'], capability: 'guard-station', executable: true, licenceRequired: false, defaultOpen: true, slots: 1 },
  rest: { label: 'rest', eligible: occupations, capability: 'village', executable: true, licenceRequired: false, defaultOpen: true, slots: 1 },
  'export-food': { label: 'export food', eligible: ['merchant'], capability: 'bounded-export', executable: false, licenceRequired: true, defaultOpen: false, slots: 1 },
};

const stocks = {
  marketFood: { label: 'market-owned food', unit: 'food units', accountId: villageAccounts.marketFood },
  fieldFood: { label: 'harvestable field stock', unit: 'food units', accountId: villageAccounts.fieldFood },
  forestTimber: { label: 'standing forest stock', unit: 'timber units', accountId: villageAccounts.forestTimber },
  treasuryCoin: { label: 'Treasury balance', unit: 'coins', accountId: villageAccounts.treasuryCoin },
} as const;

export const predicateRegistry = {
  slot: { label: 'slot', unit: 'daytime slot' },
  fatigue: { label: 'citizen fatigue', unit: 'fatigue points' },
  ...stocks,
} as const;

type NumericOperand = keyof typeof stocks | 'fatigue';
type Operand = keyof typeof predicateRegistry;
export type Predicate =
  | Readonly<{ operand: 'slot'; operator: 'EQ'; value: DaySlot }>
  | Readonly<{ operand: NumericOperand; operator: NumericOperator; value: number }>;

interface ClauseDraft {
  readonly operand?: Operand;
  readonly operator?: NumericOperator;
  readonly value?: number | DaySlot;
}

export interface LawAst {
  readonly issuerId: string;
  readonly jurisdictionId: string;
  readonly targetSelector: TargetSelector;
  readonly modality: Modality;
  readonly actionId: LawAction;
  readonly when?: Predicate;
  readonly unless?: Predicate;
  readonly priority: number;
}

export interface LawDraft {
  readonly targetSelector?: TargetSelector;
  readonly modality?: Modality;
  readonly actionId?: LawAction;
  readonly when?: ClauseDraft;
  readonly unless?: ClauseDraft;
}

const subjectLabels: Record<TargetSelector, string> = {
  farmer: 'Farmers', forester: 'Foresters', merchant: 'Merchants', guard: 'Guards', 'all-citizens': 'All citizens',
};
const modalityLabels: Record<Modality, string> = { MUST: 'must', MUST_NOT: 'must not', MAY: 'may' };
const operatorLabels: Record<NumericOperator, string> = {
  LT: 'is below', LTE: 'is at most', EQ: 'is', GTE: 'is at least', GT: 'is above',
};

function keys<Key extends string>(value: Readonly<Record<Key, unknown>>): Key[] {
  return Object.keys(value) as Key[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

function oneOf<T>(value: unknown, choices: readonly T[]): value is T {
  return choices.some((choice) => value === choice);
}

function operators(operand: Operand): readonly NumericOperator[] {
  return operand === 'slot' ? ['EQ'] : numericOperators;
}

function validValue(operand: Operand, value: unknown): boolean {
  return operand === 'slot' ? oneOf(value, daySlots) : typeof value === 'number' &&
    Number.isSafeInteger(value) && value >= 0;
}

export function targetMatches(selector: TargetSelector, occupation: Occupation): boolean {
  return selector === 'all-citizens' || selector === occupation;
}

function supports(selector: TargetSelector, entry: ActionEntry): boolean {
  return occupations.every((occupation) => !targetMatches(selector, occupation) || entry.eligible.includes(occupation));
}

function availableActions(selector: TargetSelector): ExecutableAction[] {
  return keys(actionRegistry).filter((action): action is ExecutableAction =>
    action !== 'export-food' && actionRegistry[action].executable && supports(selector, actionRegistry[action]));
}

export function listLawTokens(draft: LawDraft, profile: 'junior' | 'full' = 'full') {
  const actions = draft.targetSelector && draft.modality ? availableActions(draft.targetSelector) : [];
  const editable = !!draft.actionId && actions.includes(draft.actionId as ExecutableAction);
  function clauseOptions(clause: ClauseDraft | undefined, other: ClauseDraft | undefined) {
    if (!editable || (profile === 'junior' && !clause && other)) {
      return { operands: [], operators: [], values: null };
    }
    const operand = clause?.operand;
    return {
      operands: keys(predicateRegistry),
      operators: operand ? operators(operand) : [],
      values: operand && clause?.operator && operators(operand).includes(clause.operator)
        ? operand === 'slot' ? { choices: daySlots } : { minimum: 0, integer: true, unit: predicateRegistry[operand].unit }
        : null,
    };
  }
  return {
    selectors, modalities: draft.targetSelector ? modalities : [], actions,
    when: clauseOptions(draft.when, draft.unless), unless: clauseOptions(draft.unless, draft.when),
  };
}

export function updateLawDraft(draft: LawDraft, patch: LawDraft): LawDraft {
  const next = { ...draft, ...patch };
  if (!next.targetSelector) return {};
  if (!next.modality) return { targetSelector: next.targetSelector };
  const { targetSelector, modality, actionId } = next;
  if (!actionId || !availableActions(targetSelector).some((action) => action === actionId)) {
    return { targetSelector, modality };
  }
  function updateClause(previous: ClauseDraft | undefined, edited: ClauseDraft | undefined) {
    if (!edited) return undefined;
    const clause = Object.hasOwn(edited, 'operand') && edited.operand !== previous?.operand
      ? edited : { ...previous, ...edited };
    if (!clause.operand) return undefined;
    const { operand, operator, value } = clause;
    if (!operator || !operators(operand).includes(operator)) return { operand };
    return validValue(operand, value) ? { operand, operator, value } : { operand, operator };
  }
  const result: { -readonly [Key in keyof LawDraft]: LawDraft[Key] } = { targetSelector, modality, actionId };
  for (const key of ['when', 'unless'] as const) {
    const previous = actionId === draft.actionId ? draft[key] : undefined;
    const clause = Object.hasOwn(patch, key) ? updateClause(previous, patch[key]) : previous;
    if (clause) result[key] = clause;
  }
  return result;
}

export interface LawIssue {
  readonly severity: 'BLOCKING' | 'WARNING';
  readonly code: string;
  readonly relatedLawId?: string;
}

export interface LawCandidate { readonly lawId: string; readonly ast: LawAst }

export interface LawValidation {
  readonly ast: LawAst | null;
  readonly issues: readonly LawIssue[];
}

function parsePredicate(value: unknown): Predicate | null {
  if (!isRecord(value) || Object.keys(value).length !== 3 ||
      !oneOf(value.operand, keys(predicateRegistry)) || !oneOf(value.operator, operators(value.operand)) ||
      !validValue(value.operand, value.value)) return null;
  const { operand, operator, value: threshold } = value;
  return { operand, operator, value: threshold } as Predicate;
}

export function validateLaw(input: unknown, active: readonly LawCandidate[] = []): LawValidation {
  const reject = (code: string): LawValidation => ({ ast: null, issues: [{ severity: 'BLOCKING', code }] });
  if (!isRecord(input) || Object.keys(input).some((key) => ![
    'issuerId', 'jurisdictionId', 'targetSelector', 'modality', 'actionId', 'when', 'unless', 'priority',
  ].includes(key))) return reject('INVALID_AST');
  const { issuerId, jurisdictionId, targetSelector, modality, actionId } = input;
  if (issuerId !== villageScope.issuerId || jurisdictionId !== villageScope.jurisdictionId) return reject('INVALID_AUTHORITY');
  if (!oneOf(targetSelector, selectors)) return reject('INVALID_SELECTOR');
  if (!oneOf(modality, modalities)) return reject('INVALID_MODALITY');
  if (!oneOf(actionId, keys(actionRegistry)) || !actionRegistry[actionId].executable) return reject('ACTION_UNAVAILABLE');
  if (!supports(targetSelector, actionRegistry[actionId])) return reject('CAPABILITY_MISMATCH');
  const priority = input.priority === undefined ? 0 : input.priority;
  if (typeof priority !== 'number' || !Number.isSafeInteger(priority)) return reject('INVALID_PRIORITY');
  const when = Object.hasOwn(input, 'when') ? parsePredicate(input.when) : undefined;
  const unless = Object.hasOwn(input, 'unless') ? parsePredicate(input.unless) : undefined;
  if (when === null || unless === null) return reject('INVALID_PREDICATE');

  const ast: LawAst = {
    issuerId, jurisdictionId, targetSelector, modality, actionId, priority,
    ...(when && { when }), ...(unless && { unless }),
  };
  return { ast, issues: warnings(ast, active) };
}

function possibleInSlot(ast: LawAst, slot: DaySlot): boolean {
  return (ast.when?.operand !== 'slot' || ast.when.value === slot) &&
    (ast.unless?.operand !== 'slot' || ast.unless.value !== slot);
}

function warnings(ast: LawAst, active: readonly LawCandidate[]): LawIssue[] {
  const issues: LawIssue[] = [];
  const warn = (code: string, relatedLawId?: string) =>
    issues.push({ severity: 'WARNING', code, ...(relatedLawId && { relatedLawId }) });
  const overlapping = active.filter(({ ast: other }) =>
    (ast.targetSelector === other.targetSelector || ast.targetSelector === 'all-citizens' ||
      other.targetSelector === 'all-citizens') &&
    daySlots.some((slot) => possibleInSlot(ast, slot) && possibleInSlot(other, slot)));
  for (const { lawId, ast: other } of overlapping) {
    if (ast.actionId === other.actionId && ast.modality !== other.modality) warn('POTENTIAL_CONFLICT', lawId);
    if (ast.actionId !== other.actionId && ast.modality === 'MUST' && other.modality === 'MUST') {
      warn('COMPETING_DUTIES', lawId);
    }
  }
  if (ast.modality === 'MAY' && actionRegistry[ast.actionId].defaultOpen &&
      !overlapping.some(({ ast: other }) => other.actionId === ast.actionId && other.modality !== 'MAY')) {
    warn('REDUNDANT_PERMISSION');
  }
  if (ast.modality === 'MUST' && ast.targetSelector === 'all-citizens' && ast.actionId === 'rest') {
    warn('BROAD_REST_DUTY');
  }
  if (ast.when && ast.unless && ast.when.operand === ast.unless.operand &&
      ast.when.operator === ast.unless.operator && ast.when.value === ast.unless.value) warn('SELF_CANCELLING_CLAUSES');
  return issues;
}

export function renderLaw(ast: LawAst): string {
  function describe(predicate: Predicate): string {
    if (predicate.operand === 'slot') return `the slot is ${predicate.value}`;
    const { label, unit } = predicateRegistry[predicate.operand];
    return `${label} ${operatorLabels[predicate.operator]} ${predicate.value} ${unit}`;
  }
  return [
    `${subjectLabels[ast.targetSelector]} ${modalityLabels[ast.modality]} ${actionRegistry[ast.actionId].label}`,
    ast.when && ` when ${describe(ast.when)}`, ast.unless && ` unless ${describe(ast.unless)}`,
  ].filter(Boolean).join('') + '.';
}

export interface PredicateFrame {
  readonly slot: DaySlot;
  readonly fatigue: number;
  readonly accountQuantity: (id: string) => number;
}

export function readOperand(operand: Operand, frame: PredicateFrame): DaySlot | number {
  if (operand === 'slot') return frame.slot;
  if (operand === 'fatigue') return frame.fatigue;
  return frame.accountQuantity(stocks[operand].accountId);
}

export function matchesPredicate(predicate: Predicate, observed: DaySlot | number): boolean {
  if (predicate.operator === 'EQ') return observed === predicate.value;
  if (typeof observed !== 'number') return false;
  switch (predicate.operator) {
    case 'LT': return observed < predicate.value;
    case 'LTE': return observed <= predicate.value;
    case 'GTE': return observed >= predicate.value;
    case 'GT': return observed > predicate.value;
  }
}
