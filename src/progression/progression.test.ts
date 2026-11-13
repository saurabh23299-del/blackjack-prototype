import { describe, expect, it } from 'vitest';
import { buildShoe, canHit, canStand, createGame, handValue, parseCard, seededRng, nextRound, type GameState } from '../engine';
import {
  activateFever, braveTierFor, canBetP, canDoubleP, canSplitP, coinsNeeded, createProgress, declineFever, doubleP, doubleShortP,
  feverReady, hitP, skipFeverAd, spendXP, splitP, standP, startRoundP, PROGRESS_RULES, type Progress, type RoundTrack,
} from './progression';

const rigged = (cards: string[], balance = 1000): GameState =>
  createGame({ balance, shoe: [...cards.map(parseCard), ...buildShoe(4, seededRng(5))] });
const cards = (...c: string[]) => c.map(parseCard);
const kinds = (t: RoundTrack) => t.result!.awards.map(a => `${a.kind}:${a.points}`);

/** Play one rigged round: deal, then the listed actions. */
function play(cardsList: string[], actions: ('hit' | 'stand' | 'double' | 'split')[], p: Progress, bet = 10, balance = 1000) {
  const s = rigged(cardsList, balance);
  const t = startRoundP(s, p, bet);
  for (const a of actions) ({ hit: hitP, stand: standP, double: doubleP, split: splitP })[a](s, p, t);
  return { s, t };
}

describe('Nerve points per hand', () => {
  it('Blackjack 20', () => {
    const p = createProgress();
    const { t } = play(['AS', '9H', 'KC', '7D'], [], p);
    expect(kinds(t)).toEqual(['blackjack:20']);
    expect(p.nerveTotal).toBe(20);
  });
  it('win 10, push 2, lose 0', () => {
    const p = createProgress();
    expect(kinds(play(['10S', '10H', '9C', '7D'], ['stand'], p).t)).toEqual(['win:10']);
    expect(kinds(play(['10S', '10H', '8C', '8D'], ['stand'], p).t)).toEqual(['push:2']);
    expect(kinds(play(['10S', '10H', '7C', '9D'], ['stand'], p).t)).toEqual([]);
    expect(p.nerveTotal).toBe(12);
  });
  it('win after doubling 20', () => {
    const p = createProgress();
    const { t } = play(['6S', '9H', '5C', '8D', 'KS'], ['double'], p);   // 11 → 21 vs 17
    expect(kinds(t)).toEqual(['winDoubled:20']);
  });
  it('awards only once per round', () => {
    const p = createProgress();
    const { s, t } = play(['10S', '10H', '9C', '7D'], ['stand'], p);
    expect(() => standP(s, p, t)).toThrow();
    expect(p.nerveTotal).toBe(10);
  });
});

describe('Brave Hit', () => {
  it('tiers by hard total before the hit; soft hands never count', () => {
    expect(braveTierFor(cards('10S', '3H'))).toBe(0);
    expect(braveTierFor(cards('10S', '4H'))).toBe(1);
    expect(braveTierFor(cards('10S', '5H'))).toBe(1);
    expect(braveTierFor(cards('10S', '6H'))).toBe(2);
    expect(braveTierFor(cards('10S', '7H'))).toBe(2);
    expect(braveTierFor(cards('10S', '8H'))).toBe(3);
    expect(braveTierFor(cards('AS', '7H'))).toBe(0);           // soft 18
  });
  it('winning hand gets the bonus for the highest tier reached', () => {
    const p = createProgress();
    // 10+4 = 14 (tier 1) hit 2 → 16 (tier 2) hit 4 → 20, dealer 10+8 = 18.
    const { t } = play(['10S', '10H', '4C', '8D', '2S', '4H'], ['hit', 'hit', 'stand'], p);
    expect(kinds(t)).toEqual(['win:10', 'brave:5']);
    expect(t.result!.awards[1].tier).toBe(2);
  });
  it('tutorial hand: hit on hard 16 then win = 10 + 5', () => {
    const p = createProgress();
    const { t } = play(['10S', '10D', '6C', '8C', '4D'], ['hit', 'stand'], p);
    expect(t.result!.total).toBe(15);
  });
  it('no bonus on a loss or push', () => {
    const p = createProgress();
    const { t } = play(['10S', '10H', '6C', '9D', '2S'], ['hit', 'stand'], p);   // 18 vs 19
    expect(kinds(t)).toEqual([]);
  });
  it('doubling on hard 14+ counts as a brave hit', () => {
    const p = createProgress();
    const { t } = play(['9S', '10H', '5C', '7D', '6S'], ['double'], p);        // 14 → 20 vs 17
    expect(kinds(t)).toEqual(['winDoubled:20', 'brave:2']);
  });
});

