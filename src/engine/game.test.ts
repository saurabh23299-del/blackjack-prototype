import { describe, expect, it } from 'vitest';
import {
  buildShoe, canBet, canDouble, canHit, canSplit, canStand, createGame, double, handValue, hit,
  nextRound, parseCard, seededRng, split, stand, startRound, totalLabel, isBlackjack,
  type GameState, type Rules,
} from './index';

/** Game whose shoe starts with `cards` (deal order: P, D-up, P, D-hole, then hits), then a seeded filler shoe. */
function rigged(cards: string[], balance = 1000, rules: Partial<Rules> = {}): GameState {
  const shoe = [...cards.map(parseCard), ...buildShoe(4, seededRng(1))];
  return createGame({ balance, rules, shoe });
}
const cards = (...c: string[]) => c.map(parseCard);

describe('hand values', () => {
  it('counts faces as 10 and aces as 1 or 11', () => {
    expect(handValue(cards('KS', 'QH'))).toEqual({ total: 20, soft: false });
    expect(handValue(cards('AS', '6H'))).toEqual({ total: 17, soft: true });
    expect(handValue(cards('AS', '6H', '9C'))).toEqual({ total: 16, soft: false });
    expect(handValue(cards('AS', 'AH', '9C'))).toEqual({ total: 21, soft: true });
    expect(handValue(cards('AS', 'AH', 'AD', 'AC'))).toEqual({ total: 14, soft: true });
    expect(handValue(cards('10S', '6H', '6C'))).toEqual({ total: 22, soft: false });
  });
  it('labels soft totals with both values until the hand ends', () => {
    expect(totalLabel(cards('AS', '6H'), false)).toBe('7 / 17');
    expect(totalLabel(cards('AS', '6H'), true)).toBe('17');
    expect(totalLabel(cards('AS', 'KH'), false)).toBe('21');
    expect(totalLabel(cards('9S', '6H'), false)).toBe('15');
  });
  it('only an unsplit two-card 21 is Blackjack', () => {
    const base = { stake: 10, doubled: false, splitAces: false, done: false };
    expect(isBlackjack({ ...base, cards: cards('AS', 'KH'), fromSplit: false })).toBe(true);
    expect(isBlackjack({ ...base, cards: cards('AS', 'KH'), fromSplit: true })).toBe(false);
    expect(isBlackjack({ ...base, cards: cards('7S', '7H', '7C'), fromSplit: false })).toBe(false);
  });
});

describe('shoe', () => {
  it('builds 4 decks of 52 and is reproducible with a seed', () => {
    const a = buildShoe(4, seededRng(42));
    expect(a).toHaveLength(208);
    expect(buildShoe(4, seededRng(42))).toEqual(a);
    expect(a.filter(c => c.rank === 'A' && c.suit === 'S')).toHaveLength(4);
  });
  it('reshuffles before a round once 75% is dealt, never mid-round', () => {
    const s = createGame({ balance: 100000, rng: seededRng(3) });
    s.next = Math.ceil(s.shoe.length * 0.75);
    const old = s.shoe;
    startRound(s, 10);
    expect(s.shoe).not.toBe(old);
    expect(s.next).toBeGreaterThanOrEqual(4);
  });
});

describe('betting', () => {
  it('enforces min, max and balance', () => {
    const s = createGame({ balance: 100 });
    expect(canBet(s, 4)).toBe(false);
    expect(canBet(s, 5)).toBe(true);
    expect(canBet(s, 100)).toBe(true);
    expect(canBet(s, 101)).toBe(false);
    s.balance = 10000;
    expect(canBet(s, 501)).toBe(false);
  });
  it('takes the stake when the round starts', () => {
    const s = rigged(['10S', '9H', '7C', '8D']);
    startRound(s, 50);
    expect(s.balance).toBe(950);
    expect(s.phase).toBe('PLAYER_TURN');
  });
});

describe('peek and Blackjack', () => {
  it('pays player Blackjack 3:2 at once, rounding up odd bets', () => {
    const s = rigged(['AS', '9H', 'KC', '7D']);
    startRound(s, 15);
    expect(s.phase).toBe('ROUND_OVER');
    expect(s.hands[0].result).toBe('blackjack');
    expect(s.hands[0].coinsNet).toBe(23);
    expect(s.balance).toBe(1000 + 23);
    expect(s.dealer).toHaveLength(2);           // dealer does not draw
  });
  it('dealer Blackjack (10 up) beats everything but a player Blackjack', () => {
    const s = rigged(['10S', 'KH', '9C', 'AD']);
    startRound(s, 20);
    expect(s.phase).toBe('ROUND_OVER');
    expect(s.hands[0].result).toBe('lose');
    expect(s.balance).toBe(980);
  });
  it('dealer Blackjack (Ace up) vs player Blackjack is a push', () => {
    const s = rigged(['AS', 'AH', 'KC', 'QD']);
    startRound(s, 20);
    expect(s.hands[0].result).toBe('push');
    expect(s.balance).toBe(1000);
  });
  it('no peek needed when the up card cannot make Blackjack', () => {
    const s = rigged(['10S', '6H', '9C', 'AD']);   // 6 up, Ace hole: 17, not Blackjack
    startRound(s, 20);
    expect(s.phase).toBe('PLAYER_TURN');
  });
  it('dealer checks hole card but play continues without Blackjack', () => {
    const s = rigged(['10S', 'AH', '9C', '5D']);
    startRound(s, 20);
    expect(s.phase).toBe('PLAYER_TURN');
    expect(s.holeRevealed).toBe(false);
  });
});

