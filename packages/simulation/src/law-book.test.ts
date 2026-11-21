import { expect, test } from 'vitest';
import fixture from '../../../fixtures/task-01-village.json';
import {
  advanceLawGame, authoritativeLaws, confirmLaw, encodeLawGame, encodeSnapshot, lawGameHashes,
  loadLawGame, loadSnapshot, notifyLaw, perceivedLaws, resolveLegality, startLawGame, startVillage, villageScope,
  type LawAction, type LawAst, type LawVersion, type LegalFrame, type Modality,
} from '@rulecraft/simulation';

const farmer: LegalFrame = {
  turn: 1, slot: 'morning', occupation: 'farmer', jurisdictionId: villageScope.jurisdictionId,
  fatigue: 25, accountQuantity: () => 30,
};
const wording: LawAst = { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST', priority: 0 };
const version = (lawId: string, modality: Modality, priority = 0, patch: Partial<LawAst> = {}): LawVersion => ({
  lawId, version: 1, ast: { ...wording, modality, priority, ...patch }, commandId: lawId,
  eventId: `law-event.${lawId}`, confirmedAtTurn: 0, effectiveFromTurn: 1, operation: 'CREATE', status: 'active',
});
const attempt = (operation: string, commandId: string, lawId = 'farm', ast?: LawAst) =>
  ({ operation, commandId, lawId, ...(ast ? { ast } : {}) });
const resolveHarvest = (laws: readonly LawVersion[], frame = farmer) => resolveLegality(laws, frame, 'harvest-food');

test.each([
  ['default-open with no decree', [], 'optional', null],
  ['single MUST creates a duty', [version('a', 'MUST')], 'required', 'a'],
  ['single MUST_NOT prohibits', [version('a', 'MUST_NOT')], 'prohibited', 'a'],
  ['single MAY remains optional', [version('a', 'MAY')], 'optional', 'a'],
  ['equal MUST_NOT beats MUST', [version('a', 'MUST'), version('b', 'MUST_NOT')], 'prohibited', 'b'],
  ['equal MUST_NOT beats MAY', [version('a', 'MAY'), version('b', 'MUST_NOT')], 'prohibited', 'b'],
  ['equal MUST beats MAY', [version('a', 'MAY'), version('b', 'MUST')], 'required', 'b'],
  ['higher MAY defeats prohibition', [version('a', 'MAY', 1), version('b', 'MUST_NOT')], 'optional', 'a'],
  ['higher MUST defeats prohibition', [version('a', 'MUST', 1), version('b', 'MUST_NOT')], 'required', 'a'],
  ['higher MAY removes duty', [version('a', 'MAY', 1), version('b', 'MUST')], 'optional', 'a'],
  ['stable law ID breaks a true tie', [version('b', 'MUST'), version('a', 'MUST')], 'required', 'a'],
] as const)('%s', (_name, laws, status, winner) => {
  const result = resolveHarvest(laws);
  expect(result.status).toBe(status);
  expect(result.winner?.lawId ?? null).toBe(winner);
  expect(result.overridden.map(({ lawId }) => lawId)).toEqual(laws.filter((law) => law.lawId !== winner).map(({ lawId }) => lawId));
  expect(resolveHarvest([...laws].reverse())).toEqual(result);
});

test('authority outranks numerical priority and invalid jurisdictions are ignored', () => {
  const rules = [
    version('local', 'MUST', 200),
    version('superior', 'MUST_NOT', 0, { issuerId: 'council.superior' }),
    version('invalid', 'MAY', 999, { jurisdictionId: 'jurisdiction.other' }),
  ];
  const result = resolveLegality(rules, farmer, 'harvest-food', (issuer) => issuer === 'council.superior' ? 2 : 1);
  expect(result.winner?.lawId).toBe('superior');
  expect(result.overridden).toEqual([{ lawId: 'local', version: 1 }]);
  expect(resolveHarvest(rules).winner?.lawId).toBe('local');
});

test('distinct MUST duties both remain operative', () => {
  const laws = [version('farm', 'MUST'), version('rest', 'MUST', 0, { actionId: 'rest' })];
  expect(resolveHarvest(laws).status).toBe('required');
  expect(resolveLegality(laws, farmer, 'rest').status).toBe('required');
});

test('WHEN and UNLESS use observed units and report failed applicability', () => {
  const rule = version('conditional', 'MUST', 0, {
    when: { operand: 'marketFood', operator: 'LTE', value: 30 },
    unless: { operand: 'slot', operator: 'EQ', value: 'afternoon' },
  });
  expect(resolveHarvest([rule]).considered[0]).toMatchObject({
    when: { observed: 30, matched: true }, unless: { observed: 'morning', matched: false }, applicable: true,
  });
  expect(resolveHarvest([rule], { ...farmer, slot: 'afternoon' }).status).toBe('optional');
  expect(resolveHarvest([rule], { ...farmer, accountQuantity: () => 31 }).status).toBe('optional');
  expect(resolveHarvest([rule], { ...farmer, occupation: 'guard' }).considered).toEqual([]);
});

const exportAction: LawAction = 'export-food';
const exportRule = (lawId: string, mode: Modality, priority = 0, patch: Partial<LawAst> = {}) =>
  version(lawId, mode, priority, { targetSelector: 'merchant', actionId: exportAction, ...patch });

test.each([
  ['no applicable licence', [], 'unlicensed', 'missing', false],
  ['MUST cannot invent a licence', [exportRule('order', 'MUST')], 'unlicensed', 'missing', true],
  ['MAY grants optional licence', [exportRule('permit', 'MAY')], 'optional', 'granted', false],
  ['winning MUST_NOT prohibits even with a licence', [exportRule('permit', 'MAY'), exportRule('ban', 'MUST_NOT')], 'prohibited', 'granted', false],
  ['winning MAY overrides a prohibition and supplies the licence', [exportRule('permit', 'MAY', 1), exportRule('ban', 'MUST_NOT')], 'optional', 'granted', false],
  ['a separate applicable MAY can license a winning MUST', [exportRule('permit', 'MAY'), exportRule('order', 'MUST')], 'required', 'granted', false],
  ['an inapplicable MAY cannot license export', [exportRule('permit', 'MAY', 0, {
    when: { operand: 'slot', operator: 'EQ', value: 'afternoon' },
  }), exportRule('order', 'MUST')], 'unlicensed', 'missing', true],
] as const)('%s', (_name, laws, status, licence, unlicensedDuty) => {
  const result = resolveLegality(laws, { ...farmer, occupation: 'merchant' }, exportAction);
  expect(result).toMatchObject({ status, licence, unlicensedDuty });
  expect(result.licenceRef?.lawId ?? null).toBe(licence === 'granted' ? 'permit' : null);
});

test('confirmed versions are immutable, same-turn replacement is ordered, and retries do not consume allowance', () => {
  const initial = startLawGame(fixture, 42);
  const created = confirmLaw(initial, attempt('CREATE', 'one', 'farm', wording));
  expect(initial.book.versions).toEqual([]);
  expect(created.version).toMatchObject({ version: 1, confirmedAtTurn: 0, effectiveFromTurn: 1 });
  expect(authoritativeLaws(created.game.book, 0)).toEqual([]);
  const changed = confirmLaw(created.game, attempt('AMEND', 'two', 'farm', { ...wording, modality: 'MUST_NOT' }));
  expect(changed.game.book.versions.map(({ ast, version }) => [version, ast.modality])).toEqual([[1, 'MUST'], [2, 'MUST_NOT']]);
  expect(resolveHarvest(authoritativeLaws(changed.game.book, 1)).status).toBe('prohibited');
  expect(confirmLaw(changed.game, attempt('CREATE', 'one', 'farm', wording)).game).toBe(changed.game);
  expect(() => confirmLaw(changed.game, attempt('CREATE', 'one', 'other', wording))).toThrow('COMMAND_ID_REUSED');
  expect(() => confirmLaw(changed.game, attempt('SUSPEND', 'three'))).toThrow('TURN_ALLOWANCE_EXCEEDED');
  expect(() => confirmLaw(changed.game, attempt('CREATE', 'four', 'farm', wording))).toThrow('LAW_ID_IN_USE');
  expect(confirmLaw(advanceLawGame(changed.game), attempt('SUSPEND', 'three')).version.version).toBe(3);
});

test('unaware citizens have no perceived ban; stale knowledge survives amendment, suspension and abolition', () => {
  const id = 'citizen.0001';
  let game = startLawGame(fixture, 42);
  game = confirmLaw(game, attempt('CREATE', 'one', 'farm', { ...wording, modality: 'MUST_NOT' })).game;
  expect(resolveHarvest(authoritativeLaws(game.book, 1)).status).toBe('prohibited');
  expect(resolveHarvest(perceivedLaws(game.book, id, 1)).status).toBe('optional');
  game = notifyLaw(game, id, 'farm', 1);
  game = advanceLawGame(game);
  game = confirmLaw(game, attempt('AMEND', 'two', 'farm', wording)).game;
  const atTwo = { ...farmer, turn: 2 };
  expect(resolveHarvest(authoritativeLaws(game.book, 2), atTwo).status).toBe('required');
  expect(resolveHarvest(perceivedLaws(game.book, id, 2), atTwo).status).toBe('prohibited');
  game = confirmLaw(game, attempt('SUSPEND', 'three')).game;
  expect(resolveHarvest(authoritativeLaws(game.book, 2), atTwo).status).toBe('optional');
  expect(resolveHarvest(perceivedLaws(game.book, id, 2), atTwo).status).toBe('prohibited');
  game = advanceLawGame(game);
  game = confirmLaw(game, attempt('AMEND', 'four', 'farm', wording)).game;
  expect(game.book.versions[3].status).toBe('suspended');
  game = confirmLaw(game, attempt('REINSTATE', 'five')).game;
  const atThree = { ...farmer, turn: 3 };
  expect(resolveHarvest(authoritativeLaws(game.book, 3), atThree).status).toBe('required');
  game = advanceLawGame(game);
  game = confirmLaw(game, attempt('ABOLISH', 'six')).game;
  const atFour = { ...farmer, turn: 4 };
  expect(resolveHarvest(authoritativeLaws(game.book, 4), atFour).status).toBe('optional');
  expect(resolveHarvest(perceivedLaws(game.book, id, 4), atFour).status).toBe('prohibited');
  game = notifyLaw(game, id, 'farm', 6);
  expect(resolveHarvest(perceivedLaws(game.book, id, 4), atFour).status).toBe('optional');
  expect(() => notifyLaw(game, id, 'farm', 4)).toThrow('OBSOLETE_NOTICE');
  expect(() => confirmLaw(game, attempt('REINSTATE', 'seven'))).toThrow('ABOLITION_IS_TERMINAL');
  expect(game.book.versions.map(({ status }) => status))
    .toEqual(['active', 'active', 'suspended', 'suspended', 'active', 'abolished']);
  expect(loadLawGame(encodeLawGame(game))).toEqual(game);
});

test('blocked AST cannot enact but a warning-bearing rival can', () => {
  let game = startLawGame(fixture, 42);
  expect(() => confirmLaw(game, attempt('CREATE', 'invalid', 'export', {
    ...wording, actionId: 'export-food', targetSelector: 'merchant',
  }))).toThrow('ACTION_UNAVAILABLE');
  game = confirmLaw(game, attempt('CREATE', 'one', 'farm', wording)).game;
  const conflicting = confirmLaw(game, attempt('CREATE', 'two', 'ban', { ...wording, modality: 'MUST_NOT' }));
  expect(conflicting.issues).toContainEqual({ severity: 'WARNING', code: 'POTENTIAL_CONFLICT', relatedLawId: 'farm' });
  expect(conflicting.game.book.versions).toHaveLength(2);
});

test('v1 rule-free snapshots remain supported and v2 maintains versioned journal replay', () => {
  const old = encodeSnapshot(startVillage(fixture, 42));
  expect(encodeSnapshot(loadSnapshot(old))).toBe(old);
  expect(() => loadLawGame(old)).toThrow('UNSUPPORTED_LAW_SAVE_VERSION');
  const game = advanceLawGame(confirmLaw(startLawGame(fixture, 42), attempt('CREATE', 'one', 'farm', wording)).game);
  const encoded = encodeLawGame(game);
  expect(() => loadSnapshot(encoded)).toThrow(/version/);
  expect(lawGameHashes(loadLawGame(encoded))).toEqual(lawGameHashes(game));
  expect(() => loadLawGame(encoded.replace('"seed":42', '"seed":43'))).toThrow('LAW_SAVE_CHECKSUM_MISMATCH');
  expect(() => loadLawGame(encodeLawGame({ ...game, journal: [] }))).toThrow('INCOMPLETE_OR_NON_REPRODUCIBLE_LAW_SAVE');
});
