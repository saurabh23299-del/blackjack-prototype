import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import type { HandResult } from '../../engine';

const asset = (p: string) => `${import.meta.env.BASE_URL}assets/${p}`;

/** Tooltips bob 5px up and down in a constant spring motion (Figma Tutorial 1 annotation). */
const bob = {
  animate: { y: [0, -5, 0], opacity: 1 },
  transition: { y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const }, opacity: { duration: 0.3 } },
};

/** Tutorial-1 dialogue boxes, using the exact Figma SVG shapes and text positions. */
export function BalanceTip() {
  return (
    <motion.div className="svg-tip" style={{ left: 12, top: 76 }} initial={{ opacity: 0, y: -10 }} {...bob}>
      <img src={asset('tooltip-tail-top.svg')} alt="" />
      <p style={{ left: 0, width: 183, top: 20, textAlign: 'center', fontSize: 12, fontWeight: 500 }}>This is your coin balance</p>
      <p style={{ left: 8, width: 185, top: 40, fontSize: 10 }}>Your coin balance changes with every win and loss.</p>
    </motion.div>
  );
}
export function DealTip({ top }: { top: number }) {
  return (
    <motion.div className="svg-tip" style={{ left: 95, top }} initial={{ opacity: 0 }} {...bob}>
      <img src={asset('tooltip-tail-center.svg')} alt="" style={{ transform: 'scaleY(-1)' }} />
      <p style={{ left: 23, width: 161, top: 12, fontSize: 12, fontWeight: 500 }}>Place a bet and press “Deal” to start the game</p>
    </motion.div>
  );
}

/** Small cream callouts used in Tutorial 2, 5 and 6. */
export function Tip({ children, style, dir, tail }: { children: ReactNode; style: CSSProperties; dir: 'up' | 'down'; tail?: number }) {
  return (
    <motion.div className={`tip ${dir}`} style={{ ...style, ['--tail' as string]: tail !== undefined ? `${tail}px` : undefined }}
      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }} exit={{ opacity: 0, scale: 0.8 }}
      transition={{ opacity: { duration: 0.25 }, scale: { duration: 0.25 }, y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}>
      {children}
    </motion.div>
  );
}

// ---------------- Basic Rules (Figma Tutorial 3 / 4) ----------------
const RULES_A: ReactNode[] = [
  <>1. Number cards are worth their face value.</>,
  <>2. Jack, Queen and King are worth 10.</>,
  <>3. An Ace is worth 1 or 11.</>,
  <>4. Your hand value is the total of all your cards.</>,
];
const RULES_B: ReactNode[] = [
  <>1. Your goal is to get a hand closer to <b>21</b></>,
  <>2. Go over 21, and you lose</>,
  <>3. A higher total than the Dealer gets you a <span className="g">win</span> and a lower total results in a loss</>,
  <>4. If the Dealer goes over 21, you <span className="g">win</span>.</>,
  <>5. Matching Dealer’s total results in a <span className="g">tie</span>.</>,
  <>6. Get an Ace and a 10-value card in your first two cards, and you have a <b>Blackjack!</b></>,
];

/** Rules slide in one by one. After the last page the overlay shrinks into the info button. */
export function RulesOverlay({ mode, onNext, onContinue }: { mode: 'rules4' | 'rules6' | 'info'; onNext: () => void; onContinue: () => void }) {
  const items = mode === 'rules4' ? RULES_A : RULES_B;
  const gap = mode === 'rules4' ? 70 : 74;
  const firstTop = mode === 'rules4' ? 176 : 172;
  return (
    <motion.div className="abs" style={{ inset: 0, zIndex: 50, background: 'rgba(14, 4, 2, 0.72)', transformOrigin: '368px 90px' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.02, transition: { duration: 0.55, ease: [0.6, 0, 0.3, 1] } }}>
      <motion.div className="rules-title" style={{ top: 86 }} initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>Basic Rules</motion.div>
      <AnimatePresence mode="popLayout">
        {items.map((r, i) => (
          <motion.div key={`${mode}-${i}`} className="rule" style={{ top: firstTop + i * gap }}
            initial={{ x: 380, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -380, opacity: 0, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.25 + i * 0.22 }}>
            {r}
          </motion.div>
        ))}
      </AnimatePresence>
      <motion.button className="gold-btn green abs"
        style={mode === 'rules4' ? { left: 135, top: 492, width: 120 } : { left: 85, top: 672, width: 220 }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + items.length * 0.22 }}
        whileTap={{ scale: 0.94, filter: 'brightness(0.8)' }}
        onClick={mode === 'rules4' ? onNext : onContinue}>
        {mode === 'rules4' ? 'Next >' : 'Continue playing'}
      </motion.button>
    </motion.div>
  );
}

