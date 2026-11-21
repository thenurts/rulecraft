import { authoritativeLaws, renderLaw, type SocietyGame } from '@rulecraft/simulation';
import { lawRefLabel } from '../world.ts';
import { advisers, type ReadingMode } from './copy.ts';
import { projectNarrative } from './projection.ts';

export interface ShareCard {
  readonly incidentId: string;
  readonly narrativeVersion: string;
  readonly turn: number;
  readonly heading: string;
  readonly sections: readonly Readonly<{ label: string; paragraphs: readonly string[] }>[];
  readonly footer: string;
}

export const cardDimensions = { width: 1080, height: 1350 } as const;

export function buildShareCard(game: SocietyGame, mode: ReadingMode, incidentId: string): ShareCard | null {
  const incident = projectNarrative(game, mode).incidents.find(({ id }) => id === incidentId);
  if (!incident) return null;
  const official = authoritativeLaws(game.book, incident.turn);
  const current = authoritativeLaws(game.book, game.state.turn);
  const multiple = incident.lawVersionRefs.length > 1;
  const decrees: string[] = [];
  for (const ref of incident.lawVersionRefs) {
    const law = game.book.versions.find((entry) => entry.lawId === ref.lawId && entry.version === ref.version);
    if (!law) return null;
    const atIncident = official.find(({ lawId }) => lawId === law.lawId);
    const atPresent = current.find(({ lawId }) => lawId === law.lawId);
    const historical = atPresent?.version !== law.version || atPresent.status !== 'active';
    const version = multiple
      ? `${lawRefLabel(game, law.lawId, law.version)} (${historical ? 'historic' : 'operative'})`
      : `${historical ? 'Historic version' : 'Version'} ${law.version}`;
    const status = atIncident?.version === law.version
      ? `Status on day ${incident.turn} was ${atIncident.status}.`
      : `Perceived as ${law.status} on day ${incident.turn}. ${atIncident
        ? `Official version ${atIncident.version} was ${atIncident.status}.`
        : 'There was no official version on that day.'}`;
    decrees.push(`${version}. ${renderLaw(law.ast)} ${status}`);
  }
  return {
    incidentId, narrativeVersion: incident.narrativeVersion, turn: incident.turn,
    heading: 'RULECRAFT — THE VILLAGE RECORD',
    sections: [
      {
        label: multiple ? 'LINKED DECREES' : decrees.length ? 'MY DECREE' : 'VILLAGE REPORT',
        paragraphs: decrees.length ? decrees : ['No decree directly linked.'],
      },
      { label: 'WHAT HAPPENED', paragraphs: [`Day ${incident.turn}. ${incident.summary}`] },
      { label: 'ADVISER VERDICT', paragraphs: [`${advisers[incident.adviserId]}. ${incident.response}`] },
    ],
    footer: 'Simulated village trial · Rulecraft',
  };
}

export function cardAsText(card: ShareCard): string {
  return [card.heading, ...card.sections.flatMap(({ label, paragraphs }) => [label, ...paragraphs]), card.footer].join('\n');
}

export class ShareCardOverflow extends Error {}

function wrap(context: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let row = '';
  for (const word of value.split(/\s+/)) {
    if (context.measureText(word).width > maxWidth) throw new ShareCardOverflow('The card text does not fit.');
    const next = row ? `${row} ${word}` : word;
    if (row && context.measureText(next).width > maxWidth) {
      lines.push(row);
      row = word;
    } else row = next;
  }
  if (row) lines.push(row);
  return lines;
}

export async function renderSharePng(canvas: HTMLCanvasElement, card: ShareCard): Promise<Blob> {
  canvas.width = cardDimensions.width;
  canvas.height = cardDimensions.height;
  const context = canvas.getContext('2d');
  if (!context || typeof canvas.toBlob !== 'function') throw new Error('PNG rendering is unavailable.');
  const margin = 80;
  const width = canvas.width - 2 * margin;
  const header = 236;
  const footer = canvas.height - 100;
  context.textBaseline = 'top';

  const paragraphGap = 12;
  const sizes = [44, 40, 36, 32];
  const layout = sizes.flatMap((size) => {
    context.font = `${size}px Georgia, serif`;
    try {
      const lineHeight = Math.ceil(size * 1.26);
      const blocks = card.sections.map(({ label, paragraphs }) => {
        const lines = paragraphs.map((paragraph) => wrap(context, paragraph, width - 64));
        const height = 88 + lines.reduce((total, rows) => total + lineHeight * rows.length, 0)
          + paragraphGap * (lines.length - 1);
        return { label, lines, height };
      });
      return [{ size, blocks, lineHeight, height: blocks.reduce((total, block) => total + block.height + 20, 0) }];
    } catch (error) {
      if (error instanceof ShareCardOverflow) return [];
      throw error;
    }
  }).find(({ height }) => height <= footer - header);
  if (!layout) throw new ShareCardOverflow('There is too much text for this PNG.');

  context.fillStyle = '#f6efdf';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#842e25';
  context.fillRect(0, 0, canvas.width, 192);
  context.fillStyle = '#fffaf0';
  context.font = 'bold 49px Georgia, serif';
  const title = wrap(context, card.heading, width);
  title.forEach((line, index) => context.fillText(line, margin, 48 + index * 60));

  let y = header;
  for (const { label, lines, height } of layout.blocks) {
    context.fillStyle = '#fffaf0';
    context.fillRect(margin, y, width, height);
    context.fillStyle = '#842e25';
    context.font = 'bold 28px system-ui, sans-serif';
    context.fillText(label, margin + 32, y + 24);
    context.fillStyle = '#302a20';
    context.font = `${layout.size}px Georgia, serif`;
    let rowY = y + 65;
    for (const paragraph of lines) {
      for (const row of paragraph) {
        context.fillText(row, margin + 32, rowY);
        rowY += layout.lineHeight;
      }
      rowY += paragraphGap;
    }
    y += height + 20;
  }
  context.fillStyle = '#493e30';
  context.font = '29px system-ui, sans-serif';
  context.fillText(card.footer, margin, footer + 14);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob?.type === 'image/png') resolve(blob);
    else reject(new Error('The browser could not produce a PNG.'));
  }, 'image/png'));
}
