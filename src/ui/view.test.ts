import { describe, expect, it } from 'vitest';
import { buildShoe, createGame, double, hit, parseCard, seededRng, split, stand, startRound, canSplit, canDouble, canHit } from '../engine';
import { dealerTotal, playerTotal, project, totalStake } from './view';

const rigged = (cards: string[], balance = 1000) =>
  createGame({ balance, shoe: [...cards.map(parseCard), ...buildShoe(4, seededRng(9))] });

describe('table view replays engine events', () => {
  it('hides the hole card and shows only the up-card total until the reveal', () => {
    const s = rigged(['10S', 'AH', '6C', '9D']);
    startRound(s, 10);
    const v = project(s.events);
    expect(v.dealer.map(c => c.hidden)).toEqual([false, true]);
    expect(dealerTotal(v)).toBe('1 / 11');
    expect(playerTotal(v, 0)).toBe('16');
    stand(s);
    const end = project(s.events);
    expect(end.dealer.every(c => !c.hidden)).toBe(true);
    expect(dealerTotal(end)).toBe('20');
    expect(end.settled).toBe(true);
    expect(end.hands[0].result).toBe('lose');
  });

  it('shows soft totals as two values while the hand is live', () => {
    const s = rigged(['AS', '9H', '6C', '8D']);
    startRound(s, 10);
    expect(playerTotal(project(s.events), 0)).toBe('7 / 17');
    stand(s);
    expect(playerTotal(project(s.events), 0)).toBe('17');
  });

  it('every partial replay is consistent (cards never jump between hands)', () => {
    const s = rigged(['8S', '10H', '8C', '7D', '3S', '10C', 'KD']);
    startRound(s, 10); split(s); double(s); stand(s);
    for (let i = 0; i <= s.events.length; i++) {
      const v = project(s.events.slice(0, i));
      const ids = [...v.dealer, ...v.hands.flatMap(h => h.cards)].map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const v = project(s.events);
    expect(v.hands.map(h => h.cards.map(c => c.card.rank))).toEqual([['8', '3', '10'], ['8', 'K']]);
    expect(v.hands[0].stake).toBe(20);
    expect(totalStake(v)).toBe(30);
    expect(v.balance).toBe(s.balance);
  });

  it('balance on the last event always matches the engine', () => {
    const rng = seededRng(11);
    const s = createGame({ balance: 100000, rng });
    for (let r = 0; r < 300; r++) {
      startRound(s, 25);
      while (s.phase === 'PLAYER_TURN') {
        if (canSplit(s)) split(s); else if (canDouble(s) && rng() < 0.3) double(s); else if (canHit(s) && rng() < 0.5) hit(s); else stand(s);
      }
      const v = project(s.events);
      expect(v.settled).toBe(true);
      expect(v.balance).toBe(s.balance);
      expect(v.hands.length).toBe(s.hands.length);
      s.phase = 'BETTING';
    }
  });
});
