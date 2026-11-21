import { expect, test } from 'vitest';
import { advanceSociety, confirmLaw, encodeSociety, renderLaw, startSociety, villageScope } from '@rulecraft/simulation';
import fixture from '../../../../fixtures/task-01-village.json';
import { completedCompetingDutiesDay } from '../../../../tests/fixtures/task-05-competing-duties.ts';
import { projectNarrative } from './projection.ts';
import { buildShareCard, cardAsText, renderSharePng, ShareCardOverflow, type ShareCard } from './share.ts';

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
    paragraphs: [`Historic version 1. ${renderLaw(enacted.version.ast)} Status on day ${incident.turn} was active.`],
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

test('the competing-duties card includes both exact versions and their own status with no unrelated decree', () => {
  const dayOne = completedCompetingDutiesDay();
  const incident = projectNarrative(dayOne, 'full').incidents.find(({ facts }) => facts.family === 'COMPETING_KNOWN_DUTIES')!;
  expect(incident.lawVersionRefs).toEqual([
    { lawId: 'harvest-food', version: 1 }, { lawId: 'rest', version: 1 },
  ]);
  expect(buildShareCard(dayOne, 'full', incident.id)!.sections[0].paragraphs).toEqual([
    'Decree 1 · Version 1 (operative). Farmers must harvest food. Status on day 1 was active.',
    'Decree 2 · Version 1 (operative). Farmers must rest. Status on day 1 was active.',
  ]);

  const updated = advanceSociety(confirmLaw(dayOne, { operation: 'ABOLISH', lawId: 'harvest-food', commandId: 'abolish-harvest' }).game);
  const before = encodeSociety(updated);
  const card = buildShareCard(updated, 'full', incident.id)!;
  expect(card.sections[0]).toEqual({
    label: 'LINKED DECREES',
    paragraphs: [
      'Decree 1 · Version 1 (historic). Farmers must harvest food. Status on day 1 was active.',
      'Decree 2 · Version 1 (operative). Farmers must rest. Status on day 1 was active.',
    ],
  });
  const text = cardAsText(card);
  expect(text.split('\n').slice(1, 4)).toEqual(['LINKED DECREES', ...card.sections[0].paragraphs]);
  expect(text).toContain(incident.summary);
  expect(text).toContain(incident.response);
  expect(text).not.toMatch(/Version 2|abolish-harvest|confirm-rest/);
  expect(encodeSociety(updated)).toBe(before);
});

test('the card separates the older perceived version from the official suspension on the incident day', () => {
  const dayOne = completedCompetingDutiesDay(5_000);
  const game = advanceSociety(confirmLaw(dayOne, {
    operation: 'SUSPEND', lawId: 'harvest-food', commandId: 'suspend-harvest',
  }).game);
  const incident = projectNarrative(game, 'full').incidents.find(({ turn, facts }) =>
    turn === 2 && facts.family === 'COMPETING_KNOWN_DUTIES')!;
  const card = buildShareCard(game, 'full', incident.id)!;
  expect(card.sections[0].paragraphs).toEqual([
    'Decree 1 · Version 1 (historic). Farmers must harvest food. Perceived as active on day 2. Official version 2 was suspended.',
    'Decree 2 · Version 1 (operative). Farmers must rest. Status on day 2 was active.',
  ]);
});

function measuredCanvas(widthScale: number) {
  let encoded = false;
  const painted: { text: string; size: number; right: number; bottom: number }[] = [];
  const context = {
    font: '',
    measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1]) * widthScale }; },
    fillRect() {},
    fillText(text: string, x: number, y: number) {
      const size = Number(this.font.match(/(\d+)px/)?.[1]);
      painted.push({ text, size, right: x + this.measureText(text).width, bottom: y + size });
    },
  };
  const canvas = {
    width: 0, height: 0, getContext: () => context, toBlob(callback: BlobCallback) {
      encoded = true;
      callback(new Blob(['PNG stub'], { type: 'image/png' }));
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, painted, didEncode: () => encoded };
}

function competingCard(): ShareCard {
  const game = completedCompetingDutiesDay();
  const incident = projectNarrative(game, 'full').incidents.find(({ facts }) => facts.family === 'COMPETING_KNOWN_DUTIES')!;
  return buildShareCard(game, 'full', incident.id)!;
}

test('the competing-duties PNG wraps every linked decree and matches the selectable text within the canvas', async () => {
  const card = competingCard();
  const { canvas, painted } = measuredCanvas(0.95);
  await expect(renderSharePng(canvas, card)).resolves.toMatchObject({ type: 'image/png' });
  expect({ width: canvas.width, height: canvas.height }).toEqual({ width: 1080, height: 1350 });
  expect(painted.map(({ text }) => text).join(' ')).toBe(cardAsText(card).replace(/\s+/g, ' '));
  expect(painted.find(({ text }) => text.startsWith('Decree 1'))!.size).toBeLessThan(44);
  expect(painted.every(({ right, bottom }) => right <= canvas.width && bottom <= canvas.height)).toBe(true);
});

test('an oversized competing-duties card rejects PNG before painting or encoding and retains both decree texts', async () => {
  const card = competingCard();
  const { canvas, painted, didEncode } = measuredCanvas(2.5);
  const originalText = cardAsText(card);
  await expect(renderSharePng(canvas, card)).rejects.toBeInstanceOf(ShareCardOverflow);
  expect(painted).toEqual([]);
  expect(didEncode()).toBe(false);
  expect(cardAsText(card)).toBe(originalText);
  expect(originalText).toContain('Farmers must harvest food.');
  expect(originalText).toContain('Farmers must rest.');
});
