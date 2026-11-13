// Nerve points, Brave Hit and Fever — from "Blackjack — Gameplay Mechanics & Game Logic.md".
// This module wraps the core engine (src/engine) without changing it: core rules, payouts and
// actions stay exactly as they are; Fever's extra coin effects are applied on top after the core
// settles, and the stricter Fever coverage rule is checked before calling core actions.

import {
  canBet, canDouble, canSplit, doubleBlockedOnlyByCoins, double, handValue, hit, split, stand, startRound,
  type GameState, type HandResult,
} from '../engine';

export const PROGRESS_RULES = {
  feverUnlockAt: 300,          // Nerve points
  feverMeterSize: 50,
  feverRounds: 3,
  points: { blackjack: 20, win: 10, winDoubled: 20, push: 2, lose: 0 },
  braveBonus: [0, 2, 5, 10],   // by tier: 1 = hit on hard 14–15, 2 = 16–17, 3 = 18+
  splitSweepBonus: 5,
};

export interface Progress {
  nerveTotal: number;
  fever: { unlocked: boolean; meter: number; roundsLeft: number };
}

/** Per-round bookkeeping the core engine doesn't keep. */
export interface RoundTrack {
  feverRound: boolean;
  roundStartBalance: number;
  braveTiers: number[];         // parallel to GameState.hands
  result: RoundAwards | null;   // set exactly once, when the round settles
}

export type AwardKind = 'blackjack' | 'win' | 'winDoubled' | 'push' | 'brave' | 'sweep';
export interface Award { kind: AwardKind; hand: number; points: number; tier?: number }

export interface RoundAwards {
  awards: Award[];              // every non-zero award, in display order
  total: number;
  feverRound: boolean;
  fillsMeter: boolean;          // points also went into the Fever meter
  unlockedNow: boolean;
  feverNet: number[];           // per-hand net coins after Fever doubling
  progressBefore: Progress;
  progressAfter: Progress;
}

export const createProgress = (nerveTotal = 0): Progress => ({
  nerveTotal, fever: { unlocked: nerveTotal >= PROGRESS_RULES.feverUnlockAt, meter: 0, roundsLeft: 0 },
});
export const cloneProgress = (p: Progress): Progress => ({ nerveTotal: p.nerveTotal, fever: { ...p.fever } });
export const cloneTrack = (t: RoundTrack | null): RoundTrack | null => (t ? { ...t, braveTiers: [...t.braveTiers] } : null);

/** k = 2 during Fever (losses are doubled), 1 otherwise. */
const lossFactor = (p: Progress) => (p.fever.roundsLeft > 0 ? 2 : 1);
const committed = (s: GameState) => s.hands.reduce((sum, h) => sum + h.stake, 0);

// ---------- coins ----------
/** Coverage rule: round-start balance must cover every committed stake (after the action) × k. */
function covers(s: GameState, t: RoundTrack, extraStake: number) {
  return t.roundStartBalance >= (committed(s) + extraStake) * (t.feverRound ? 2 : 1);
}

export function canBetP(s: GameState, p: Progress, bet: number) {
  return canBet(s, bet) && bet * lossFactor(p) <= s.balance;
}

export type CoinsNeeded = 'none' | 'normal' | 'fever';
export function coinsNeeded(s: GameState, p: Progress): CoinsNeeded {
  if (p.fever.roundsLeft > 0) return s.balance < 2 * s.rules.minBet ? 'fever' : 'none';
  return s.balance < s.rules.minBet ? 'normal' : 'none';
}
/** Skipping the ad while Fever is paused ends Fever. */
export function skipFeverAd(p: Progress) { p.fever.roundsLeft = 0; }

// ---------- round flow ----------
export function startRoundP(s: GameState, p: Progress, bet: number): RoundTrack {
  if (!canBetP(s, p, bet)) throw new Error('Bet not allowed');
  const t: RoundTrack = { feverRound: p.fever.roundsLeft > 0, roundStartBalance: s.balance, braveTiers: [0], result: null };
  startRound(s, bet);
  settleIfOver(s, p, t);
  return t;
}

export function canDoubleP(s: GameState, t: RoundTrack | null) {
  const h = s.hands[s.active];
  return !!t && !!h && canDouble(s) && covers(s, t, h.stake);
}
export function canSplitP(s: GameState, t: RoundTrack | null) {
  const h = s.hands[s.active];
  return !!t && !!h && canSplit(s) && covers(s, t, h.stake);
}
/** Coins missing to double the active hand (0 if it's allowed or blocked for a non-coin reason). */
export function doubleShortP(s: GameState, t: RoundTrack | null): number {
  const h = s.hands[s.active];
  if (!t || !h) return 0;
  const shapeOk = canDouble(s) || doubleBlockedOnlyByCoins(s);
  if (!shapeOk || canDoubleP(s, t)) return 0;
  return Math.max(1, (committed(s) + h.stake) * (t.feverRound ? 2 : 1) - t.roundStartBalance);
}