// ---------------- result toast ----------------
const CONFETTI_COLORS = ['#f5c518', '#e8453c', '#3ccf6a', '#4aa3ff', '#ffffff', '#ff8fd1'];

export interface ResultSummary { kind: HandResult; title: string; sub: string }

/** "You Win" toast with confetti (Figma Tutorial 7); the other outcomes reuse the same shape. */
export function ResultToast({ summary, top }: { summary: ResultSummary; top: number }) {
  const celebrate = summary.kind === 'win' || summary.kind === 'blackjack';
  return (
    <motion.div className={`toast ${summary.kind}`} style={{ top }}
      initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.08, 1], opacity: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ duration: 0.45, times: [0, 0.65, 1] }} role="status">
      <h2>{summary.title}</h2>
      <p>{summary.sub}</p>
      {celebrate && Array.from({ length: 30 }, (_, i) => {
        const angle = (i / 30) * Math.PI * 2;
        const dist = 70 + (i % 5) * 18;
        return (
          <motion.span key={i} className="confetti"
            style={{ left: '50%', top: '50%', background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], borderRadius: i % 3 === 0 ? '50%' : 1 }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(angle) * dist * 1.4, y: [0, Math.sin(angle) * dist * 0.7, Math.sin(angle) * dist * 0.7 + 60], opacity: [1, 1, 0], rotate: 360 + i * 40 }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.1 }} />
        );
      })}
    </motion.div>
  );
}

// ---------------- opening dialog (Figma "Opening screen") ----------------
export function OpeningDialog({ onTutorial, onSkip }: { onTutorial: () => void; onSkip: () => void }) {
  return (
    <>
      <motion.div className="abs" style={{ left: 0, right: 0, top: 160, textAlign: 'center', fontSize: 44, color: '#f2efc9', textShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 40 }}
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
        Welcome
      </motion.div>
      <motion.div className="paper abs" style={{ left: 45, top: 248, width: 289, height: 188, zIndex: 41 }}
        initial={{ y: -520 }} animate={{ y: 0 }} exit={{ y: -560, transition: { duration: 0.4, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 140, damping: 18, mass: 0.9, duration: 0.6 }}
        role="dialog" aria-label="Welcome">
        <p style={{ position: 'absolute', top: 22, left: 0, right: 0, margin: 0, textAlign: 'center', fontSize: 14, color: 'var(--text-primary)' }}>Have you played Blackjack before?</p>
        <motion.button className="dialog-btn abs" style={{ left: 62, top: 74, width: 165, whiteSpace: 'nowrap' }} whileTap={{ scale: 0.95 }} onClick={onTutorial}>No, I need a tutorial</motion.button>
        <motion.button className="dialog-btn abs" style={{ left: 62, top: 122, width: 165, whiteSpace: 'nowrap' }} whileTap={{ scale: 0.95 }} onClick={onSkip}>Yes, I know the rules</motion.button>
        <motion.button className="close-btn" style={{ left: 268, top: -8 }} whileTap={{ scale: 0.9 }} onClick={onSkip} aria-label="Close">✕</motion.button>
      </motion.div>
    </>
  );
}

const FLAME_D = 'M0,-46 C14,-26 34,-14 34,10 C34,32 18,46 0,46 C-18,46 -34,32 -34,10 C-34,-6 -24,-16 -16,-26 C-14,-14 -8,-8 -2,-6 C-6,-22 -4,-36 0,-46 Z';
function FlameBadge() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" style={{ display: 'block', margin: '0 auto 6px' }} aria-hidden>
      <defs><linearGradient id="fp-badge" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#FF8A1F" /><stop offset="1" stopColor="#F0442C" /></linearGradient></defs>
      <circle cx="26" cy="26" r="24" fill="url(#fp-badge)" stroke="#FFD23F" strokeWidth="2" />
      <path transform="translate(26 25) scale(.3)" fill="#FEFDD4" d={FLAME_D} />
    </svg>
  );
}

