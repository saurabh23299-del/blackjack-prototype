import { animate, AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { BALANCE_TARGET, CHIP_RACK, DEALER_BANK, chipColor } from '../layout';

const asset = (p: string) => `${import.meta.env.BASE_URL}assets/${p}`;

// ---------------- table background (Default → Zoomed in → Lit) ----------------
/** The table never moves; only the lights switch on when a round starts and off when it ends.
 *  `table-lights.png` is the lights-only layer taken from the Figma Lit variant (Lit minus Default,
 *  aligned to the Default framing), added on top of the Default table. */
export function TableBackground({ lit }: { lit: boolean }) {
  return (
    <div className="table-bg">
      <img src={asset('table-default.png')} alt="" />
      <motion.img
        className="table-lights"
        src={asset('table-lights.png')} alt=""
        initial={false}
        animate={lit ? { opacity: [0, 1, 0.35, 1] } : { opacity: 0 }}
        transition={lit ? { delay: 0.2, duration: 0.32, times: [0, 0.25, 0.55, 1] } : { duration: 0.3 }}
      />
    </div>
  );
}

// ---------------- top bar ----------------
function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const ctrl = animate(from.current, value, { duration: 0.6, ease: 'easeOut', onUpdate: v => setShown(Math.round(v)) });
    from.current = value;
    return () => ctrl.stop();
  }, [value]);
  return shown;
}

export function BalancePill({ balance }: { balance: number }) {
  const shown = useCountUp(balance);
  return (
    <div className="balance-pill" aria-label={`Balance ${balance} coins`}>
      <div className="group">
        <div className="coin"><img src={asset('coin.svg')} alt="" /></div>
        <motion.span key={balance} className="amount" initial={{ scale: 1.15 }} animate={{ scale: 1 }}>{shown.toLocaleString('en-US')}</motion.span>
      </div>
      <img src={asset('add-coins.svg')} alt="" width={26} height={18} />
    </div>
  );
}

export function XpPill() {
  return (
    <div className="xp-pill" aria-label="XP 0 (placeholder)">
      <span className="star">
        <svg width="13" height="13" viewBox="0 0 20 20"><path d="M10 1.5l2.6 5.5 6 .7-4.4 4.1 1.2 5.9L10 14.8l-5.4 2.9 1.2-5.9L1.4 7.7l6-.7z" fill="#fff" /></svg>
      </span>
      0<small>XP</small>
    </div>
  );
}

export function SettingsIcon() {
  return <span className="icon-btn" style={{ left: 356, top: 40 }} aria-hidden><img src={asset('settings.svg')} alt="" /></span>;
}

export function InfoButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <motion.button className="icon-btn" style={{ left: 356, top: 78 }} onClick={onClick} disabled={disabled}
      aria-label="Basic rules" whileTap={{ scale: 0.88 }} initial={{ scale: 0 }} animate={{ scale: 1 }}>
      <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="1.8" /><circle cx="12" cy="7.4" r="1.3" fill="#fff" /><path d="M12 10.5v7" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
    </motion.button>
  );
}

