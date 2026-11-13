# Blackjack — Gameplay Mechanics & Game Logic

Nov 13, 2026 · @Saurabh

This spec defines the Blackjack rules and round logic for the prototype: one player against the dealer, betting in coins. Every rule choice lives in one config object, so a rule can change without touching the logic.

## Rules at a glance

Defaults follow standard casino rules; the ones marked "to confirm" are listed in Open questions.

| Setting | Default | Notes |
| --- | --- | --- |
| `deckCount` | 6 | Cards dealt from a 6-deck shoe (312 cards) |
| `reshuffleAt` | 75% dealt | Shoe is rebuilt and shuffled before the next round once 75% is used |
| `dealerHitsSoft17` | false | Dealer stands on all 17s (to confirm) |
| `dealerPeeks` | true | Dealer checks for Blackjack when showing an Ace or a 10-value card |
| `blackjackPays` | 3:2 | As printed on the table felt |
| `blackjackRounding` | round up | A 15-coin bet pays 23, not 22.5 (to confirm) |
| `doubleOn` | any first two cards | Not limited to 9–11 (to confirm) |
| `doubleAfterSplit` | true | (to confirm) |
| `splitBy` | same rank | 8–8 splits, K–Q does not (to confirm) |
| `maxHands` | 4 | Up to 3 splits in one round |
| `splitAces` | one card each, no more actions | A split Ace + 10 counts as 21, not Blackjack |
| `resplitAces` | false |  |
| `autoStandOn21` | true | A hand that reaches 21 ends without a Stand tap |
| `insurance`, `surrender` | off | No buttons for them in the UI |
| `minBet` / `maxBet` | 10 / 500 coins | Placeholders (to confirm) |

## Cards, shoe and hand values

**Card values**

| Rank | Value |
| --- | --- |
| 2–9 | Face value |
| 10, J, Q, K | 10 |
| A | 1 or 11, whichever is better without going over 21 |

**Shoe**

- Build `deckCount` standard 52-card decks and shuffle with Fisher–Yates.
- Use a seedable random number generator, so a test can replay an exact deal.
- Before each round, if the share of cards dealt is at or above `reshuffleAt`, rebuild and reshuffle. Never reshuffle mid-round.

**Hand total**

1. Add up all cards, counting every Ace as 1. Call this the hard total.
2. If the hand has at least one Ace and hard total + 10 is 21 or less, the total is hard total + 10 and the hand is **soft**.
3. Otherwise the total is the hard total and the hand is **hard**.

Examples: A + 6 = soft 17. A + 6 + 9 = hard 16. A + A + 9 = soft 21.

**Hand states**

- **Blackjack:** exactly two cards totalling 21 on the initial deal (Ace + 10-value). A split hand never counts as Blackjack.
- **Bust:** total above 21. A busted hand loses immediately, even if the dealer later busts too.
- **21:** total of exactly 21 with three or more cards, or on a split hand. It ends the hand when `autoStandOn21` is on.

## Round flow

&#91;embedded content: round state machine · 6 states, 1 check\]

The player turn repeats on each hand until every hand is finished; the dealer skips drawing if every player hand busted. In code these are the phases `BETTING`, `PLAYER_TURN`, `DEALER_TURN` and `ROUND_OVER`; dealing and settling happen inside the transitions.

## Player actions

The player acts on one **active hand** at a time. After a split there can be up to 4 hands; they are played left to right, and the dealer only plays once every hand is finished.

**Coin coverage rule** (applies to Double and Split). Stakes are taken from the balance when placed. An action that adds a stake is allowed only if the balance at the start of the round covers every stake committed after the action, times `k`, where `k` = 2 during Fever (losses are doubled) and 1 otherwise. Example: 10-coin bet, normal play → Double needs 20 coins at round start; in Fever it needs 40.

### Hit