/** Between rounds once the Fever meter reaches 50 (doc: "Activate / Not right now"). */
export function FeverPrompt({ rounds, onActivate, onDecline }: { rounds: number; onActivate: () => void; onDecline: () => void }) {
  return (
    <motion.div className="sheet-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="paper abs" role="dialog" aria-label="Fever is ready"
        style={{ left: 45, top: 250, width: 300, padding: '20px 20px 22px', textAlign: 'center' }}
        initial={{ y: -420 }} animate={{ y: 0 }} exit={{ y: -420, transition: { duration: 0.35, ease: 'easeIn' } }}
        transition={{ type: 'spring', stiffness: 140, damping: 18 }}>
        <FlameBadge />
        <h3 style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 20 }}>Fever is ready!</h3>
        <p style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.45 }}>
          Activate Fever for the next {rounds} rounds. Wins pay <b>double</b> — but losses cost double too.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <motion.button className="dialog-btn" style={{ height: 36, padding: '0 14px', fontSize: 13 }} whileTap={{ scale: 0.95 }} onClick={onDecline}>Not right now</motion.button>
          <motion.button className="dialog-btn" style={{ height: 36, padding: '0 18px', fontSize: 13, background: 'var(--deal-green)' }} whileTap={{ scale: 0.95 }} onClick={onActivate}>Activate</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Mid-Fever, balance below 2 × minimum bet: Fever pauses until an ad is watched; skipping ends Fever.
 *  There are no ads yet, so "Watch ad" is a placeholder that refills the balance after a short wait. */
export function FeverPaused({ need, playing, onWatch, onSkip }: { need: number; playing: boolean; onWatch: () => void; onSkip: () => void }) {
  return (
    <motion.div className="sheet-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="paper abs" role="dialog" aria-label="Fever paused"
        style={{ left: 45, top: 270, width: 300, padding: '20px 20px 22px', textAlign: 'center' }}
        initial={{ y: -420 }} animate={{ y: 0 }} exit={{ y: -420 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }}>
        <FlameBadge />
        <h3 style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 20 }}>Fever paused</h3>
        <p style={{ margin: '0 0 16px', color: 'var(--text-primary)', fontSize: 12, lineHeight: 1.45 }}>
          Fever doubles losses, so you need at least ${need} to keep playing it. Watch an ad to keep Fever going, or skip to end Fever.
        </p>
        {playing ? (
          <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>Ad playing… (placeholder)</p>
        ) : (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <motion.button className="dialog-btn" style={{ height: 36, padding: '0 14px', fontSize: 13 }} whileTap={{ scale: 0.95 }} onClick={onSkip}>Skip · end Fever</motion.button>
            <motion.button className="dialog-btn" style={{ height: 36, padding: '0 18px', fontSize: 13, background: 'var(--deal-green)' }} whileTap={{ scale: 0.95 }} onClick={onWatch}>Watch ad</motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Not in Figma: shown when the balance can't cover the $5 minimum (no ads yet, so it's a free refill). */
export function OutOfCoins({ onClaim, amount }: { onClaim: () => void; amount: number }) {
  return (
    <motion.div className="sheet-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="paper abs" style={{ left: 45, top: 290, width: 300, padding: '24px 20px', textAlign: 'center' }}
        initial={{ y: -400 }} animate={{ y: 0 }} exit={{ y: -400 }} transition={{ type: 'spring', stiffness: 140, damping: 18 }}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 20 }}>Out of coins</h3>
        <p style={{ margin: '0 0 18px', color: 'var(--text-primary)', fontSize: 12 }}>You don’t have enough coins for the $5 minimum bet. Here’s a free refill so you can keep playing.</p>
        <motion.button className="dialog-btn" style={{ height: 36, padding: '0 18px', fontSize: 14 }} whileTap={{ scale: 0.95 }} onClick={onClaim}>
          Get {amount.toLocaleString('en-US')} coins
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
