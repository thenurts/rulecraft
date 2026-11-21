import { expect, test } from 'vitest';
import { advanceSociety, confirmLaw, encodeSociety, renderLaw, startSociety, villageScope } from '@rulecraft/simulation';
import fixture from '../../../../fixtures/task-01-village.json';
import { projectNarrative } from './projection.ts';
import { buildShareCard, cardAsText, renderSharePng } from './share.ts';

test('the village report uses the selected facts and adviser without inventing a law or exporting raw IDs', () => {
  const game = advanceSociety(startSociety(fixture, 42));
  const incident = projectNarrative(game, 'junior').incidents.find(({ facts }) => facts.family === 'FOOD_ACCESS_SUCCESS')!;
  expect(buildShareCard(game, 'junior', 'unresolvable')).toBeNull();
  const text = cardAsText(buildShareCard(game, 'junior', incident.id)!);
  expect(text).toContain('VILLAGE REPORT\nNo decree directly linked.');
  expect(text).toContain(incident.summary);
  expect(text).toContain(incident.response);
  expect(text).not.toMatch(/citizen\.|event\.|incident:|account\.|command/);
});

test('a later repeal keeps the exact evidenced version and historical status on the card', () => {
  let game = startSociety(fixture, 42);
  const enacted = confirmLaw(game, {
    operation: 'CREATE', lawId: 'historic-ban', commandId: 'secret-command-id',
    ast: { ...villageScope, targetSelector: 'farmer', actionId: 'harvest-food', modality: 'MUST_NOT' },
  });
  game = enacted.game;
  while (game.state.turn < 6) game = advanceSociety(game);
  const incident = projectNarrative(game, 'full').incidents.find(({ lawVersionRefs, facts }) =>
    lawVersionRefs.some(({ lawId }) => lawId === enacted.version.lawId) && (facts.family === 'EDUCATION' || facts.family === 'FORMAL_WARNING'))!;
  game = advanceSociety(confirmLaw(game, { operation: 'ABOLISH', lawId: 'historic-ban', commandId: 'retire' }).game);
  const before = encodeSociety(game);
  const card = buildShareCard(game, 'full', incident.id)!;
  expect(card.sections[0]).toEqual({
    label: 'MY DECREE',
    text: `Historic version 1. ${renderLaw(enacted.version.ast)} Status on day ${incident.turn} was active.`,
  });
  expect(cardAsText(card)).not.toContain('secret-command-id');
  expect(encodeSociety(game)).toBe(before);
});

test('canvas receives the same validated text and unsupported or failed encoders reject', async () => {
  const game = advanceSociety(startSociety(fixture, 42));
  const card = buildShareCard(game, 'junior', projectNarrative(game, 'junior').incidents[0].id)!;
  const rows: string[] = [];
  const context = { measureText: (text: string) => ({ width: text.length * 15 }),
    fillRect() {}, fillText: (text: string) => { rows.push(text); } };
  const canvas = { width: 0, height: 0, getContext: () => context,
    toBlob: (callback: BlobCallback) => callback(new Blob(['PNG stub'], { type: 'image/png' })) } as unknown as HTMLCanvasElement;
  await expect(renderSharePng(canvas, card)).resolves.toMatchObject({ type: 'image/png' });
  expect({ width: canvas.width, height: canvas.height }).toEqual({ width: 1080, height: 1350 });
  expect(rows.join(' ')).toBe(cardAsText(card).replaceAll('\n', ' '));
  const unsupported = { ...canvas, getContext: () => null } as unknown as HTMLCanvasElement;
  await expect(renderSharePng(unsupported, card)).rejects.toThrow(/unavailable/);
  const failed = { ...canvas, toBlob: (callback: BlobCallback) => callback(null) } as unknown as HTMLCanvasElement;
  await expect(renderSharePng(failed, card)).rejects.toThrow(/could not produce/);
});