- **Allowed when:** the hand is active, total is below 21, it was not doubled, and it is not a split-Ace hand.
- **Does:** deals one card to the hand and recomputes the total.
  - Over 21 → **bust**: the hand ends and is lost.
  - Exactly 21 → the hand ends (auto-stand).
  - Otherwise → the hand stays active.
- **Brave-hit tracking:** before dealing, if the hand is **hard** and its total is 14 or more, record the risk tier on the hand (14–15 medium, 16–17 high, 18+ extreme), keeping the highest tier reached.

### Stand

- **Allowed when:** the hand is active.
- **Does:** ends the hand at its current total and moves to the next hand, or to the dealer's turn if it was the last.

### Double

- **Allowed when:** the hand has exactly two cards, it is not a split-Ace hand, it is not a split hand unless `doubleAfterSplit` is on, and the coverage rule passes.
- **Does:** takes a second stake equal to the hand's bet (the hand's stake doubles), deals **exactly one** card, then ends the hand, whether or not it busted.
- **Brave-hit tracking:** the one card counts as a hit, so the same tier rule applies (to confirm).

### Split

- **Allowed when:** the hand has exactly two cards of the same rank, the round has fewer than `maxHands` hands, Aces have not already been split (unless `resplitAces`), and the coverage rule passes.
- **Does:**
  1. Turns the hand into two hands of one card each, the new one placed to the right, with a stake equal to the original bet.
  2. Deals a second card to the left hand, which becomes active.
  3. When a hand ends, deals the second card to the next split hand and makes it active.
- **Split Aces:** each Ace gets exactly one card and the hand ends immediately; no Hit, Double or further split.
- A split hand that reaches 21 with two cards is a normal 21, paid 1:1, not a Blackjack.

## Dealer turn

**Deal order:** player card, dealer up card, player card, dealer hole card (face down).

**Peek** (right after the deal, before the player can act):

- If the dealer's up card is an Ace or a 10-value card, check the hole card for Blackjack.
- Dealer has Blackjack → reveal it. Player Blackjack → push; anything else → the player loses the original bet. The round ends.
- Otherwise, if the player has Blackjack → it is paid 3:2 at once and the round ends without the dealer drawing.

**Drawing** (after every player hand has ended):

1. Reveal the hole card.
2. If every player hand is bust, stop: the dealer does not draw.
3. Otherwise draw cards while the dealer total is below 17. With `dealerHitsSoft17` on, also draw on soft 17.
4. The dealer has no choices; these rules are fixed.

## Settlement and payouts

Each hand settles on its own against the dealer, in this order: player bust → lose; Blackjack (already settled at the peek); dealer bust → win; higher total wins; equal totals → push.

`S` = the hand's stake (doubled if the player doubled). The stake was already taken from the balance, so the table shows what goes back and the net change.

| Outcome | Returned to balance | Net change | Net in Fever | Bet 15, normal / Fever |
| --- | --- | --- | --- | --- |
| Blackjack | S + round up(1.5 × S) | +1.5 × S | +3 × S | +23 / +46 |
| Win | 2 × S | +S | +2 × S | +15 / +30 |
| Push | S | 0 | 0 | 0 / 0 |
| Lose or bust | 0 | −S | −2 × S (another S is taken) | −15 / −30 |

- In Fever the net win is doubled (round up the Blackjack part first, then double).
- The coverage rule guarantees the extra Fever loss can always be paid, so the balance never goes below 0.
- After settlement, if the balance is below `minBet` (or below 2 × `minBet` during Fever), show the out-of-coins sheet from the ad strategy doc.

## Nerve points and Fever hooks

Points are scored per hand at settlement, using the table in Blackjack — Habit Loop & Meta-Progression.

| Hand result | Nerve points |
| --- | --- |
| Blackjack | 20 |
| Win | 10 |
| Win after doubling down | 20 |
| Push | 2 |
| Lose or bust | 0 |
| Brave-hit bonus (winning hands only) | +2 / +5 / +10 for the highest tier recorded |
| Split sweep: every split hand wins | +5 on top of the hands' points, so two winning split hands = 25 |