/** Brave-hit tracking: before a card is dealt to a hard 14+ hand, record the highest risk tier. */
export function braveTierFor(cards: GameState['hands'][number]['cards']): number {
  const v = handValue(cards);
  if (v.soft || v.total < 14) return 0;
  return v.total >= 18 ? 3 : v.total >= 16 ? 2 : 1;
}
function recordBrave(s: GameState, t: RoundTrack) {
  const tier = braveTierFor(s.hands[s.active].cards);
  if (tier > (t.braveTiers[s.active] ?? 0)) t.braveTiers[s.active] = tier;
}

export function hitP(s: GameState, p: Progress, t: RoundTrack) {
  recordBrave(s, t);
  hit(s);
  settleIfOver(s, p, t);
}
export function standP(s: GameState, p: Progress, t: RoundTrack) {
  stand(s);
  settleIfOver(s, p, t);
}
export function doubleP(s: GameState, p: Progress, t: RoundTrack) {
  if (!canDoubleP(s, t)) throw new Error('Double not allowed');
  recordBrave(s, t);                 // the double card counts as a hit (doc default)
  double(s);
  settleIfOver(s, p, t);
}
export function splitP(s: GameState, p: Progress, t: RoundTrack) {
  if (!canSplitP(s, t)) throw new Error('Split not allowed');
  t.braveTiers.splice(s.active + 1, 0, 0);
  split(s);
  settleIfOver(s, p, t);
}

// ---------- settlement: points, Fever coins, meter ----------
function handPoints(result: HandResult, doubled: boolean, tier: number): { base: number; kind: AwardKind | null; brave: number } {
  const P = PROGRESS_RULES.points;
  if (result === 'blackjack') return { base: P.blackjack, kind: 'blackjack', brave: 0 };
  if (result === 'win') return { base: doubled ? P.winDoubled : P.win, kind: doubled ? 'winDoubled' : 'win', brave: PROGRESS_RULES.braveBonus[tier] };
  if (result === 'push') return { base: P.push, kind: 'push', brave: 0 };
  return { base: P.lose, kind: null, brave: 0 };
}

/** Runs once per round, right after the core engine settles. */
function settleIfOver(s: GameState, p: Progress, t: RoundTrack) {
  if (s.phase !== 'ROUND_OVER' || t.result) return;
  const before = cloneProgress(p);
  const awards: Award[] = [];
  const feverNet: number[] = [];

  s.hands.forEach((h, i) => {
    const { base, kind, brave } = handPoints(h.result!, h.doubled, t.braveTiers[i] ?? 0);
    if (kind && base > 0) awards.push({ kind, hand: i, points: base });
    if (brave > 0) awards.push({ kind: 'brave', hand: i, points: brave, tier: t.braveTiers[i] });
    // Fever: net wins doubled (Blackjack rounded up first by the core), losses take a second stake.
    const net = h.coinsNet ?? 0;
    if (t.feverRound) s.balance += net;
    feverNet.push(t.feverRound ? net * 2 : net);
  });
  if (s.hands.length > 1 && s.hands.every(h => h.result === 'win')) {
    awards.push({ kind: 'sweep', hand: -1, points: PROGRESS_RULES.splitSweepBonus });
  }
  const total = awards.reduce((sum, a) => sum + a.points, 0);

  const wasUnlocked = p.fever.unlocked;
  p.nerveTotal += total;
  const fillsMeter = wasUnlocked && !t.feverRound;
  if (fillsMeter) p.fever.meter += total;
  const unlockedNow = !p.fever.unlocked && p.nerveTotal >= PROGRESS_RULES.feverUnlockAt;
  if (unlockedNow) p.fever.unlocked = true;
  if (t.feverRound) p.fever.roundsLeft--;

  t.result = { awards, total, feverRound: t.feverRound, fillsMeter, unlockedNow, feverNet, progressBefore: before, progressAfter: cloneProgress(p) };
}

// ---------- Fever activation ----------
export const feverReady = (s: GameState, p: Progress) =>
  s.phase !== 'PLAYER_TURN' && p.fever.unlocked && p.fever.roundsLeft === 0 && p.fever.meter >= PROGRESS_RULES.feverMeterSize;

export function activateFever(s: GameState, p: Progress) {
  if (!feverReady(s, p)) return;
  p.fever.meter -= PROGRESS_RULES.feverMeterSize;    // overflow carries into the next meter
  p.fever.roundsLeft = PROGRESS_RULES.feverRounds;
}
export function declineFever(s: GameState, p: Progress) {
  if (feverReady(s, p)) p.fever.meter = 0;
}

/** Spending XP on unlocks is the only thing that lowers nerveTotal. Fever stays unlocked. */
export function spendXP(p: Progress, cost: number): boolean {
  if (p.nerveTotal < cost) return false;
  p.nerveTotal -= cost;
  return true;
}
