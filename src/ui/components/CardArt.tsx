import type { Card, Suit } from '../../engine';

/**
 * Card face and back, drawn to match the cards in the Figma screens (white face, corner index,
 * classic pip layout; red back with a white lattice and star medallion). Figma's card artwork
 * could not be exported (Figma MCP quota), so this is an SVG recreation sized 86×132.
 */
const RED = '#cf1020';
const BLACK = '#141414';
const isRed = (s: Suit) => s === 'H' || s === 'D';

export function SuitShape({ suit, x, y, size, flip = false }: { suit: Suit; x: number; y: number; size: number; flip?: boolean }) {
  const fill = isRed(suit) ? RED : BLACK;
  const t = `translate(${x} ${y}) scale(${size / 20})${flip ? ' rotate(180 10 10)' : ''}`;
  switch (suit) {
    case 'H':
      return <path transform={t} fill={fill} d="M10 18.6C10 18.6 1 12.4 1 6.6 1 3.6 3.3 1.4 6 1.4c1.8 0 3.2 1 4 2.5.8-1.5 2.2-2.5 4-2.5 2.7 0 5 2.2 5 5.2 0 5.8-9 12-9 12Z" />;
    case 'D':
      return <path transform={t} fill={fill} d="M10 .8 17.6 10 10 19.2 2.4 10Z" />;
    case 'S':
      return <path transform={t} fill={fill} d="M10 1S1.2 7.8 1.2 12.3c0 2.6 2 4.4 4.4 4.4 1.6 0 3-.8 3.7-2.1-.3 1.9-1.1 3.4-2.8 4.4h7c-1.7-1-2.5-2.5-2.8-4.4.7 1.3 2.1 2.1 3.7 2.1 2.4 0 4.4-1.8 4.4-4.4C18.8 7.8 10 1 10 1Z" />;
    case 'C':
      return (
        <g transform={t} fill={fill}>
          <circle cx="10" cy="5.6" r="4.3" /><circle cx="4.9" cy="11.4" r="4.3" /><circle cx="15.1" cy="11.4" r="4.3" />
          <path d="M8.6 9.5h2.8l1.6 9.7H7Z" />
        </g>
      );
  }
}

const L = 27, M = 43, R = 59, T = 27, B = 105, C = 66;
const T3 = T + (B - T) / 3, B3 = T + (2 * (B - T)) / 3;
const PIPS: Record<string, [number, number][]> = {
  '2': [[M, T], [M, B]],
  '3': [[M, T], [M, C], [M, B]],
  '4': [[L, T], [R, T], [L, B], [R, B]],
  '5': [[L, T], [R, T], [M, C], [L, B], [R, B]],
  '6': [[L, T], [R, T], [L, C], [R, C], [L, B], [R, B]],
  '7': [[L, T], [R, T], [M, (T + C) / 2], [L, C], [R, C], [L, B], [R, B]],
  '8': [[L, T], [R, T], [M, (T + C) / 2], [L, C], [R, C], [M, (C + B) / 2], [L, B], [R, B]],
  '9': [[L, T], [R, T], [L, T3], [R, T3], [M, C], [L, B3], [R, B3], [L, B], [R, B]],
  '10': [[L, T], [R, T], [M, (T + T3) / 2], [L, T3], [R, T3], [L, B3], [R, B3], [M, (B3 + B) / 2], [L, B], [R, B]],
};

function Corner({ card, flip }: { card: Card; flip?: boolean }) {
  const fill = isRed(card.suit) ? RED : BLACK;
  return (
    <g transform={flip ? 'rotate(180 43 66)' : undefined}>
      <text x="8.5" y="19" textAnchor="middle" fontFamily="'Roboto Slab', Georgia, serif" fontWeight="700"
        fontSize={card.rank === '10' ? 13 : 15} letterSpacing={card.rank === '10' ? -1 : 0} fill={fill}>{card.rank}</text>
      <SuitShape suit={card.suit} x={3.5} y={23} size={10} />
    </g>
  );
}

export function CardFace({ card }: { card: Card }) {
  const fill = isRed(card.suit) ? RED : BLACK;
  const face = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  return (
    <svg viewBox="0 0 86 132" aria-label={`${card.rank}${card.suit}`}>
      <rect x="0.5" y="0.5" width="85" height="131" rx="6" fill="#fff" stroke="#d6d6d6" />
      <Corner card={card} />
      <Corner card={card} flip />
      {card.rank === 'A' && <SuitShape suit={card.suit} x={25} y={48} size={36} />}
      {face && (
        <g>
          <rect x="17" y="18" width="52" height="96" rx="3" fill={isRed(card.suit) ? '#fff4f2' : '#f4f6ff'} stroke={fill} strokeWidth="1.2" />
          <text x="43" y="74" textAnchor="middle" fontFamily="'Roboto Slab', Georgia, serif" fontWeight="700" fontSize="34" fill={fill}>{card.rank}</text>
          <SuitShape suit={card.suit} x={33} y={24} size={20} />
          <SuitShape suit={card.suit} x={33} y={88} size={20} flip />
        </g>
      )}
      {PIPS[card.rank]?.map(([x, y], i) => (
        <SuitShape key={i} suit={card.suit} x={x - 7.5} y={y - 7.5} size={15} flip={y > C + 1} />
      ))}
    </svg>
  );
}

export function CardBack() {
  return (
    <svg viewBox="0 0 86 132" aria-label="card back">
      <defs>
        <pattern id="lattice" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0H9M0 0V9" stroke="#f3c9c9" strokeWidth="0.7" opacity="0.55" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="86" height="132" rx="6" fill="#fff" />
      <rect x="5" y="5" width="76" height="122" rx="3" fill="#b8141f" />
      <rect x="5" y="5" width="76" height="122" rx="3" fill="url(#lattice)" />
      <rect x="8.5" y="8.5" width="69" height="115" rx="2" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.8" />
      <circle cx="43" cy="66" r="17" fill="#b8141f" stroke="#fff" strokeWidth="1.6" />
      <path d="M43 52l3 9 9-3-6 8 6 8-9-3-3 9-3-9-9 3 6-8-6-8 9 3z" fill="#fff" />
      <circle cx="43" cy="66" r="4" fill="#b8141f" />
    </svg>
  );
}