**Fever logic**

- `nerveTotal` only goes up from play; spending XP on unlocks is the only thing that lowers it.
- `feverUnlocked` becomes true the first time `nerveTotal` reaches 300 and never turns false.
- After the unlock, points earned outside Fever also fill `feverMeter` (cap 50). Points earned during Fever do not.
- When `feverMeter` reaches 50, show **Activate / Not right now** between rounds. Not right now → meter = 0. Activate → `feverRoundsLeft` = 3 and the meter keeps only the overflow above 50.
- One Fever hand = one round, including every hand created by splits.
- If the balance drops below 2 × `minBet` mid-Fever, Fever pauses until the player watches an ad; skipping the ad ends Fever (`feverRoundsLeft` = 0).

## UI states

**Action buttons** are only tappable during the player's turn, and each follows its own rule:

| Button | Enabled when | Otherwise |
| --- | --- | --- |
| Hit | Active hand below 21, not doubled, not split Aces | Greyed out |
| Stand | A hand is active | Greyed out |
| Double | First two cards, coverage rule passes, Double-after-split rules allow it | Greyed out, with a reason if it is coins ("Need 30 coins to double") |
| Split | Two cards of the same rank, fewer than 4 hands, coverage rule passes | Greyed out |

During dealing, the dealer's turn and settlement, all four buttons are disabled so a fast tap can't act twice.

**Hand totals** (the bubbles beside the cards)

- Dealer bubble shows only the up card's value until the hole card is revealed, as in the screenshot (10).
- Show soft totals as both values, e.g. "7 / 17" for A + 6, and switch to one number once the hand is hard or has ended.
- With split hands, each hand gets its own bubble; the active hand is highlighted.

**Checked against the screenshot**

- The player holds 10 + 6, which is not a pair, so **Split should be greyed out** there.
- The bet shows as "$15" while the balance is in coins (990). Use one currency throughout; coins fit the rest of the design.

## Reference code

A framework-free TypeScript module, tested against the scenarios in this spec (Blackjack payouts, peek, bust, double, split 8s and Aces, coverage, soft 17, Fever unlock, meter, doubled wins and losses) plus 3,000 random games with Fever on. The UI only reads `GameState` and calls `canHit` / `canStand` / `canDouble` / `canSplit` to enable buttons; every change goes through `startRound`, `hit`, `stand`, `double`, `split`, `nextRound` and the Fever functions.

