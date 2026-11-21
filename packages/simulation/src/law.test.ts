import { expect, test } from 'vitest';
import { listLawTokens, renderLaw, updateLawDraft, validateLaw, villageAccounts, villageScope } from '@rulecraft/simulation';
import { matchesPredicate, readOperand } from './law.ts';

const harvest = { ...villageScope, targetSelector: 'farmer', modality: 'MUST', actionId: 'harvest-food' } as const;

test.each([
  ['farmer', ['harvest-food', 'rest']], ['forester', ['cut-timber', 'rest']],
  ['merchant', ['market-delivery', 'rest']], ['guard', ['patrol', 'rest']], ['all-citizens', ['rest']],
] as const)('only exposes executable actions compatible with %s', (targetSelector, actions) => {
  expect(listLawTokens({ targetSelector, modality: 'MAY' }).actions).toEqual(actions);
});

test.each([
  ['INVALID_AST', 'Farmers must harvest'], ['INVALID_AST', { ...harvest, text: 'Harvest' }],
  ['INVALID_AUTHORITY', { ...harvest, issuerId: 'council.other' }],
  ['INVALID_AUTHORITY', { ...harvest, jurisdictionId: 'jurisdiction.other' }],
  ['INVALID_SELECTOR', { ...harvest, targetSelector: 'child' }],
  ['INVALID_MODALITY', { ...harvest, modality: 'WILL' }],
  ['ACTION_UNAVAILABLE', { ...harvest, targetSelector: 'merchant', actionId: 'export-food' }],
  ['CAPABILITY_MISMATCH', { ...harvest, targetSelector: 'guard' }],
  ['CAPABILITY_MISMATCH', { ...harvest, targetSelector: 'all-citizens' }],
  ['INVALID_PRIORITY', { ...harvest, priority: 1.5 }],
  ['INVALID_PREDICATE', { ...harvest, when: { operand: 'villageFood', operator: 'LT', value: 8 } }],
  ['INVALID_PREDICATE', { ...harvest, when: { operand: 'slot', operator: 'LT', value: 'morning' } }],
  ['INVALID_PREDICATE', { ...harvest, when: { operand: 'slot', operator: 'EQ', value: 0 } }],
  ['INVALID_PREDICATE', { ...harvest, unless: { operand: 'fatigue', operator: 'EQ', value: -1 } }],
])('blocks invalid input with %s', (code, input) => {
  expect(validateLaw(input)).toEqual({ ast: null, issues: [{ code, severity: 'BLOCKING' }] });
});

test('changing an incompatible parent clears the action and both clauses', () => {
  const draft = updateLawDraft(
    { targetSelector: 'farmer', modality: 'MUST', actionId: 'harvest-food',
      when: { operand: 'marketFood', operator: 'LT', value: 40 }, unless: { operand: 'slot', operator: 'EQ', value: 'afternoon' } },
    { targetSelector: 'guard' },
  );
  expect(draft).toEqual({ targetSelector: 'guard', modality: 'MUST' });
  expect(listLawTokens(draft).actions).toEqual(['patrol', 'rest']);
});

test('valid next operands control operators, units and incompatible threshold reset', () => {
  let draft = updateLawDraft(harvest, { when: { operand: 'marketFood' } });
  expect(listLawTokens(draft).when.operators).toContain('LT');
  draft = updateLawDraft(draft, { when: { operator: 'LT', value: 40 } });
  expect(listLawTokens(draft).when.values).toMatchObject({ unit: 'food units', integer: true });
  draft = updateLawDraft(draft, { when: { operand: 'slot' } });
  expect(draft.when).toEqual({ operand: 'slot' });
  expect(listLawTokens(draft).when.operators).toEqual(['EQ']);
  expect(listLawTokens(updateLawDraft(draft, { when: { operator: 'EQ' } })).when.values)
    .toEqual({ choices: ['morning', 'afternoon'] });
});

test('Junior exposure leaves shared AST interpretation and projection unchanged', () => {
  const when = { operand: 'fieldFood', operator: 'LTE', value: 80 } as const;
  const unless = { operand: 'fatigue', operator: 'GTE', value: 80 } as const;
  const draft = { ...harvest, when };
  expect(listLawTokens(draft, 'junior').unless.operands).toEqual([]);
  expect(listLawTokens(draft, 'full').unless.operands).toContain('fatigue');
  const result = validateLaw({ ...draft, unless });
  expect(result.issues).toEqual([]);
  expect(result.ast?.priority).toBe(0);
  expect(renderLaw(result.ast!)).toBe(
    'Farmers must harvest food when harvestable field stock is at most 80 food units unless citizen fatigue is at least 80 fatigue points.',
  );
});

test('strategic conflict and redundant permission warn without blocking enactment', () => {
  const original = validateLaw(harvest).ast!;
  expect(validateLaw({ ...harvest, modality: 'MUST_NOT' }, [{ lawId: 'harvest', ast: original }]))
    .toMatchObject({ ast: { modality: 'MUST_NOT' }, issues: [
      { severity: 'WARNING', code: 'POTENTIAL_CONFLICT', relatedLawId: 'harvest' },
    ] });
  expect(validateLaw({ ...harvest, targetSelector: 'all-citizens', actionId: 'rest' }).issues)
    .toEqual([{ severity: 'WARNING', code: 'BROAD_REST_DUTY' }]);
  expect(validateLaw({ ...harvest, modality: 'MAY' }).issues)
    .toEqual([{ severity: 'WARNING', code: 'REDUNDANT_PERMISSION' }]);
});

test('declared market stock reads only the market-owned granary account', () => {
  const values: Readonly<Record<string, number>> = { [villageAccounts.marketFood]: 45, [villageAccounts.fieldFood]: 450 };
  const frame = { slot: 'morning', fatigue: 20, accountQuantity: (id: string) => values[id] } as const;
  const stock = readOperand('marketFood', frame);
  expect(stock).toBe(45);
  expect(matchesPredicate({ operand: 'marketFood', operator: 'LT', value: 45 }, stock)).toBe(false);
  expect(matchesPredicate({ operand: 'marketFood', operator: 'GTE', value: 45 }, stock)).toBe(true);
  expect(readOperand('fieldFood', frame)).toBe(450);
});
