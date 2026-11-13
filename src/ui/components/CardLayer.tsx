import { AnimatePresence, motion } from 'framer-motion';
import type { TableView } from '../view';
import { CARD_H, CARD_W, DEALER_TOP, DISCARD, SHOE, fan, handSlots } from '../layout';
import { CardBack, CardFace } from './CardArt';

/** Motion language from the reference video: cards leave the shoe face down, slide in with a
 *  slight spin, settle, then flip in place. At round end they sweep to the discard pile. */
const TRAVEL = { duration: 0.42, ease: [0.16, 1, 0.3, 1] } as const;
const FLIP = { duration: 0.26, ease: [0.4, 0, 0.2, 1] } as const;

interface Placed { id: string; x: number; y: number; scale: number; z: number; hidden: boolean; card: TableView['dealer'][number]['card'] }

export function placeCards(view: TableView, H: number): Placed[] {
  const out: Placed[] = [];
  const dx = fan(view.dealer.length, 195, CARD_W, 176, 40);
  view.dealer.forEach((c, i) => out.push({ id: c.id, card: c.card, hidden: c.hidden, x: dx[i], y: DEALER_TOP, scale: 1, z: i }));
  const slots = handSlots(view.hands.length, H);
  view.hands.forEach((h, k) => {
    const s = slots[k];
    const xs = fan(h.cards.length, s.cx, CARD_W * s.scale, s.maxW, 39 * s.scale);
    h.cards.forEach((c, i) => out.push({ id: c.id, card: c.card, hidden: false, x: xs[i], y: s.top, scale: s.scale, z: 10 + k * 10 + i }));
  });
  return out;
}

export function CardLayer({ view, H, collecting }: { view: TableView; H: number; collecting: boolean }) {
  const cards = collecting ? [] : placeCards(view, H);
  return (
    <AnimatePresence>
      {cards.map((c, i) => (
        <motion.div
          key={c.id}
          className="card"
          style={{ zIndex: c.z, originX: 0, originY: 0, width: CARD_W, height: CARD_H }}
          initial={{ x: SHOE.x, y: SHOE.y, rotate: SHOE.rotate, scale: c.scale }}
          animate={{ x: c.x, y: c.y, rotate: 0, scale: c.scale }}
          exit={{ x: DISCARD.x, y: DISCARD.y, rotate: DISCARD.rotate, scale: 0.7, transition: { duration: 0.45, ease: [0.55, 0, 0.45, 1], delay: i * 0.05 } }}
          transition={TRAVEL}
        >
          <motion.div
            className="card-inner"
            initial={{ rotateY: 180 }}
            animate={{ rotateY: c.hidden ? 180 : 0, y: c.hidden ? 0 : [0, -6, 0] }}
            transition={{ rotateY: { ...FLIP, delay: 0.32 }, y: { duration: 0.3, delay: 0.3 } }}
          >
            <div className="card-face"><CardFace card={c.card} /></div>
            <div className="card-back"><CardBack /></div>
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

/** The used-card pile at the top left (Figma Tutorial 8), shown once a round has been played. */
export function DiscardPile() {
  return (
    <div className="abs" style={{ left: DISCARD.x - 4, top: DISCARD.y + 2, zIndex: 5, pointerEvents: 'none' }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="card" style={{ transform: `rotate(${DISCARD.rotate + i * 4}deg) translate(${i * 2}px, ${i}px)` }}>
          <div className="card-face" style={{ transform: 'none', background: 'none' }}><CardBack /></div>
        </div>
      ))}
    </div>
  );
}
