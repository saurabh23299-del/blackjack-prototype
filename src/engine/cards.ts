import type { Card, Rank, Suit } from './types';

export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export const cardValue = (r: Rank): number =>
  r === 'A' ? 1 : r === '10' || r === 'J' || r === 'Q' || r === 'K' ? 10 : Number(r);

/** Seedable RNG (mulberry32) so tests can replay a deal. */
export function seededRng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildShoe(decks: number, rng: () => number): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit });
  for (let i = shoe.length - 1; i > 0; i--) {           // Fisher–Yates
    const j = Math.floor(rng() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

/** "10H" → { rank: '10', suit: 'H' }. Handy for tests and scripted deals. */
export function parseCard(code: string): Card {
  const suit = code.slice(-1) as Suit;
  const rank = code.slice(0, -1) as Rank;
  if (!SUITS.includes(suit) || !RANKS.includes(rank)) throw new Error(`Bad card ${code}`);
  return { rank, suit };
}
