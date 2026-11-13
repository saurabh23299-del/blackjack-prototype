import { cardValue } from './cards';
import type { Card, Hand } from './types';

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  const hard = cards.reduce((s, c) => s + cardValue(c.rank), 0);
  const hasAce = cards.some(c => c.rank === 'A');
  return hasAce && hard + 10 <= 21 ? { total: hard + 10, soft: true } : { total: hard, soft: false };
}

export const isBlackjack = (h: Hand) => !h.fromSplit && h.cards.length === 2 && handValue(h.cards).total === 21;
export const dealerBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

/**
 * Text for a hand-total bubble. Soft totals show both values ("7 / 17") while the hand
 * is still in play, and one number once it is hard or has ended (doc: UI states).
 */
export function totalLabel(cards: Card[], ended: boolean): string {
  if (cards.length === 0) return '';
  const { total, soft } = handValue(cards);
  if (soft && !ended && total !== 21) return `${total - 10} / ${total}`;
  return String(total);
}
