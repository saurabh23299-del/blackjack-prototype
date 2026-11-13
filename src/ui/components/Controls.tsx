import { motion } from 'framer-motion';
import type { Action } from '../useTable';
import { ACTIONS, CLEAR_BTN, DEAL_BTN } from '../layout';

/** Figma annotation: buttons get slightly darker and shrink slightly when pressed, and return on release. */
const press = { scale: 0.92, filter: 'brightness(0.8)' };

const ICONS: Record<Action, JSX.Element> = {
  hit: (
    <svg viewBox="0 0 24 24"><rect x="4" y="3" width="12" height="17" rx="2" fill="#fff" /><rect x="8" y="5" width="12" height="17" rx="2" fill="#fff" stroke="#173a8f" strokeWidth="1.2" /><path d="M14 10v7M10.5 13.5h7" stroke="#173a8f" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  stand: (
    <svg viewBox="0 0 24 24"><path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v5.5m0-3a1.5 1.5 0 0 1 3 0V15c0 4-2.7 7-6.6 7-2.6 0-4.3-1.2-5.6-3.3L4.6 14.4a1.5 1.5 0 0 1 2.4-1.8L8 14" fill="#fff" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" /></svg>
  ),
  split: (
    <svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="8" height="12" rx="1.5" fill="#fff" /><rect x="13.5" y="5" width="8" height="12" rx="1.5" fill="#fff" /><path d="M6.5 21h11M12 17.5V21" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
  ),
  double: (
    <svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="6.5" fill="#fff" /><circle cx="9" cy="12" r="3.8" fill="none" stroke="#1f6d1c" strokeWidth="1.4" strokeDasharray="2 1.6" /><circle cx="16" cy="12" r="6.5" fill="#fff" stroke="#1f6d1c" strokeWidth="1.2" /><text x="16" y="15.2" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1f6d1c" fontFamily="Roboto Slab, serif">2x</text></svg>
  ),
};
const LABELS: Record<Action, string> = { hit: 'Hit', stand: 'Stand', split: 'Split', double: 'Double' };

/** Hit / Stand / Split / Double — rise from the bottom once the deal has landed (video + Figma Tutorial 2). */
export function ActionBar({ H, can, onAct }: { H: number; can: Record<Action, boolean>; onAct: (a: Action) => void }) {
  const order: Action[] = ['hit', 'stand', 'split', 'double'];
  return (
    <>
      {order.map((a, i) => (
        <motion.button key={a} className={`action ${a}`} disabled={!can[a]} onClick={() => onAct(a)}
          style={{ left: ACTIONS[a].left, top: H - ACTIONS[a].bottom - 60, zIndex: 30 }}
          initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 220, transition: { duration: 0.3, ease: 'easeIn', delay: i * 0.03 } }}
          transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.05 * i }}
          whileTap={can[a] ? press : undefined} aria-label={LABELS[a]}>
          <span>{LABELS[a]}</span>
          {ICONS[a]}
        </motion.button>
      ))}
    </>
  );
}

export function BetButtons({ H, canClear, canDeal, onClear, onDeal }: { H: number; canClear: boolean; canDeal: boolean; onClear: () => void; onDeal: () => void }) {
  return (
    <>
      <motion.button className="gold-btn red abs" style={{ left: CLEAR_BTN.left, top: H - CLEAR_BTN.bottom - 50, zIndex: 30 }}
        disabled={!canClear} onClick={onClear} whileTap={canClear ? press : undefined}
        initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 140, transition: { duration: 0.28, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
        Clear bet
      </motion.button>
      <motion.button className="gold-btn green abs" style={{ left: DEAL_BTN.left, top: H - DEAL_BTN.bottom - 50, zIndex: 30 }}
        disabled={!canDeal} onClick={onDeal} whileTap={canDeal ? press : undefined}
        initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 140, transition: { duration: 0.28, ease: 'easeIn', delay: 0.04 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.04 }}>
        Deal
      </motion.button>
    </>
  );
}
