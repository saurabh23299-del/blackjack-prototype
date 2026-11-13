import { AnimatePresence, motion } from 'framer-motion';
import type { FloatItem } from '../useTable';

/**
 * Floating "+N NERVE" text. Tune everything here.
 * Starts at the centre of the screen (16px, #FFFFFF, 100% opacity), rises to the top edge while
 * drifting sideways, and fades continuously to 0% so it is gone exactly when it reaches the top.
 */
export const NERVE_FLOAT = {
  duration: 2.6,                       // seconds from centre to top
  stagger: 0.5,                      // seconds between consecutive awards (each gets its own float)
  drift: 28,                           // px of horizontal travel at the top
  driftAlternates: true,               // alternate left/right so stacked awards don't overlap
  riseEase: [0.32, 0, 0.18, 1] as const,   // vertical: eases in, glides, settles at the top
  driftEase: [0.45, 0, 0.55, 1] as const,  // horizontal: smooth S-curve
  fadeEase: 'linear' as const,         // opacity falls continuously 1 → 0
  fontSize: 16,
  color: '#FFFFFF',
};

export function NerveFloats({ items, H, onDone }: { items: FloatItem[]; H: number; onDone: (id: number) => void }) {
  const C = NERVE_FLOAT;
  return (
    <div className="abs" style={{ inset: 0, zIndex: 70, pointerEvents: 'none' }}>
      <AnimatePresence>
        {items.map(it => {
          const dir = C.driftAlternates && it.index % 2 === 1 ? -1 : 1;
          const drift = dir * C.drift * (1 + (it.index % 3) * 0.18);
          return (
            <motion.div key={it.id} className="nerve-float"
              style={{ top: 0, left: 0, width: 390, fontSize: C.fontSize, color: C.color }}
              initial={{ x: 0, y: H / 2 - 12, opacity: 1 }}
              animate={{ x: [0, drift * 0.35, drift], y: -24, opacity: 0 }}
              transition={{
                y: { duration: C.duration, ease: C.riseEase },
                x: { duration: C.duration, ease: C.driftEase, times: [0, 0.5, 1] },
                opacity: { duration: C.duration, ease: C.fadeEase },
              }}
              onAnimationComplete={() => onDone(it.id)}>
              <span className="amount">+{it.points} NERVE</span>
              {it.label && <span className="why">{it.label}</span>}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