describe('hit, stand and bust', () => {
  it('bust loses immediately and the dealer does not draw', () => {
    const s = rigged(['10S', '6H', '6C', '10D', 'KH', '9S']);
    startRound(s, 10);
    hit(s);
    expect(s.hands[0].result).toBe('lose');
    expect(s.dealer).toHaveLength(2);
    expect(s.balance).toBe(990);
  });
  it('a bust hand loses even if the dealer also busts (split case)', () => {
    // P 8,8 split; hand1 8+K=18 stand; hand2 8+5=13 hit K bust; dealer 6+10 draws 9 = 25 bust.
    const s = rigged(['8S', '6H', '8C', '10D', 'KH', '5S', 'KD', '9C']);
    startRound(s, 10);
    split(s); stand(s); hit(s);
    expect(s.hands.map(h => h.result)).toEqual(['win', 'lose']);
    expect(s.balance).toBe(1000 - 20 + 20 + 0);
  });
  it('auto-stands on 21 and goes to the dealer', () => {
    const s = rigged(['10S', '7H', '5C', '10D', '6H']);
    startRound(s, 10);
    hit(s);
    expect(s.phase).toBe('ROUND_OVER');
    expect(s.hands[0].result).toBe('win');      // 21 vs 17
    expect(s.balance).toBe(1010);
  });
  it('dealer stands on soft 17 by default and hits it when configured', () => {
    const a = rigged(['10S', 'AH', '8C', '6D', '4S']);
    startRound(a, 10); stand(a);
    expect(a.dealer).toHaveLength(2);           // A+6 = soft 17, stands
    expect(a.hands[0].result).toBe('win');      // 18 vs 17
    const b = rigged(['10S', 'AH', '8C', '6D', '4S'], 1000, { dealerHitsSoft17: true });
    startRound(b, 10); stand(b);
    expect(b.dealer).toHaveLength(3);           // draws the 4: 21
    expect(b.hands[0].result).toBe('lose');
  });
  it('dealer draws below 17 and busts', () => {
    const s = rigged(['10S', '10H', '8C', '6D', 'KS']);
    startRound(s, 10); stand(s);
    expect(s.dealer).toHaveLength(3);
    expect(s.hands[0].result).toBe('win');
    expect(s.balance).toBe(1010);
  });
  it('equal totals push', () => {
    const s = rigged(['10S', '10H', '8C', '8D']);
    startRound(s, 10); stand(s);
    expect(s.hands[0].result).toBe('push');
    expect(s.balance).toBe(1000);
  });
});

describe('double', () => {
  it('doubles the stake, deals exactly one card and ends the hand', () => {
    const s = rigged(['6S', '9H', '5C', '8D', 'KS']);
    startRound(s, 20);
    expect(canDouble(s)).toBe(true);
    double(s);
    expect(s.hands[0].cards).toHaveLength(3);
    expect(s.hands[0].stake).toBe(40);
    expect(s.hands[0].result).toBe('win');      // 21 vs 17
    expect(s.balance).toBe(1040);
  });
  it('still ends the hand when the double busts', () => {
    const s = rigged(['10S', '9H', '6C', '8D', 'KS']);
    startRound(s, 20); double(s);
    expect(s.hands[0].result).toBe('lose');
    expect(s.balance).toBe(960);
  });
  it('needs the extra stake in the balance (coin rule)', () => {
    const s = rigged(['6S', '9H', '5C', '8D'], 15);
    startRound(s, 10);                          // 5 left
    expect(canDouble(s)).toBe(false);
    expect(canHit(s)).toBe(true);
  });
  it('is not allowed after three cards', () => {
    const s = rigged(['2S', '9H', '3C', '8D', '2C']);
    startRound(s, 10); hit(s);
    expect(canDouble(s)).toBe(false);
  });
});

