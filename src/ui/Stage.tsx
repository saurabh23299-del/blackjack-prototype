import { useEffect, useState, type ReactNode } from 'react';
import { FIGMA_H, W } from './layout';

const MIN_H = 740;   // below this the layout gets cramped, so we scale down instead
const MAX_H = 940;

/**
 * Fits the 390-wide Figma layout to the device.
 * Phones (≤ 520px wide): fill the width; the stage height follows the screen (740–940 design units),
 * so top items stay at the top and the thumb controls stay at the bottom.
 * Desktop/tablet: a centred 390×844 phone-sized table, scaled down only if the window is short.
 */
function measure() {
  const vv = window.visualViewport;
  const vw = vv?.width ?? window.innerWidth;
  const vh = vv?.height ?? window.innerHeight;
  if (vw <= 520) {
    let s = vw / W;
    let H = vh / s;
    if (H < MIN_H) { H = MIN_H; s = vh / MIN_H; }
    if (H > MAX_H) H = MAX_H;
    return { s, H, vw, vh };
  }
  const H = FIGMA_H;
  const s = Math.min(1, (vh - 24) / H);
  return { s, H, vw, vh };
}

export function Stage({ children }: { children: (H: number) => ReactNode }) {
  const [m, setM] = useState(measure);
  useEffect(() => {
    const on = () => setM(measure());
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => { window.removeEventListener('resize', on); window.visualViewport?.removeEventListener('resize', on); };
  }, []);
  return (
    <div className="viewport">
      <div className="stage" style={{ height: m.H, transform: `scale(${m.s}) translate(-50%, -50%)` }}>
        {children(m.H)}
      </div>
    </div>
  );
}