describe('split sweep', () => {
  it('+5 when every split hand wins (two hands = 25)', () => {
    const p = createProgress();
    // 8,8 vs 10/7. Hand1 8+K=18 stand, hand2 8+Q=18 stand. Dealer 17.
    const { t } = play(['8S', '10H', '8C', '7D', 'KS', 'QS'], ['split', 'stand', 'stand'], p);
    expect(kinds(t)).toEqual(['win:10', 'win:10', 'sweep:5']);
    expect(t.result!.total).toBe(25);
  });
  it('no sweep when one split hand pushes or loses', () => {
    const p = createProgress();
    const { t } = play(['8S', '10H', '8C', '7D', 'KS', '9S'], ['split', 'stand', 'stand'], p);  // 18 win, 17 push
    expect(kinds(t)).toEqual(['win:10', 'push:2']);
  });
  it('brave tiers stay with the right hand after a split', () => {
    const p = createProgress();
    // 8,8 split. Hand1: 8+6=14 hit (tier 1) +5 = 19 stand. Hand2: 8+K=18 stand. Dealer 10+7 = 17.
    const { t } = play(['8S', '10H', '8C', '7D', '6S', '5C', 'KS'], ['split', 'hit', 'stand', 'stand'], p);
    expect(t.braveTiers).toEqual([1, 0]);
    expect(kinds(t)).toEqual(['win:10', 'brave:2', 'win:10', 'sweep:5']);
  });
});

describe('Fever unlock and meter', () => {
  it('unlocks the first time Nerve reaches exactly 300; that round does not fill the meter', () => {
    const p = createProgress(290);
    const { t } = play(['10S', '10H', '9C', '7D'], ['stand'], p);
    expect(p.nerveTotal).toBe(300);
    expect(p.fever.unlocked).toBe(true);
    expect(t.result!.unlockedNow).toBe(true);
    expect(p.fever.meter).toBe(0);
  });
  it('299 is not enough', () => {
    const p = createProgress(289);
    play(['10S', '10H', '9C', '7D'], ['stand'], p);
    expect(p.nerveTotal).toBe(299);
    expect(p.fever.unlocked).toBe(false);
  });
  it('after unlock, points fill the meter; ready at 50', () => {
    const p = createProgress(300);
    for (let i = 0; i < 4; i++) play(['10S', '10H', '9C', '7D'], ['stand'], p);
    expect(p.fever.meter).toBe(40);
    const { s } = play(['10S', '10H', '9C', '7D'], ['stand'], p);
    expect(p.fever.meter).toBe(50);
    expect(feverReady(s, p)).toBe(true);
  });
  it('activate keeps the overflow above 50 and gives 3 Fever rounds', () => {
    const p = createProgress(300);
    p.fever.meter = 45;
    const { s } = play(['AS', '9H', 'KC', '7D'], [], p);          // +20 → 65
    expect(p.fever.meter).toBe(65);
    activateFever(s, p);
    expect(p.fever.meter).toBe(15);
    expect(p.fever.roundsLeft).toBe(3);
  });
  it('not right now resets the meter to 0', () => {
    const p = createProgress(300);
    p.fever.meter = 55;
    const s = createGame({ balance: 1000 });
    declineFever(s, p);
    expect(p.fever.meter).toBe(0);
    expect(p.fever.roundsLeft).toBe(0);
  });
  it('Fever rounds count down, earn Nerve, but do not fill the meter', () => {
    const p = createProgress(300);
    p.fever.roundsLeft = 3; p.fever.meter = 7;
    play(['10S', '10H', '9C', '7D'], ['stand'], p);
    expect(p.fever.roundsLeft).toBe(2);
    expect(p.fever.meter).toBe(7);
    expect(p.nerveTotal).toBe(310);
  });
});

