import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildShoe, canHit, canStand, cloneGame, createGame, nextRound, parseCard, topUp,
  CHIP_VALUES, PERSIST_BALANCE, START_BALANCE,
  type GameEvent, type GameState,
} from '../engine';
import {
  activateFever, canBetP, canDoubleP, canSplitP, cloneProgress, cloneTrack, coinsNeeded, createProgress, declineFever,
  doubleP, doubleShortP, feverReady, hitP, skipFeverAd, splitP, standP, startRoundP, PROGRESS_RULES,
  type Award, type Progress, type RoundTrack,
} from '../progression/progression';
import { NERVE_FLOAT } from './components/NerveFloat';
import { project } from './view';

export type Screen = 'opening' | 'table';
/** betting → round (events animating / player acting) → result (toast) → payout (chips move) → collect (cards leave) */
export type Stage = 'betting' | 'round' | 'result' | 'payout' | 'collect';
export type RulesMode = null | 'rules4' | 'rules6' | 'info';
export type Action = 'hit' | 'stand' | 'double' | 'split';

/** Animation rhythm taken from the reference video (seconds → ms). */
export const TIMING = {
  afterRound: 760,     // lights switch on before the first card
  afterCard: 560,      // ~0.42s travel + flip, next card starts as the previous one lands
  afterSplit: 480,
  afterDouble: 320,
  afterReveal: 680,
  resultHold: 1700,    // "YOU WON" banner stays ~1.5–1.7s
  payout: 760,
  collect: 720,
  fakeAd: 2500,        // placeholder "ad" while Fever is paused (no real ads yet)
} as const;

/** Tutorial (Figma Tutorial 2–7): fixed cards so the walkthrough matches the screens. 10♠ vs 10♦, 6♣, hole 8♣, hit 4♦. */
const TUTORIAL_CARDS = ['10S', '10D', '6C', '8C', '4D'];

const STORAGE_KEY = 'blackjack.balance';
function loadBalance(): number {
  if (!PERSIST_BALANCE) return START_BALANCE;
  try { const v = Number(localStorage.getItem(STORAGE_KEY)); return Number.isFinite(v) && v > 0 ? v : START_BALANCE; } catch { return START_BALANCE; }
}
function saveBalance(v: number) {
  if (!PERSIST_BALANCE) return;
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* storage unavailable */ }
}

function delayAfter(e: GameEvent): number {
  switch (e.t) {
    case 'round': return TIMING.afterRound;
    case 'card': return TIMING.afterCard;
    case 'split': return TIMING.afterSplit;
    case 'double': return TIMING.afterDouble;
    case 'reveal': return TIMING.afterReveal;
    default: return 0;
  }
}

/** What the XP pill and Fever meter show. It trails the real Progress so the meters move in step
 *  with the floating "+N NERVE" text, and is re-synced to the real values after every award run. */
export interface ShownProgress { nerve: number; meter: number; unlocked: boolean; roundsLeft: number }
const shownFrom = (p: Progress): ShownProgress => ({ nerve: p.nerveTotal, meter: p.fever.meter, unlocked: p.fever.unlocked, roundsLeft: p.fever.roundsLeft });

export interface FloatItem { id: number; points: number; label: string | null; index: number }
const AWARD_LABEL: Record<Award['kind'], string | null> = {
  blackjack: 'Blackjack', win: null, winDoubled: 'Double down', push: 'Push', brave: 'Brave Hit', sweep: 'Split sweep',
};

/** Dev-only test hooks: ?cards=8S,10H,... stacks the shoe; ?nerve=290 and ?meter=45 set progression. */
function devParam(name: string): string | null {
  return import.meta.env.DEV ? new URLSearchParams(location.search).get(name) : null;
}
function initialProgress(): Progress {
  const p = createProgress(Number(devParam('nerve') ?? 0) || 0);
  const meter = Number(devParam('meter') ?? 0);
  if (p.fever.unlocked && meter > 0) p.fever.meter = meter;
  return p;
}