```ts
// Blackjack core logic — reference implementation (framework-free, no UI).
// All state changes go through the exported action functions; the UI only reads state
// and calls can*() to decide which buttons are enabled.

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
  feverUnlockAt: number;        // 300 Nerve points
  feverMeterSize: number;       // 50
  feverRounds: number;          // 3
}

export const DEFAULT_RULES: Rules = {
  deckCount: 6, reshuffleAt: 0.75, dealerHitsSoft17: false, dealerPeeks: true,
  blackjackPayout: 1.5, blackjackRoundUp: true, doubleAfterSplit: true, splitBy: 'rank',
  maxHands: 4, autoStandOn21: true, minBet: 10, maxBet: 500,
  feverUnlockAt: 300, feverMeterSize: 50, feverRounds: 3,
};

export type Phase = 'BETTING' | 'PLAYER_TURN' | 'DEALER_TURN' | 'ROUND_OVER';
export type HandResult = 'blackjack' | 'win' | 'push' | 'lose';

export interface Hand {
  cards: Card[];
  stake: number;
  doubled: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  done: boolean;
  braveTier: 0 | 1 | 2 | 3;     // 1 = hit on hard 14–15, 2 = 16–17, 3 = 18+
  result?: HandResult;
  coinsNet?: number;
  points?: number;
}

export interface GameState {
  rules: Rules;
  rng: () => number;
  shoe: Card[];
  next: number;                 // index of the next card to deal
  phase: Phase;
  balance: number;
  roundStartBalance: number;
  hands: Hand[];
  active: number;
  dealer: Card[];
  holeRevealed: boolean;
  nerveTotal: number;
  fever: { unlocked: boolean; meter: number; roundsLeft: number; thisRound: boolean };
}

// ---------- cards and values ----------
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export const cardValue = (r: Rank): number => (r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(r) ? 10 : Number(r));

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  const hard = cards.reduce((s, c) => s + cardValue(c.rank), 0);
  const hasAce = cards.some(c => c.rank === 'A');
  return hasAce && hard + 10 <= 21 ? { total: hard + 10, soft: true } : { total: hard, soft: false };
}

export const isBlackjack = (h: Hand) => !h.fromSplit && h.cards.length === 2 && handValue(h.cards).total === 21;
const dealerBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

// Seedable RNG (mulberry32) so tests can replay a deal.
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

export function createGame(opts: { balance: number; rules?: Partial<Rules>; rng?: () => number; shoe?: Card[] }): GameState {
  const rules = { ...DEFAULT_RULES, ...opts.rules };
  const rng = opts.rng ?? Math.random;
  return {
    rules, rng, shoe: opts.shoe ?? buildShoe(rules.deckCount, rng), next: 0,
    phase: 'BETTING', balance: opts.balance, roundStartBalance: opts.balance,
    hands: [], active: 0, dealer: [], holeRevealed: false, nerveTotal: 0,
    fever: { unlocked: false, meter: 0, roundsLeft: 0, thisRound: false },
  };
}

function draw(s: GameState): Card {
  if (s.next >= s.shoe.length) { s.shoe = buildShoe(s.rules.deckCount, s.rng); s.next = 0; } // safety net
  return s.shoe[s.next++];
}

// ---------- coins ----------
const lossFactor = (s: GameState) => (s.fever.thisRound ? 2 : 1);
const committed = (s: GameState) => s.hands.reduce((sum, h) => sum + h.stake, 0);
/** Coverage rule: round-start balance must cover every committed stake × k (k = 2 in Fever). */
const covers = (s: GameState, extraStake: number) =>
  s.roundStartBalance >= (committed(s) + extraStake) * lossFactor(s);

export type CoinsNeeded = 'none' | 'normal' | 'fever';
export function coinsNeeded(s: GameState): CoinsNeeded {
  if (s.fever.roundsLeft > 0) return s.balance < 2 * s.rules.minBet ? 'fever' : 'none';
  return s.balance < s.rules.minBet ? 'normal' : 'none';
}
export function grantCoins(s: GameState, amount: number) { s.balance += amount; } // ad reward or purchase
export function skipFeverAd(s: GameState) { s.fever.roundsLeft = 0; }           // Fever round ends

// ---------- round start ----------
export function canBet(s: GameState, bet: number): boolean {
  const k = s.fever.roundsLeft > 0 ? 2 : 1;
  return s.phase === 'BETTING' && bet >= s.rules.minBet && bet <= s.rules.maxBet && bet * k <= s.balance;
}

export function startRound(s: GameState, bet: number) {
  if (!canBet(s, bet)) throw new Error('Bet not allowed');
  if (s.next / s.shoe.length >= s.rules.reshuffleAt) { s.shoe = buildShoe(s.rules.deckCount, s.rng); s.next = 0; }
  s.fever.thisRound = s.fever.roundsLeft > 0;
  s.roundStartBalance = s.balance;
  s.balance -= bet;
  s.hands = [{ cards: [], stake: bet, doubled: false, fromSplit: false, splitAces: false, done: false, braveTier: 0 }];
  s.dealer = []; s.active = 0; s.holeRevealed = false;
  const h = s.hands[0];
  h.cards.push(draw(s)); s.dealer.push(draw(s)); h.cards.push(draw(s)); s.dealer.push(draw(s));

  const up = s.dealer[0];
  const dealerCanHaveBJ = up.rank === 'A' || cardValue(up.rank) === 10;
  if (s.rules.dealerPeeks && dealerCanHaveBJ && dealerBlackjack(s.dealer)) {
    s.holeRevealed = true; h.done = true; return settle(s);
  }
  if (isBlackjack(h)) { s.holeRevealed = true; h.done = true; return settle(s); }
  s.phase = 'PLAYER_TURN';
  advance(s);
}

// ---------- player actions ----------
const activeHand = (s: GameState) => s.hands[s.active];

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
  return canStand(s) && h.cards.length === 2 && !h.splitAces &&
    (!h.fromSplit || s.rules.doubleAfterSplit) && covers(s, h.stake);
}
export function canSplit(s: GameState) {
  const h = activeHand(s);
  if (!canStand(s) || h.cards.length !== 2 || s.hands.length >= s.rules.maxHands) return false;
  const [a, b] = h.cards;
  const pair = s.rules.splitBy === 'rank' ? a.rank === b.rank : cardValue(a.rank) === cardValue(b.rank);
  return pair && covers(s, h.stake);
}

function recordBrave(h: Hand) {
  const v = handValue(h.cards);
  if (v.soft || v.total < 14) return;
  const tier = v.total >= 18 ? 3 : v.total >= 16 ? 2 : 1;
  if (tier > h.braveTier) h.braveTier = tier as Hand['braveTier'];
}

export function hit(s: GameState) {
  if (!canHit(s)) throw new Error('Hit not allowed');
  const h = activeHand(s);
  recordBrave(h);
  h.cards.push(draw(s));
  const t = handValue(h.cards).total;
  if (t > 21 || (t === 21 && s.rules.autoStandOn21)) h.done = true;
  advance(s);
}

export function stand(s: GameState) {
  if (!canStand(s)) throw new Error('Stand not allowed');
  activeHand(s).done = true;
  advance(s);
}

export function double(s: GameState) {
  if (!canDouble(s)) throw new Error('Double not allowed');
  const h = activeHand(s);
  s.balance -= h.stake;
  h.stake *= 2;
  h.doubled = true;
  recordBrave(h);                 // the double card counts as a hit (to confirm)
  h.cards.push(draw(s));
  h.done = true;
  advance(s);
}

export function split(s: GameState) {
  if (!canSplit(s)) throw new Error('Split not allowed');
  const h = activeHand(s);
  s.balance -= h.stake;
  const [first, second] = h.cards;
  const aces = first.rank === 'A';
  h.cards = [first]; h.fromSplit = true; h.splitAces = aces;
  const right: Hand = { cards: [second], stake: h.stake, doubled: false, fromSplit: true, splitAces: aces, done: false, braveTier: 0 };
  s.hands.splice(s.active + 1, 0, right);
  advance(s);
}

/** Moves play forward: deals the second card to split hands, skips finished hands, then hands over to the dealer. */
function advance(s: GameState) {
  while (s.active < s.hands.length) {
    const h = s.hands[s.active];
    if (!h.done && h.cards.length === 1) {               // split hand waiting for its second card
      h.cards.push(draw(s));
      const t = handValue(h.cards).total;
      if (h.splitAces || (t === 21 && s.rules.autoStandOn21)) h.done = true;
    }
    if (!h.done) { s.phase = 'PLAYER_TURN'; return; }   // wait for the player
    s.active++;
  }
  dealerTurn(s);
}

// ---------- dealer ----------
function dealerTurn(s: GameState) {
  s.phase = 'DEALER_TURN';
  s.holeRevealed = true;
  const allBust = s.hands.every(h => handValue(h.cards).total > 21);
  if (!allBust) {
    for (;;) {
      const v = handValue(s.dealer);
      const hitSoft17 = s.rules.dealerHitsSoft17 && v.total === 17 && v.soft;
      if (v.total < 17 || hitSoft17) s.dealer.push(draw(s)); else break;
    }
  }
  settle(s);
}

// ---------- settlement, points, Fever ----------
const BRAVE_BONUS = [0, 2, 5, 10];

function settle(s: GameState) {
  const d = handValue(s.dealer);
  const dBJ = dealerBlackjack(s.dealer);
  const k = lossFactor(s);
  let roundPoints = 0;

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
      net = (s.rules.blackjackRoundUp ? Math.ceil(raw) : Math.floor(raw)) * k;
      s.balance += h.stake + net;
    } else if (result === 'win') { net = h.stake * k; s.balance += h.stake + net; }
    else if (result === 'push') { s.balance += h.stake; }
    else { net = -h.stake * k; if (k === 2) s.balance -= h.stake; }   // Fever takes a second stake

    let pts = 0;
    if (result === 'blackjack') pts = 20;
    else if (result === 'win') pts = (h.doubled ? 20 : 10) + BRAVE_BONUS[h.braveTier];
    else if (result === 'push') pts = 2;
    h.result = result; h.coinsNet = net; h.points = pts;
    roundPoints += pts;
  }
  if (s.hands.length > 1 && s.hands.every(h => h.result === 'win')) roundPoints += 5;   // split sweep

  const wasUnlocked = s.fever.unlocked;
  s.nerveTotal += roundPoints;
  if (wasUnlocked && !s.fever.thisRound) s.fever.meter += roundPoints;
  if (!s.fever.unlocked && s.nerveTotal >= s.rules.feverUnlockAt) s.fever.unlocked = true;
  if (s.fever.thisRound) s.fever.roundsLeft--;

  s.phase = 'ROUND_OVER';
}

/** Call after the round-over screen to return to betting. */
export function nextRound(s: GameState) { s.phase = 'BETTING'; s.hands = []; s.dealer = []; s.holeRevealed = false; }

export const feverReady = (s: GameState) =>
  s.phase !== 'PLAYER_TURN' && s.fever.unlocked && s.fever.roundsLeft === 0 && s.fever.meter >= s.rules.feverMeterSize;
export function activateFever(s: GameState) {
  if (!feverReady(s)) return;
  s.fever.meter -= s.rules.feverMeterSize;   // overflow carries into the next meter
  s.fever.roundsLeft = s.rules.feverRounds;
}
export function declineFever(s: GameState) { if (feverReady(s)) s.fever.meter = 0; }

/** Spending XP on unlocks is the only thing that lowers nerveTotal. Fever stays unlocked. */
export function spendXP(s: GameState, cost: number): boolean {
  if (s.nerveTotal < cost) return false;
  s.nerveTotal -= cost;
  return true;
}
```

## Open questions

Each has a default already built into the spec and code; confirm or change.

- [ ] **Currency:** the screenshot shows the bet as "$15" but the balance in coins. Coins everywhere? (Default: coins.)
- [ ] **Bets:** minimum, maximum and chip values? (Default: 10 to 500 coins.)
- [ ] **Blackjack on odd bets:** 3:2 on 15 is 22.5. Round up, round down, or only allow even bets? (Default: round up to 23.)
- [ ] **Dealer soft 17:** stand or hit? (Default: stand.)
- [ ] **Double:** on any first two cards, or only on 9–11? After a split? (Default: any two cards, after split allowed.)
- [ ] **Split:** same rank only, or any two 10-value cards (K + Q)? Up to 4 hands? (Default: same rank, 4 hands.)
- [ ] **Brave-hit bonus:** count only hard totals, since a soft hand can't bust? Does doubling on 14+ count as a brave hit? (Default: hard only, doubling counts.)
- [ ] **Split sweep with 3–4 hands:** +5 when every split hand wins? (Default: yes.)
- [ ] **Deck:** 6-deck shoe, or an infinite deck where every card is random? (Default: 6-deck shoe.)
