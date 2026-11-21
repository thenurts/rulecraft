import { authoritativeLaws, renderLaw, type SocietyGame } from '@rulecraft/simulation';
import { advisers, type ReadingMode } from './copy.ts';
import { projectNarrative } from './projection.ts';

export interface ShareCard {
  readonly incidentId: string;
  readonly narrativeVersion: string;
  readonly turn: number;
  readonly heading: string;
  readonly sections: readonly Readonly<{ label: string; text: string }>[];
  readonly footer: string;
}

export const cardDimensions = { width: 1080, height: 1350 } as const;

export function buildShareCard(game: SocietyGame, mode: ReadingMode, incidentId: string): ShareCard | null {
  const incident = projectNarrative(game, mode).incidents.find(({ id }) => id === incidentId);
  if (!incident) return null;
  const ref = incident.lawVersionRefs[0];
  const law = ref && game.book.versions.find((entry) => entry.lawId === ref.lawId && entry.version === ref.version);
  const official = law && authoritativeLaws(game.book, incident.turn).find(({ lawId }) => lawId === law.lawId);
  const current = law && authoritativeLaws(game.book, game.state.turn).find(({ lawId }) => lawId === law.lawId);
  const historical = !!law && (current?.version !== law.version || current.status !== 'active');
  const wording = law
    ? `${historical ? 'Historic version' : 'Version'} ${law.version}. ${renderLaw(law.ast)} ${official?.version === law.version
      ? `Status on day ${incident.turn} was ${official.status}.`
      : `This was a perceived version. The official status on day ${incident.turn} was ${official?.status ?? 'no operative version'}.`}`
    : 'No decree directly linked.';
  return {
    incidentId, narrativeVersion: incident.narrativeVersion, turn: incident.turn,
    heading: 'RULECRAFT — THE VILLAGE RECORD',
    sections: [
      { label: law ? 'MY DECREE' : 'VILLAGE REPORT', text: wording },
      { label: 'WHAT HAPPENED', text: `Day ${incident.turn}. ${incident.summary}` },
      { label: 'ADVISER VERDICT', text: `${advisers[incident.adviserId]}. ${incident.response}` },
    ],
    footer: 'Simulated village trial · Rulecraft',
  };
}

export function cardAsText(card: ShareCard): string {
  return [card.heading, ...card.sections.flatMap(({ label, text }) => [label, text]), card.footer].join('\n');
}

function wrap(context: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let row = '';
  for (const word of value.split(/\s+/)) {
    if (context.measureText(word).width > maxWidth) throw new Error('The card text does not fit.');
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

  const sizes = [44, 40, 36, 32];
  const layout = sizes.flatMap((size) => {
    context.font = `${size}px Georgia, serif`;
    try {
      const blocks = card.sections.map((section) => ({ ...section, lines: wrap(context, section.text, width - 64) }));
      const lineHeight = Math.ceil(size * 1.26);
      return [{ size, blocks, lineHeight, height: blocks.reduce((total, block) => total + 108 + lineHeight * block.lines.length, 0) }];
    } catch {
      return [];
    }
  }).find(({ height }) => height <= footer - header);
  if (!layout) throw new Error('There is too much text for this PNG.');

  context.fillStyle = '#f6efdf';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#842e25';
  context.fillRect(0, 0, canvas.width, 192);
  context.fillStyle = '#fffaf0';
  context.font = 'bold 49px Georgia, serif';
  const title = wrap(context, card.heading, width);
  title.forEach((line, index) => context.fillText(line, margin, 48 + index * 60));

  let y = header;
  for (const { label, lines } of layout.blocks) {
    const height = 88 + layout.lineHeight * lines.length;
    context.fillStyle = '#fffaf0';
    context.fillRect(margin, y, width, height);
    context.fillStyle = '#842e25';
    context.font = 'bold 28px system-ui, sans-serif';
    context.fillText(label, margin + 32, y + 24);
    context.fillStyle = '#302a20';
    context.font = `${layout.size}px Georgia, serif`;
    lines.forEach((line, index) => context.fillText(line, margin + 32, y + 65 + index * layout.lineHeight));
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
