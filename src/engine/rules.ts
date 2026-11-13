import type { Rules } from './types';

/**
 * Rule defaults from "Blackjack — Core Gameplay Loop.md", with the overrides agreed in chat:
 * - deckCount 4 (doc default is 6)
 * - minBet 5 so the $5 chip can be bet on its own (doc default is 10)
 * Everything marked "to confirm" in the doc keeps the doc's default and stays configurable here.
 */
export const DEFAULT_RULES: Rules = {
  deckCount: 4,
  reshuffleAt: 0.75,
  dealerHitsSoft17: false,      // doc: stand on all 17s (to confirm)
  dealerPeeks: true,
  blackjackPayout: 1.5,         // 3:2, as printed on the felt
  blackjackRoundUp: true,       // doc: a 15 bet pays 23 (to confirm)
  doubleAfterSplit: true,       // doc default (to confirm)
  splitBy: 'rank',              // doc: 8–8 splits, K–Q does not (to confirm)
  maxHands: 4,
  autoStandOn21: true,
  minBet: 5,
  maxBet: 500,                  // doc placeholder (to confirm)
};

/** Prototype settings that are not Blackjack rules. */
export const START_BALANCE = 2000;
/** Agreed in chat: start fresh on every load. Flip to true to keep the balance in localStorage. */
export const PERSIST_BALANCE = false;
export const CHIP_VALUES = [5, 15, 25, 50] as const;
