export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card { rank: Rank; suit: Suit }

export interface Rules {
  deckCount: number;
  reshuffleAt: number;          // share of the shoe dealt before a reshuffle (0.75)
  dealerHitsSoft17: boolean;
  dealerPeeks: boolean;
  blackjackPayout: number;      // 1.5 = 3:2
  blackjackRoundUp: boolean;
  doubleAfterSplit: boolean;
  splitBy: 'rank' | 'value';
  maxHands: number;
  autoStandOn21: boolean;
  minBet: number;
  maxBet: number;
}

export type Phase = 'BETTING' | 'PLAYER_TURN' | 'DEALER_TURN' | 'ROUND_OVER';
export type HandResult = 'blackjack' | 'win' | 'push' | 'lose';

export interface Hand {
  cards: Card[];
  stake: number;
  doubled: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  done: boolean;
  result?: HandResult;
  coinsNet?: number;
}

/**
 * Everything the engine does in a round is also appended to `events`, in order.
 * The UI replays these one by one to animate; the engine itself never waits.
 * Every event carries the balance right after it happened.
 */
export type GameEvent =
  | { seq: number; t: 'round'; bet: number; balance: number }
  | { seq: number; t: 'card'; to: 'player'; hand: number; card: Card; balance: number }
  | { seq: number; t: 'card'; to: 'dealer'; card: Card; hidden: boolean; balance: number }
  | { seq: number; t: 'split'; hand: number; balance: number }
  | { seq: number; t: 'double'; hand: number; balance: number }
  | { seq: number; t: 'active'; hand: number; balance: number }
  | { seq: number; t: 'reveal'; balance: number }
  | { seq: number; t: 'settle'; results: { result: HandResult; coinsNet: number; stake: number }[]; balance: number };

/** Distributes Omit over the GameEvent union so each variant keeps its own fields. */
export type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'seq' | 'balance'> : never) : never;

export interface GameState {
  rules: Rules;
  rng: () => number;
  shoe: Card[];
  next: number;                 // index of the next card to deal
  phase: Phase;
  balance: number;
  hands: Hand[];
  active: number;
  dealer: Card[];
  holeRevealed: boolean;
  events: GameEvent[];
  seq: number;
}
