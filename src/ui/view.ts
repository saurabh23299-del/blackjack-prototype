import { handValue, totalLabel, type Card, type GameEvent, type HandResult } from '../engine';

/** What the table shows after replaying the first N engine events. Pure; drives all rendering. */
export interface ViewCard { id: string; card: Card; hidden: boolean }
export interface ViewHand { cards: ViewCard[]; stake: number; doubled: boolean; result?: HandResult; coinsNet?: number }
export interface TableView {
  dealer: ViewCard[];
  hands: ViewHand[];
  active: number;              // -1 when no player hand is waiting
  revealed: boolean;
  settled: boolean;
  balance: number | null;      // null when no event has carried a balance yet
}

export function project(events: GameEvent[]): TableView {
  const v: TableView = { dealer: [], hands: [], active: -1, revealed: false, settled: false, balance: null };
  for (const e of events) {
    v.balance = e.balance;
    switch (e.t) {
      case 'round':
        v.hands = [{ cards: [], stake: e.bet, doubled: false }];
        break;
      case 'card':
        if (e.to === 'dealer') v.dealer.push({ id: `c${e.seq}`, card: e.card, hidden: e.hidden });
        else v.hands[e.hand].cards.push({ id: `c${e.seq}`, card: e.card, hidden: false });
        break;
      case 'split': {
        const h = v.hands[e.hand];
        const moved = h.cards.pop()!;
        v.hands.splice(e.hand + 1, 0, { cards: [moved], stake: h.stake, doubled: false });
        v.active = e.hand;
        break;
      }
      case 'double':
        v.hands[e.hand].stake *= 2;
        v.hands[e.hand].doubled = true;
        break;
      case 'active':
        v.active = e.hand;
        break;
      case 'reveal':
        v.revealed = true;
        v.active = -1;
        v.dealer = v.dealer.map(c => ({ ...c, hidden: false }));
        break;
      case 'settle':
        v.settled = true;
        v.active = -1;
        e.results.forEach((r, i) => { if (v.hands[i]) Object.assign(v.hands[i], { result: r.result, coinsNet: r.coinsNet, stake: r.stake }); });
        break;
    }
  }
  return v;
}

/** Dealer bubble: only the up card until the hole card is revealed. */
export function dealerTotal(v: TableView): string {
  if (v.dealer.length === 0) return '';
  const visible = v.dealer.filter(c => !c.hidden).map(c => c.card);
  return totalLabel(visible, v.settled || (v.revealed && handValue(visible).total >= 17));
}

/** Player bubble for hand i: soft totals show both values while the hand is still being played. */
export function playerTotal(v: TableView, i: number): string {
  const h = v.hands[i];
  if (!h || h.cards.length === 0) return '';
  const ended = v.settled || v.revealed || h.doubled || (v.active >= 0 && i < v.active);
  return totalLabel(h.cards.map(c => c.card), ended);
}

export function totalStake(v: TableView): number {
  return v.hands.reduce((s, h) => s + h.stake, 0);
}
