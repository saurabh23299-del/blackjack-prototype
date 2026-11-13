import { motion } from 'framer-motion';

/** Tunables for the Fever (high-stakes) look. */
export const FEVER_FX = {
  glowColor: '255, 122, 26',   // orange (rgb), matches the Fever meter's #FF7A1A glow
  glowPeriod: 1.8,             // seconds per pulse
  glowSize: 30,                // px of inset glow on each edge
  fireHeight: 96,              // px the fire reaches from the bottom edge
  fireOpacity: 0.6,            // overall strength — keep it subtle
  tongues: 15,
};

/** Orange glow pulsing on all four edges of the screen. Never blocks taps. */
export function FeverEdgeGlow() {
  const c = FEVER_FX.glowColor;
  return (
    <motion.div className="abs fever-glow"
      style={{ inset: 0, zIndex: 48, pointerEvents: 'none', borderRadius: 'inherit',
        boxShadow: `inset 0 0 ${FEVER_FX.glowSize}px ${FEVER_FX.glowSize / 4}px rgba(${c}, 0.85), inset 0 0 ${FEVER_FX.glowSize * 3}px rgba(${c}, 0.25)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.45, 1, 0.45] }}
      exit={{ opacity: 0, transition: { duration: 0.8 } }}
      transition={{ duration: FEVER_FX.glowPeriod, repeat: Infinity, ease: 'easeInOut' }} />
  );
}

/** Subtle flames licking up from the bottom edge: soft blurred tongues that flicker and sway.
 *  Sits above the table art but below cards, chips and buttons. */
export function FeverFire() {
  const n = FEVER_FX.tongues;
  return (
    <motion.div className="abs" style={{ left: 0, right: 0, bottom: 0, height: FEVER_FX.fireHeight + 20, zIndex: 9, pointerEvents: 'none', overflow: 'hidden' }}
      initial={{ opacity: 0 }} animate={{ opacity: FEVER_FX.fireOpacity }} exit={{ opacity: 0, transition: { duration: 0.8 } }}
      transition={{ duration: 1 }}>
      {/* ember bed */}
      <div className="abs" style={{ left: 0, right: 0, bottom: 0, height: 34,
        background: 'linear-gradient(to top, rgba(255,150,40,0.85), rgba(255,90,20,0.35) 55%, rgba(255,60,20,0))', filter: 'blur(4px)' }} />
      {Array.from({ length: n }, (_, i) => {
        // Deterministic variety so the fire looks organic without randomness on every render.
        const w = 38 + ((i * 37) % 30);
        const h = FEVER_FX.fireHeight * (0.55 + ((i * 53) % 45) / 100);
        const left = (i / (n - 1)) * 390 - w / 2 + (((i * 29) % 14) - 7);
        const dur = 1.1 + ((i * 41) % 9) / 10;
        const delay = ((i * 17) % 10) / 10;
        return (
          <motion.span key={i} className="abs"
            style={{ left, bottom: -6, width: w, height: h, originY: 1, filter: 'blur(5px)', mixBlendMode: 'screen',
              borderRadius: '50% 50% 42% 42% / 72% 72% 28% 28%',
              background: 'radial-gradient(ellipse at 50% 100%, rgba(255,226,120,0.95) 0%, rgba(255,140,30,0.75) 32%, rgba(240,68,44,0.35) 58%, rgba(240,68,44,0) 76%)' }}
            animate={{ scaleY: [0.7, 1.12, 0.82, 1.04, 0.7], scaleX: [1, 0.86, 1.06, 0.92, 1], x: [0, 3, -2, 2, 0], opacity: [0.55, 0.95, 0.65, 0.85, 0.55] }}
            transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }} />
        );
      })}
    </motion.div>
  );
}