describe('split', () => {
  it('splits same rank only, plays hands left to right, settles each', () => {
    // 8,8 vs dealer 10/7. Hand1 8+3=11, double → +10 = 21. Hand2 8+K=18, stand. Dealer 17.
    const s = rigged(['8S', '10H', '8C', '7D', '3S', '10C', 'KD']);
    startRound(s, 10);
    expect(canSplit(s)).toBe(true);
    split(s);
    expect(s.hands).toHaveLength(2);
    expect(s.hands[0].cards.map(c => c.rank)).toEqual(['8', '3']);
    expect(s.active).toBe(0);
    double(s);                                  // double after split allowed
    expect(s.active).toBe(1);
    expect(s.hands[0].cards.map(c => c.rank)).toEqual(['8', '3', '10']);
    expect(s.hands[1].cards.map(c => c.rank)).toEqual(['8', 'K']);
    stand(s);
    expect(s.hands.map(h => h.result)).toEqual(['win', 'win']);
    expect(s.balance).toBe(1000 - 10 - 10 - 10 + 40 + 20);
  });
  it('does not split K–Q by default, does with splitBy value', () => {
    const a = rigged(['KS', '9H', 'QC', '8D']);
    startRound(a, 10);
    expect(canSplit(a)).toBe(false);
    const b = rigged(['KS', '9H', 'QC', '8D'], 1000, { splitBy: 'value' });
    startRound(b, 10);
    expect(canSplit(b)).toBe(true);
  });
  it('split Aces get one card each, no more actions, and 21 is not Blackjack', () => {
    const s = rigged(['AS', '9H', 'AC', '8D', 'KS', '5C']);
    startRound(s, 10);
    split(s);
    expect(s.phase).toBe('ROUND_OVER');         // both hands ended automatically
    expect(s.hands[0].cards.map(c => c.rank)).toEqual(['A', 'K']);
    expect(s.hands[0].result).toBe('win');      // 21 paid 1:1, not 3:2
    expect(s.hands[0].coinsNet).toBe(10);
    expect(s.hands[1].result).toBe('lose');     // 16 vs 17
    expect(s.balance).toBe(1000 - 20 + 20);
  });
  it('allows up to 4 hands', () => {
    const s = rigged(['8S', '10H', '8C', '9D', '8D', '8H', '2S', '2C', '2D', '2H']);
    startRound(s, 10);
    split(s);                                   // hand0: 8,8(D)
    expect(canSplit(s)).toBe(true);
    split(s);                                   // hand0: 8,8(H) ; 3 hands
    split(s);                                   // 4 hands
    expect(s.hands).toHaveLength(4);
    expect(canSplit(s)).toBe(false);
  });
  it('needs the extra stake in the balance', () => {
    const s = rigged(['8S', '10H', '8C', '9D'], 15);
    startRound(s, 10);
    expect(canSplit(s)).toBe(false);
  });
});

describe('UI guards', () => {
  it('no actions outside the player turn', () => {
    const s = rigged(['10S', '10H', '8C', '8D']);
    expect(canHit(s) || canStand(s) || canDouble(s) || canSplit(s)).toBe(false);
    startRound(s, 10); stand(s);
    expect(canHit(s) || canStand(s) || canDouble(s) || canSplit(s)).toBe(false);
    expect(() => hit(s)).toThrow();
  });
  it('emits events in deal order with the hole card hidden', () => {
    const s = rigged(['10S', '6H', '9C', '8D']);
    startRound(s, 10);
    const deal = s.events.filter(e => e.t === 'card');
    expect(deal.map(e => (e.t === 'card' ? e.to : ''))).toEqual(['player', 'dealer', 'player', 'dealer']);
    expect(deal[3].t === 'card' && deal[3].to === 'dealer' && deal[3].hidden).toBe(true);
    stand(s);
    expect(s.events.some(e => e.t === 'reveal')).toBe(true);
    expect(s.events[s.events.length - 1].t).toBe('settle');
  });
  it('nextRound returns to betting', () => {
    const s = rigged(['10S', '10H', '8C', '8D']);
    startRound(s, 10); stand(s); nextRound(s);
    expect(s.phase).toBe('BETTING');
    expect(s.hands).toEqual([]);
  });
});

describe('random play', () => {
  it('3,000 random rounds: balance always equals start + sum of net results', () => {
    const rng = seededRng(7);
    const s = createGame({ balance: 1_000_000, rng });
    let expected = s.balance;
    for (let i = 0; i < 3000; i++) {
      startRound(s, 10 + Math.floor(rng() * 50));
      while (s.phase === 'PLAYER_TURN') {
        const r = rng();
        if (canSplit(s) && r < 0.3) split(s);
        else if (canDouble(s) && r < 0.5) double(s);
        else if (canHit(s) && handValue(s.hands[s.active].cards).total < 16) hit(s);
        else stand(s);
      }
      expect(s.phase).toBe('ROUND_OVER');
      for (const h of s.hands) {
        expect(h.result).toBeDefined();
        const v = handValue(h.cards).total;
        if (v > 21) expect(h.result).toBe('lose');
      }
      expected += s.hands.reduce((sum, h) => sum + h.coinsNet!, 0);
      expect(s.balance).toBe(expected);
      expect(s.events[s.events.length - 1].balance).toBe(s.balance);
      nextRound(s);
    }
  });
});
