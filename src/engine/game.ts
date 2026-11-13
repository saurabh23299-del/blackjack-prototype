// Blackjack core gameplay loop — follows "Blackjack — Core Gameplay Loop.md" (reference code),
// plus an event log so the UI can animate each step. Framework-free, no UI.
// All state changes go through the exported action functions; the UI only reads state
// and calls can*() to decide which buttons are enabled.

import { buildShoe, cardValue } from './cards';
import { dealerBlackjack, handValue, isBlackjack } from './hand';
import { DEFAULT_RULES } from './rules';
import type { Card, GameState, Hand, HandResult, NewEvent, Rules } from './types';

export function createGame(opts: { balance: number; rules?: Partial<Rules>; rng?: () => number; shoe?: Card[] }): GameState {
  const rules = { ...DEFAULT_RULES, ...opts.rules };
  const rng = opts.rng ?? Math.random;
  return {
    rules, rng, shoe: opts.shoe ?? buildShoe(rules.deckCount, rng), next: 0,
    phase: 'BETTING', balance: opts.balance,
    hands: [], active: 0, dealer: [], holeRevealed: false,
    events: [], seq: 0,
  };
}

/** Shallow-enough copy for React: actions mutate the copy, never the previous state. */
export function cloneGame(s: GameState): GameState {
  return {
    ...s,
    hands: s.hands.map(h => ({ ...h, cards: [...h.cards] })),
    dealer: [...s.dealer],
    events: [...s.events],
  };
}

function emit(s: GameState, e: NewEvent) {
  s.events.push({ ...e, seq: ++s.seq, balance: s.balance } as GameState['events'][number]);
}

function draw(s: GameState): Card {
  if (s.next >= s.shoe.length) { s.shoe = buildShoe(s.rules.deckCount, s.rng); s.next = 0; } // safety net
  return s.shoe[s.next++];
}

function dealPlayer(s: GameState, hand: number) {
  const card = draw(s);
  s.hands[hand].cards.push(card);
  emit(s, { t: 'card', to: 'player', hand, card });
}

function dealDealer(s: GameState, hidden: boolean) {
  const card = draw(s);
  s.dealer.push(card);
  emit(s, { t: 'card', to: 'dealer', card, hidden });
}

// ---------- coins ----------
/** Coin rule: stakes are taken when placed, so Double and Split need the extra stake still in the balance. */
const covers = (s: GameState, extraStake: number) => s.balance >= extraStake;

/** Coins missing for a Double/Split on the active hand (0 when affordable). Used for the "Need $X more" hint. */
export function coinsShortForActive(s: GameState): number {
  const h = s.hands[s.active];
  return h ? Math.max(0, h.stake - s.balance) : 0;
}

// ---------- round start ----------
export function canBet(s: GameState, bet: number): boolean {
  return s.phase === 'BETTING' && bet >= s.rules.minBet && bet <= s.rules.maxBet && bet <= s.balance;
}

export function startRound(s: GameState, bet: number) {
  if (!canBet(s, bet)) throw new Error('Bet not allowed');
  if (s.next / s.shoe.length >= s.rules.reshuffleAt) { s.shoe = buildShoe(s.rules.deckCount, s.rng); s.next = 0; }
  s.events = [];
  s.balance -= bet;
  s.hands = [{ cards: [], stake: bet, doubled: false, fromSplit: false, splitAces: false, done: false }];
  s.dealer = []; s.active = 0; s.holeRevealed = false;
  emit(s, { t: 'round', bet });
  const h = s.hands[0];
  // Deal order: player, dealer up, player, dealer hole (face down).
  dealPlayer(s, 0); dealDealer(s, false); dealPlayer(s, 0); dealDealer(s, true);

  const up = s.dealer[0];
  const dealerCanHaveBJ = up.rank === 'A' || cardValue(up.rank) === 10;
  if (s.rules.dealerPeeks && dealerCanHaveBJ && dealerBlackjack(s.dealer)) {
    reveal(s); h.done = true; return settle(s);
  }
  if (isBlackjack(h)) { reveal(s); h.done = true; return settle(s); }
  s.phase = 'PLAYER_TURN';
  advance(s);
}

// ---------- player actions ----------
const activeHand = (s: GameState): Hand | undefined => s.hands[s.active];

export function canHit(s: GameState) {
  const h = activeHand(s);
  return s.phase === 'PLAYER_TURN' && !!h && !h.done && !h.doubled && !h.splitAces && handValue(h.cards).total < 21;
}
export function canStand(s: GameState) {
  const h = activeHand(s);
  return s.phase === 'PLAYER_TURN' && !!h && !h.done;
}
export function canDouble(s: GameState) {
  const h = activeHand(s);
  return canStand(s) && !!h && h.cards.length === 2 && !h.splitAces &&
    (!h.fromSplit || s.rules.doubleAfterSplit) && covers(s, h.stake);
}
/** Same as canDouble, ignoring coins — tells the UI whether a greyed Double is "only" a coin problem. */
export function doubleBlockedOnlyByCoins(s: GameState) {
  const h = activeHand(s);
  return canStand(s) && !!h && h.cards.length === 2 && !h.splitAces &&
    (!h.fromSplit || s.rules.doubleAfterSplit) && !covers(s, h.stake);
}
export function canSplit(s: GameState) {
  const h = activeHand(s);
  if (!canStand(s) || !h || h.cards.length !== 2 || s.hands.length >= s.rules.maxHands) return false;
  const [a, b] = h.cards;
  const pair = s.rules.splitBy === 'rank' ? a.rank === b.rank : cardValue(a.rank) === cardValue(b.rank);
  return pair && covers(s, h.stake);
}

