/**
 * Positions in design units (the 390-wide Figma frame). The stage height H varies with the
 * device; `dh = 844 - H` is how much shorter it is than the Figma frame.
 * Top elements keep Figma's top offset, bottom elements keep Figma's distance from the bottom,
 * and the player hand sits in between.
 */
export const W = 390;
export const FIGMA_H = 844;
export const CARD_W = 86;
export const CARD_H = 132;

export const fromBottom = (figmaTop: number, height: number) => FIGMA_H - figmaTop - height;

export const SHOE = { x: 420, y: -170, rotate: -55 };          // off-canvas top-right: where cards come from
export const DISCARD = { x: -38, y: -52, rotate: -28 };        // top-left pile (Figma Tutorial 8)

export const DEALER_TOP = 150;
export const playerTop = (H: number) => 376 - (FIGMA_H - H) * 0.55;

/** Card x offsets for a fanned hand centered on cx, never wider than maxW. */
export function fan(count: number, cx: number, cardW: number, maxW: number, step: number): number[] {
  if (count === 0) return [];
  const off = count > 1 ? Math.min(step, (maxW - cardW) / (count - 1)) : 0;
  const width = cardW + off * (count - 1);
  const left = cx - width / 2;
  return Array.from({ length: count }, (_, i) => left + i * off);
}

/** Geometry for 1–4 player hands. One hand uses Figma's full-size layout; splits shrink to share the row. */
export function handSlots(n: number, H: number) {
  const top = playerTop(H);
  if (n <= 1) return [{ cx: 195, scale: 1, top, maxW: 176, bubble: { x: 291, y: top + CARD_H / 2 - 25, size: 50 } }];
  const scale = n === 2 ? 0.74 : n === 3 ? 0.58 : 0.48;
  const slotW = 380 / n;
  return Array.from({ length: n }, (_, k) => {
    const cx = 5 + slotW * (k + 0.5);
    const size = 40;
    return { cx, scale, top: top + 8, maxW: slotW - 6, bubble: { x: cx - size / 2, y: top + 8 + CARD_H * scale + 8, size } };
  });
}

// Figma positions (Tutorial-1 / Tutorial 2 frames). Bottom-anchored = distance from the stage bottom.
export const CHIP_RACK = [
  { value: 5, color: 'black', left: 11, bottom: fromBottom(635, 80) },
  { value: 15, color: 'red', left: 107, bottom: fromBottom(561, 80) },
  { value: 25, color: 'green', left: 203, bottom: fromBottom(561, 80) },
  { value: 50, color: 'blue', left: 299, bottom: fromBottom(635, 80) },
] as const;
/** In play: Figma Tutorial 2 position (chip under the hand, amount above it). */
export const BET_STACK = { left: 155, bottom: fromBottom(648, 80) };
export const BET_PILL_ROUND = { cx: 195, bottom: fromBottom(592, 36) };
/** While betting: the stack sits above the chip row and the amount above the stack. */
export const BET_STACK_BETTING = { left: 155, bottom: fromBottom(438, 80) };
export const BET_PILL_BETTING = { cx: 195, bottom: fromBottom(390, 36) };
export const PLACE_BET_TEXT = { bottom: fromBottom(466, 24) };
export const CLEAR_BTN = { left: 68, bottom: fromBottom(757, 50) };
export const DEAL_BTN = { left: 226, bottom: fromBottom(757, 50) };
export const ACTIONS = {
  hit: { left: 315, bottom: fromBottom(602, 60) },
  stand: { left: 315, bottom: fromBottom(678, 60) },
  split: { left: 236, bottom: fromBottom(755, 60) },
  double: { left: 316, bottom: fromBottom(755, 60) },
} as const;
export const BALANCE_TARGET = { x: 30, y: 52 };                // coin icon, for payout chips flying home
export const DEALER_BANK = { x: 195, y: 90 };                  // where lost chips go / won chips come from

export const chipColor = (value: number) => (value >= 50 ? 'blue' : value >= 25 ? 'green' : value >= 15 ? 'red' : 'black');