/** Sits under the info button; spins once when tapped and resets the whole table. */
export function RefreshButton({ onClick }: { onClick: () => void }) {
  const [turns, setTurns] = useState(0);
  return (
    <motion.button className="icon-btn" style={{ left: 356, top: 112 }} aria-label="Reset table"
      onClick={() => { setTurns(n => n + 1); onClick(); }}
      whileTap={{ scale: 0.88 }} initial={{ scale: 0 }} animate={{ scale: 1, rotate: turns * 360 }}
      transition={{ rotate: { duration: 0.5, ease: 'easeInOut' } }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4.5h-4.5" />
      </svg>
    </motion.button>
  );
}

// ---------------- chips ----------------
export function ChipImg({ value, size = 80, label = true }: { value: number; size?: number; label?: boolean }) {
  return (
    <>
      <img src={asset(`chips/chip-${chipColor(value)}.svg`)} alt="" style={{ width: size, height: size }} />
      {label && <span className="label" style={{ fontSize: size * 0.2 }}>${value}</span>}
    </>
  );
}

/** The four Figma chips. In the tutorial they bob 10px in a constant spring (Figma annotation). */
export function ChipRack({ H, onTap, selected, bob, disabled }: { H: number; onTap: (i: number) => void; selected: number | null; bob: boolean; disabled: boolean }) {
  return (
    <motion.div className="abs" style={{ inset: 0, zIndex: 25, pointerEvents: 'none' }}
      initial={{ y: 160, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 180, opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      {CHIP_RACK.map((c, i) => (
        <motion.button key={c.value} className="chip" style={{ left: c.left, top: H - c.bottom - 80, pointerEvents: 'auto' }}
          aria-label={`Add $${c.value} chip`} onClick={() => onTap(i)} disabled={disabled}
          animate={bob ? { y: [0, -10, 0] } : { y: 0 }}
          transition={bob ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 } : { duration: 0.2 }}
          whileTap={{ scale: 0.9 }}>
          <ChipImg value={c.value} />
          {selected === i && <motion.span className="chip-ring" layoutId="chip-ring" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
        </motion.button>
      ))}
    </motion.div>
  );
}

/** Split a stake into chip denominations for the bet stack (largest first). */
export function stakeToChips(stake: number): number[] {
  const out: number[] = [];
  let left = stake;
  for (const v of [50, 25, 15, 5]) while (left >= v && out.length < 12) { out.push(v); left -= v; }
  return out;
}

export type StackMode = 'idle' | 'win' | 'lose' | 'push';

/** Bet stack. Placed chips fly in from the rack chip that was tapped (~250ms, as in the video).
 *  On payout: winnings fly from the dealer to the stack, then everything goes to the balance;
 *  on a loss the stack goes to the dealer. */
export function BetStack({ chips, H, mode, sourceOf, pos }: { chips: number[]; H: number; mode: StackMode; sourceOf: (value: number) => { x: number; y: number } | null; pos: { left: number; bottom: number } }) {
  const top = H - pos.bottom - 80;
  const visible = chips.slice(-7);
  const toBalance = { x: BALANCE_TARGET.x - pos.left - 40, y: BALANCE_TARGET.y - top - 40, scale: 0.3, opacity: 0.2 };
  const toDealer = { x: DEALER_BANK.x - pos.left - 40, y: DEALER_BANK.y - top - 40, scale: 0.6, opacity: 0 };
  const flyOut = mode === 'lose' ? toDealer : mode === 'idle' ? null : toBalance;
  return (
    <motion.div className="abs" style={{ width: 80, height: 80, zIndex: 24, pointerEvents: 'none' }}
      initial={false} animate={{ left: pos.left, top }} transition={{ type: 'spring', stiffness: 220, damping: 28 }}>
      <AnimatePresence>
        {visible.map((v, i) => {
          const src = sourceOf(v);
          return (
            <motion.div key={`${i}-${v}`} className="chip" style={{ left: 0, top: 0 }}
              initial={src ? { x: src.x - pos.left, y: src.y - top, scale: 1 } : { scale: 0.6, opacity: 0 }}
              animate={flyOut ? { ...flyOut, transition: { duration: 0.4, delay: (mode === 'win' ? 0.36 : 0) + i * 0.03, ease: [0.5, 0, 0.3, 1] } } : { x: 0, y: -i * 4, scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.3, 1] }}>
              <ChipImg value={v} label={visible.length === 1} />
            </motion.div>
          );
        })}
        {mode === 'win' && visible.map((v, i) => (
          <motion.div key={`win-${i}`} className="chip" style={{ left: 0, top: 0 }}
            initial={{ x: DEALER_BANK.x - pos.left - 40, y: DEALER_BANK.y - top - 40, scale: 0.6, opacity: 0 }}
            animate={{ x: [null, 14, toBalance.x], y: [null, -i * 4 - 6, toBalance.y], scale: [0.6, 1, 0.3], opacity: [0, 1, 0.2] }}
            transition={{ duration: 0.76, times: [0, 0.45, 1], delay: i * 0.03, ease: 'easeInOut' }}>
            <ChipImg value={v} label={false} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export function BetPill({ amount, cx, top }: { amount: number; cx: number; top: number }) {
  return (
    <motion.div className="bet-pill" layoutId="bet-pill" style={{ left: cx - 30, top, zIndex: 24 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <motion.span key={amount} initial={{ scale: 1.25 }} animate={{ scale: 1 }}>${amount}</motion.span>
    </motion.div>
  );
}

// ---------------- hand total bubble ----------------
/** Value updates after the card lands; the gold ring sweeps around the border on every change
 *  (Figma annotation: "animation happens around the hand counter circle border every time it updates"). */
export function TotalBubble({ label, x, y, size = 50, active = false, delay = 420 }: { label: string; x: number; y: number; size?: number; active?: boolean; delay?: number }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (label === shown) return;
    const id = window.setTimeout(() => setShown(label), delay);
    return () => window.clearTimeout(id);
  }, [label, shown, delay]);
  if (!shown) return null;
  const r = size / 2 + 2;
  const circ = 2 * Math.PI * r;
  return (
    <motion.div className={`total${size < 50 ? ' small' : ''}${shown.includes('/') ? ' soft' : ''}${active ? ' active' : ''}`}
      style={{ left: x, top: y, zIndex: 35 }}
      initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
      <svg viewBox={`${-4} ${-4} ${size + 8} ${size + 8}`}>
        <motion.circle key={shown} cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffe27a" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ, opacity: 1 }} animate={{ strokeDashoffset: 0, opacity: [1, 1, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <motion.span key={shown} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>{shown}</motion.span>
    </motion.div>
  );
}