export function hit(s: GameState) {
  if (!canHit(s)) throw new Error('Hit not allowed');
  const h = s.hands[s.active];
  dealPlayer(s, s.active);
  const t = handValue(h.cards).total;
  if (t > 21 || (t === 21 && s.rules.autoStandOn21)) h.done = true;
  advance(s);
}

export function stand(s: GameState) {
  if (!canStand(s)) throw new Error('Stand not allowed');
  s.hands[s.active].done = true;
  advance(s);
}

export function double(s: GameState) {
  if (!canDouble(s)) throw new Error('Double not allowed');
  const h = s.hands[s.active];
  s.balance -= h.stake;
  h.stake *= 2;
  h.doubled = true;
  emit(s, { t: 'double', hand: s.active });
  dealPlayer(s, s.active);
  h.done = true;
  advance(s);
}

export function split(s: GameState) {
  if (!canSplit(s)) throw new Error('Split not allowed');
  const h = s.hands[s.active];
  s.balance -= h.stake;
  const [first, second] = h.cards;
  const aces = first.rank === 'A';
  h.cards = [first]; h.fromSplit = true; h.splitAces = aces;
  const right: Hand = { cards: [second], stake: h.stake, doubled: false, fromSplit: true, splitAces: aces, done: false };
  s.hands.splice(s.active + 1, 0, right);
  emit(s, { t: 'split', hand: s.active });
  advance(s);
}

/** Moves play forward: deals the second card to split hands, skips finished hands, then hands over to the dealer. */
function advance(s: GameState) {
  while (s.active < s.hands.length) {
    const h = s.hands[s.active];
    if (!h.done && h.cards.length === 1) {               // split hand waiting for its second card
      dealPlayer(s, s.active);
      const t = handValue(h.cards).total;
      if (h.splitAces || (t === 21 && s.rules.autoStandOn21)) h.done = true;
    }
    if (!h.done) {
      s.phase = 'PLAYER_TURN';
      emit(s, { t: 'active', hand: s.active });
      return;                                             // wait for the player
    }
    s.active++;
  }
  dealerTurn(s);
}

// ---------- dealer ----------
function reveal(s: GameState) {
  if (!s.holeRevealed) { s.holeRevealed = true; emit(s, { t: 'reveal' }); }
}

function dealerTurn(s: GameState) {
  s.phase = 'DEALER_TURN';
  reveal(s);
  const allBust = s.hands.every(h => handValue(h.cards).total > 21);
  if (!allBust) {
    for (;;) {
      const v = handValue(s.dealer);
      const hitSoft17 = s.rules.dealerHitsSoft17 && v.total === 17 && v.soft;
      if (v.total < 17 || hitSoft17) dealDealer(s, false); else break;
    }
  }
  settle(s);
}

// ---------- settlement ----------
function settle(s: GameState) {
  const d = handValue(s.dealer);
  const dBJ = dealerBlackjack(s.dealer);

  for (const h of s.hands) {
    const v = handValue(h.cards).total;
    let result: HandResult;
    if (v > 21) result = 'lose';
    else if (isBlackjack(h)) result = dBJ ? 'push' : 'blackjack';
    else if (dBJ) result = 'lose';
    else if (d.total > 21 || v > d.total) result = 'win';
    else if (v === d.total) result = 'push';
    else result = 'lose';

    let net = 0;
    if (result === 'blackjack') {
      const raw = h.stake * s.rules.blackjackPayout;
      net = s.rules.blackjackRoundUp ? Math.ceil(raw) : Math.floor(raw);
      s.balance += h.stake + net;
    } else if (result === 'win') { net = h.stake; s.balance += 2 * h.stake; }
    else if (result === 'push') { s.balance += h.stake; }
    else { net = -h.stake; }
    h.result = result; h.coinsNet = net;
  }
  s.phase = 'ROUND_OVER';
  emit(s, { t: 'settle', results: s.hands.map(h => ({ result: h.result!, coinsNet: h.coinsNet!, stake: h.stake })) });
}

/** Call after the round-over screen to return to betting. */
export function nextRound(s: GameState) {
  s.phase = 'BETTING'; s.hands = []; s.dealer = []; s.holeRevealed = false; s.active = 0; s.events = [];
}

/** Prototype-only: free top-up when the player can no longer afford the minimum bet (no ads yet). */
export function topUp(s: GameState, to: number) {
  if (s.phase !== 'BETTING') throw new Error('Top-up only between rounds');
  s.balance = Math.max(s.balance, to);
}