export function useTable() {
  const [screen, setScreen] = useState<Screen>('opening');
  const [tutorial, setTutorial] = useState(0);              // 0 = off, 1–7 = Figma Tutorial screens
  const [game, setGame] = useState<GameState>(() => {
    const g = createGame({ balance: loadBalance() });
    const rig = devParam('cards');
    if (rig) g.shoe = [...rig.split(',').map(parseCard), ...g.shoe];
    return g;
  });
  const [prog, setProg] = useState<Progress>(initialProgress);
  const [track, setTrack] = useState<RoundTrack | null>(null);
  const [shown, setShown] = useState<ShownProgress>(() => shownFrom(prog));
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [unlockFlash, setUnlockFlash] = useState(false);
  const [adPlaying, setAdPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [stage, setStage] = useState<Stage>('betting');
  const [bet, setBet] = useState<number[]>([]);             // chip values placed, in order
  const [lastBet, setLastBet] = useState<number[]>([]);
  const [lastChip, setLastChip] = useState<number | null>(null);
  const [rules, setRules] = useState<RulesMode>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const noticeTimer = useRef<number>();
  const awardTimers = useRef<number[]>([]);
  const awardedFor = useRef<object | null>(null);
  const floatId = useRef(0);

  const events = game.events;
  const busy = cursor < events.length;
  const view = useMemo(() => project(events.slice(0, cursor)), [events, cursor]);
  const betTotal = bet.reduce((a, b) => a + b, 0);
  const feverActive = prog.fever.roundsLeft > 0;            // next round (or this betting phase) is a Fever round

  // ---- replay engine events one by one, at the video's rhythm ----
  useEffect(() => {
    if (cursor >= events.length) return;
    const wait = cursor === 0 ? 0 : delayAfter(events[cursor - 1]);
    const id = window.setTimeout(() => setCursor(c => c + 1), wait);
    return () => window.clearTimeout(id);
  }, [cursor, events]);

  // ---- round over: toast → payout → collect → back to betting with the same bet ----
  useEffect(() => {
    if (stage !== 'round' || busy || game.phase !== 'ROUND_OVER') return;
    setStage('result');
    const won = game.hands.some(h => h.result === 'win' || h.result === 'blackjack');
    if (won) navigator.vibrate?.([30, 40, 70]);
  }, [stage, busy, game]);

  useEffect(() => {
    if (stage === 'result') {
      const id = window.setTimeout(() => setStage('payout'), TIMING.resultHold);
      return () => window.clearTimeout(id);
    }
    if (stage === 'payout') {
      const id = window.setTimeout(() => setStage('collect'), TIMING.payout);
      return () => window.clearTimeout(id);
    }
    if (stage === 'collect') {
      const id = window.setTimeout(() => {
        setGame(g => { const n = cloneGame(g); nextRound(n); return n; });
        setCursor(0);
        setRoundsPlayed(r => r + 1);
        setStage('betting');
        setTutorial(t => (t === 7 ? 0 : t));
      }, TIMING.collect);
      return () => window.clearTimeout(id);
    }
  }, [stage]);

  // ---- Nerve awards: one floating "+N NERVE" per award, meters step up as each one starts ----
  useEffect(() => {
    const res = track?.result;
    if (stage !== 'result' || !res || awardedFor.current === res) return;
    awardedFor.current = res;
    const before = res.progressBefore;
    setShown(s => ({ ...s, roundsLeft: res.progressAfter.fever.roundsLeft }));
    let nerve = before.nerveTotal;
    res.awards.forEach((a, i) => {
      awardTimers.current.push(window.setTimeout(() => {
        const crossed = !before.fever.unlocked && nerve < PROGRESS_RULES.feverUnlockAt && nerve + a.points >= PROGRESS_RULES.feverUnlockAt;
        nerve += a.points;
        setFloats(f => [...f, { id: ++floatId.current, points: a.points, label: AWARD_LABEL[a.kind], index: i }]);
        setShown(s => ({ ...s, nerve: s.nerve + a.points, meter: res.fillsMeter ? s.meter + a.points : s.meter, unlocked: s.unlocked || crossed }));
        if (crossed) { setUnlockFlash(true); awardTimers.current.push(window.setTimeout(() => setUnlockFlash(false), 2600)); }
      }, i * NERVE_FLOAT.stagger * 1000));
    });
    // Final sync so the meters always end on the real state.
    awardTimers.current.push(window.setTimeout(() => setShown(shownFrom(res.progressAfter)), res.awards.length * NERVE_FLOAT.stagger * 1000 + 50));
  }, [stage, track]);
  useEffect(() => () => awardTimers.current.forEach(id => window.clearTimeout(id)), []);
  const removeFloat = useCallback((id: number) => setFloats(f => f.filter(x => x.id !== id)), []);

  // Re-place the previous bet when a new betting round opens (reference video + Figma Tutorial 8).
  useEffect(() => {
    if (stage !== 'betting') return;
    saveBalance(game.balance);
    const total = lastBet.reduce((a, b) => a + b, 0);
    if (total > 0 && canBetP(game, prog, total)) setBet(lastBet);
    else setBet([]);
    setLastChip(null);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1800);
  }, []);

  // ---- betting ----
  const tapChip = (index: number) => {
    if (stage !== 'betting' || screen !== 'table' || rules) return;
    const value = CHIP_VALUES[index];
    const next = betTotal + value;
    if (next > game.rules.maxBet) return flash(`Maximum bet is $${game.rules.maxBet}`);
    if (next > game.balance) return flash('Not enough coins for that chip');
    if (feverActive && next * 2 > game.balance) return flash('Fever: you need 2× your bet in coins');
    setBet(b => [...b, value]);
    setLastChip(index);
  };

  const clearBet = () => {
    if (stage !== 'betting') return;
    setBet([]); setLastChip(null);
  };

  const deal = () => {
    if (stage !== 'betting' || !canBetP(game, prog, betTotal)) return;
    const n = cloneGame(game);
    const p = cloneProgress(prog);
    if (tutorial === 1) {
      // Scripted tutorial deal, then a normal shuffled shoe behind it.
      n.shoe = [...TUTORIAL_CARDS.map(parseCard), ...buildShoe(n.rules.deckCount, n.rng)];
      n.next = 0;
      setTutorial(2);
    }
    const t = startRoundP(n, p, betTotal);
    setLastBet(bet);
    setGame(n); setProg(p); setTrack(t);
    setCursor(0);
    setStage('round');
  };

  // ---- player actions ----
  const tutorialAllows = (a: Action) =>
    tutorial === 0 ? true : tutorial === 5 ? a === 'hit' : tutorial === 6 ? a === 'stand' : false;

  const ready = !busy && stage === 'round' && !rules;
  const can = {
    hit: ready && canHit(game) && tutorialAllows('hit'),
    stand: ready && canStand(game) && tutorialAllows('stand'),
    double: ready && canDoubleP(game, track) && tutorialAllows('double'),
    split: ready && canSplitP(game, track) && tutorialAllows('split'),
  };
  const doubleShort = ready && tutorial === 0 ? doubleShortP(game, track) : 0;

  const act = (a: Action) => {
    if (!can[a] || !track) return;
    const n = cloneGame(game);
    const p = cloneProgress(prog);
    const t = cloneTrack(track)!;
    ({ hit: hitP, stand: standP, double: doubleP, split: splitP })[a](n, p, t);
    setGame(n); setProg(p); setTrack(t);
    if (tutorial === 5) setTutorial(6);
    else if (tutorial === 6) setTutorial(7);
  };

  // ---- Fever ----
  const showFeverPrompt = screen === 'table' && stage === 'betting' && !rules && tutorial === 0 && feverReady(game, prog);
  const chooseFever = (activate: boolean) => {
    const p = cloneProgress(prog);
    if (activate) activateFever(game, p); else declineFever(game, p);
    setProg(p);
    setShown(shownFrom(p));
    // A re-placed bet that can't cover Fever's doubled losses is taken back.
    if (activate && betTotal > 0 && betTotal * 2 > game.balance) { setBet([]); flash('Fever: you need 2× your bet in coins'); }
  };
  const need = screen === 'table' && stage === 'betting' && bet.length === 0 && !rules ? coinsNeeded(game, prog) : 'none';
  const watchAd = () => {
    setAdPlaying(true);
    window.setTimeout(() => {
      setGame(g => { const n = cloneGame(g); topUp(n, START_BALANCE); return n; });
      setAdPlaying(false);
    }, TIMING.fakeAd);
  };
  const skipAd = () => {
    const p = cloneProgress(prog);
    skipFeverAd(p);
    setProg(p); setShown(shownFrom(p));
  };

  // ---- flow ----
  const startTutorial = () => { setScreen('table'); setTutorial(1); };
  const skipTutorial = () => { setScreen('table'); setTutorial(0); };
  /** Tutorial 2 → 3: the player reads the hand totals, then taps Next to open the Basic Rules. */
  const tutorialNext = () => {
    if (tutorial !== 2 || busy || stage !== 'round') return;
    setTutorial(3);
    setRules('rules4');
  };
  const rulesNext = () => { setRules('rules6'); setTutorial(4); };
  const rulesContinue = () => {
    setRules(null);
    if (tutorial === 4) setTutorial(5);
  };
  const openInfo = () => { if (!rules && tutorial === 0) setRules('info'); };
  const claimTopUp = () => setGame(g => { const n = cloneGame(g); topUp(n, START_BALANCE); return n; });

  /** Refresh button: abandons any round in progress and starts over — fresh shoe, starting balance, Nerve 0. */
  const resetTable = () => {
    awardTimers.current.forEach(id => window.clearTimeout(id));
    awardTimers.current = [];
    const p = createProgress();
    setGame(createGame({ balance: START_BALANCE }));
    setProg(p); setTrack(null); setShown(shownFrom(p)); setFloats([]); setUnlockFlash(false); setAdPlaying(false);
    saveBalance(START_BALANCE);
    setCursor(0);
    setStage('betting');
    setBet([]);
    setLastBet([]);
    setLastChip(null);
    setRules(null);
    setNotice(null);
    setTutorial(0);
    setRoundsPlayed(0);
  };

  // ---- what the balance pill shows ----
  let balance = game.balance;
  if (stage === 'betting') balance = game.balance - betTotal;
  else if (stage === 'round' || stage === 'result') {
    // Before payout, show the balance as it was just before settlement.
    const shownEvents = events.slice(0, cursor);
    const lastBeforeSettle = [...shownEvents].reverse().find(e => e.t !== 'settle');
    balance = lastBeforeSettle?.balance ?? game.balance;
  }

  // Fever applies to the round on the table (track), or to the next round while betting.
  const roundIsFever = stage === 'betting' ? feverActive : !!track?.feverRound;

  return {
    screen, tutorial, game, view, stage, busy, bet, betTotal, lastChip, rules, notice, roundsPlayed, balance, can, doubleShort,
    outOfCoins: need === 'normal', feverPaused: need === 'fever', adPlaying,
    prog, track, shown, floats, removeFloat, unlockFlash, showFeverPrompt, roundIsFever,
    tapChip, clearBet, deal, act, startTutorial, skipTutorial, tutorialNext, rulesNext, rulesContinue, openInfo, claimTopUp, resetTable,
    chooseFever, watchAd, skipAd,
    canDeal: stage === 'betting' && canBetP(game, prog, betTotal),
  };
}

export type TableModel = ReturnType<typeof useTable>;