describe('Fever coins', () => {
  const fever = () => { const p = createProgress(300); p.fever.roundsLeft = 3; return p; };
  it('doubles the net win', () => {
    const p = fever();
    const { s, t } = play(['10S', '10H', '9C', '7D'], ['stand'], p, 15);
    expect(s.balance).toBe(1000 + 30);
    expect(t.result!.feverNet).toEqual([30]);
  });
  it('Blackjack: round up first, then double (15 → +46)', () => {
    const p = fever();
    const { s } = play(['AS', '9H', 'KC', '7D'], [], p, 15);
    expect(s.balance).toBe(1046);
  });
  it('takes a second stake on a loss, nothing extra on a push', () => {
    const p = fever();
    expect(play(['10S', '10H', '7C', '9D'], ['stand'], p, 15).s.balance).toBe(970);
    expect(play(['10S', '10H', '8C', '8D'], ['stand'], p, 15).s.balance).toBe(1000);
  });
  it('bet needs 2× in the balance during Fever', () => {
    const p = fever();
    const s = createGame({ balance: 30 });
    expect(canBetP(s, p, 15)).toBe(true);
    expect(canBetP(s, p, 20)).toBe(false);
    expect(canBetP(s, createProgress(), 20)).toBe(true);
  });
  it('coverage rule: Double needs (stakes after double) × 2 at round start', () => {
    const p = fever();
    const a = rigged(['6S', '9H', '5C', '8D'], 39);
    const ta = startRoundP(a, p, 10);
    expect(canDoubleP(a, ta)).toBe(false);                        // needs 40
    expect(doubleShortP(a, ta)).toBe(1);
    const b = rigged(['6S', '9H', '5C', '8D'], 40);
    const tb = startRoundP(b, fever(), 10);
    expect(canDoubleP(b, tb)).toBe(true);
    const c = rigged(['8S', '9H', '8C', '7D'], 39);
    expect(canSplitP(c, startRoundP(c, fever(), 10))).toBe(false);
  });
  it('balance never goes below 0 in Fever (random play)', () => {
    const rng = seededRng(21);
    const s = createGame({ balance: 400, rng });
    const p = createProgress(300);
    for (let r = 0; r < 400; r++) {
      if (p.fever.roundsLeft === 0) p.fever.roundsLeft = 3;
      if (coinsNeeded(s, p) !== 'none') { s.balance = 400; }
      const bet = Math.min(25, Math.floor(s.balance / 2 / 5) * 5);
      if (bet < 5) { s.balance = 400; continue; }
      const t = startRoundP(s, p, bet);
      while (s.phase === 'PLAYER_TURN') {
        const x = rng();
        if (canSplitP(s, t) && x < 0.4) splitP(s, p, t);
        else if (canDoubleP(s, t) && x < 0.6) doubleP(s, p, t);
        else if (canHit(s) && handValue(s.hands[s.active].cards).total < 15) hitP(s, p, t);
        else if (canStand(s)) standP(s, p, t);
      }
      expect(s.balance).toBeGreaterThanOrEqual(0);
      expect(t.result).not.toBeNull();
      nextRound(s);
    }
  });
  it('low balance mid-Fever pauses; skipping the ad ends Fever', () => {
    const p = fever();
    const s = createGame({ balance: 9 });
    expect(coinsNeeded(s, p)).toBe('fever');
    skipFeverAd(p);
    expect(p.fever.roundsLeft).toBe(0);
    expect(coinsNeeded(s, p)).toBe('none');                       // 9 ≥ 5
  });
});

describe('XP spending', () => {
  it('only spending lowers Nerve; Fever stays unlocked', () => {
    const p = createProgress(320);
    expect(spendXP(p, 500)).toBe(false);
    expect(spendXP(p, 100)).toBe(true);
    expect(p.nerveTotal).toBe(220);
    expect(p.fever.unlocked).toBe(true);
  });
  it('unlock threshold constant matches the doc', () => {
    expect(PROGRESS_RULES.feverUnlockAt).toBe(300);
    expect(PROGRESS_RULES.feverMeterSize).toBe(50);
    expect(PROGRESS_RULES.feverRounds).toBe(3);
  });
});
