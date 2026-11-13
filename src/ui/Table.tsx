import { AnimatePresence, motion } from 'framer-motion';
import { handValue, START_BALANCE } from '../engine';
import {
  ACTIONS, CLEAR_BTN, BET_PILL_BETTING, BET_PILL_ROUND, BET_STACK, BET_STACK_BETTING, CARD_H, CHIP_RACK, DEALER_TOP, PLACE_BET_TEXT, handSlots, playerTop,
} from './layout';
import { useTable } from './useTable';
import { dealerTotal, playerTotal, totalStake, type TableView } from './view';
import { CardLayer, DiscardPile } from './components/CardLayer';
import { ActionBar, BetButtons } from './components/Controls';
import {
  BalanceTip, DealTip, FeverPaused, FeverPrompt, OpeningDialog, OutOfCoins, ResultToast, RulesOverlay, Tip, type ResultSummary,
} from './components/Overlays';
import {
  BalancePill, BetPill, BetStack, ChipRack, InfoButton, RefreshButton, SettingsIcon, TableBackground, TotalBubble, stakeToChips, type StackMode,
} from './components/TableParts';
import { FeverMeter, XpMeter } from './components/Meters';
import { NerveFloats } from './components/NerveFloat';
import { FeverEdgeGlow, FeverFire } from './components/FeverEffects';
import { PROGRESS_RULES } from '../progression/progression';

/** `mult` = 2 for a Fever round (net wins and losses are doubled on top of the core payout). */
function summarize(v: TableView, mult: number): ResultSummary | null {
  if (!v.settled || v.hands.length === 0) return null;
  const net = v.hands.reduce((s, h) => s + (h.coinsNet ?? 0), 0) * mult;
  const money = (net > 0 ? `+$${net}` : net < 0 ? `−$${-net}` : 'Bet returned') + (mult > 1 && net !== 0 ? ' · Fever ×2' : '');
  if (v.hands.length === 1) {
    const h = v.hands[0];
    const total = handValue(h.cards.map(c => c.card)).total;
    const dealer = handValue(v.dealer.map(c => c.card)).total;
    switch (h.result) {
      case 'blackjack': return { kind: 'blackjack', title: 'Blackjack!', sub: `Pays 3 to 2 · ${money}` };
      case 'win': return { kind: 'win', title: 'You Win', sub: dealer > 21 ? `Dealer busts · ${money}` : money };
      case 'push': return { kind: 'push', title: 'Push', sub: money };
      default: return { kind: 'lose', title: total > 21 ? 'Bust' : 'You Lose', sub: v.dealer.length === 2 && dealer === 21 ? `Dealer Blackjack · ${money}` : money };
    }
  }
  const wins = v.hands.filter(h => h.result === 'win' || h.result === 'blackjack').length;
  const losses = v.hands.filter(h => h.result === 'lose').length;
  const pushes = v.hands.length - wins - losses;
  const parts = [wins && `${wins} won`, losses && `${losses} lost`, pushes && `${pushes} push`].filter(Boolean).join(' · ');
  return { kind: net > 0 ? 'win' : net < 0 ? 'lose' : 'push', title: net > 0 ? 'You Win' : net < 0 ? 'You Lose' : 'Push', sub: `${parts} · ${money}` };
}

export function Table({ H }: { H: number }) {
  const t = useTable();
  const { view, stage, tutorial } = t;
  const inRound = stage !== 'betting';
  const slots = handSlots(view.hands.length, H);
  const mult = t.track?.result?.feverRound ? 2 : 1;
  const summary = stage === 'result' || stage === 'payout' ? summarize(view, mult) : null;
  const net = view.hands.reduce((s, h) => s + (h.coinsNet ?? 0), 0);
  const stackMode: StackMode = stage === 'payout' ? (net > 0 ? 'win' : net < 0 ? 'lose' : 'push') : 'idle';
  const stackChips = stage === 'betting' ? t.bet : stage === 'collect' ? [] : view.hands.length && totalStake(view) !== t.betTotal ? stakeToChips(totalStake(view)) : t.bet;
  const toastTop = (DEALER_TOP + CARD_H + playerTop(H)) / 2 - 33;
  const showXp = t.screen === 'table' && tutorial !== 1;
  const showInfo = t.screen === 'table' && (tutorial === 0 || tutorial >= 5);
  const actionsVisible = inRound && stage !== 'collect' && (view.dealer.length >= 2 || view.settled) && tutorial !== 3 && tutorial !== 4;
  const firstBubbleTop = DEALER_TOP + CARD_H / 2 - 25;
  const pBubble = slots[0]?.bubble;

  return (
    <>
      <TableBackground lit={inRound} fever={t.screen === 'table' && t.roundIsFever} />
      {/* High-stakes look for the 3 Fever rounds: orange pulsing edges + subtle fire at the bottom. */}
      <AnimatePresence>
        {t.screen === 'table' && t.roundIsFever && <FeverFire key="fire" />}
      </AnimatePresence>
      <AnimatePresence>
        {t.screen === 'table' && t.roundIsFever && <FeverEdgeGlow key="glow" />}
      </AnimatePresence>
      {t.roundsPlayed > 0 && <DiscardPile />}

      {/* top bar */}
      <BalancePill balance={t.balance} />
      {showXp && <XpMeter nerve={t.shown.nerve} unlocked={t.shown.unlocked} />}
      <AnimatePresence>
        {t.screen === 'table' && t.shown.unlocked && <FeverMeter key="fever" p={t.shown} />}
        {t.unlockFlash && (
          <motion.div key="unlock" className="fever-flash" initial={{ x: -20, opacity: 0, scale: 0.8 }} animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: -10 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
            FEVER UNLOCKED!
          </motion.div>
        )}
      </AnimatePresence>
      <SettingsIcon />
      <AnimatePresence>{showInfo && <InfoButton key="info" onClick={t.openInfo} disabled={tutorial !== 0 || !!t.rules} />}</AnimatePresence>
      {t.screen === 'table' && <RefreshButton onClick={t.resetTable} />}

      {/* cards and totals */}
      <div className="abs" style={{ inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        <CardLayer view={view} H={H} collecting={stage === 'collect'} />
      </div>
      <AnimatePresence>
        {inRound && stage !== 'collect' && view.dealer.length > 0 && (
          <TotalBubble key="dealer-total" label={dealerTotal(view)} x={291} y={firstBubbleTop} />
        )}
        {inRound && stage !== 'collect' && view.hands.map((h, i) => h.cards.length > 0 && (
          <TotalBubble key={`hand-${i}-${view.hands.length}`} label={playerTotal(view, i)} x={slots[i].bubble.x} y={slots[i].bubble.y}
            size={slots[i].bubble.size} active={view.hands.length > 1 && view.active === i && !t.busy} />
        ))}
      </AnimatePresence>
      {/* split hands: stake and result under each hand */}
      {inRound && stage !== 'collect' && view.hands.length > 1 && view.hands.map((h, i) => (
        <motion.div key={`tag-${i}`} className={h.result ? `hand-tag ${h.result}` : 'stake-tag'}
          style={{ left: slots[i].cx - 30, width: 60, textAlign: 'center', top: slots[i].bubble.y + slots[i].bubble.size + 6, zIndex: 36 }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {h.result ? (h.result === 'blackjack' ? 'BJ' : h.result === 'win' ? `+$${(h.coinsNet ?? 0) * mult}` : h.result === 'push' ? 'Push' : handValue(h.cards.map(c => c.card)).total > 21 ? 'Bust' : `−$${h.stake * mult}`) : `$${h.stake}${h.doubled ? ' (dbl)' : ''}`}
        </motion.div>
      ))}

      {/* betting */}
      <AnimatePresence>
        {t.screen === 'table' && stage === 'betting' && (
          <ChipRack key="rack" H={H} onTap={t.tapChip} selected={t.lastChip} bob={tutorial === 1} disabled={!!t.rules} />
        )}
      </AnimatePresence>
      {t.screen === 'table' && stage === 'betting' && t.betTotal === 0 && tutorial !== 1 && (
        <motion.div className="place-bet" style={{ top: H - PLACE_BET_TEXT.bottom - 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Place bet</motion.div>
      )}
      <AnimatePresence>
        {t.notice && (
          <motion.div key="notice" className="hint" style={{ top: H - BET_PILL_BETTING.bottom - 64, zIndex: 46 }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{t.notice}</motion.div>
        )}
      </AnimatePresence>
      <BetStack chips={stackChips} H={H} mode={stackMode} pos={stage === 'betting' ? BET_STACK_BETTING : BET_STACK}
        sourceOf={v => {
          if (stage !== 'betting') return null;
          const c = CHIP_RACK.find(r => r.value === v)!;
          return { x: c.left, y: H - c.bottom - 80 };
        }} />
      {t.betTotal > 0 && stage !== 'collect' && stage !== 'payout' && (
        stage === 'betting'
          ? <BetPill amount={t.betTotal} cx={BET_PILL_BETTING.cx} top={H - BET_PILL_BETTING.bottom - 36} />
          : <BetPill amount={totalStake(view) || t.betTotal} cx={BET_PILL_ROUND.cx} top={H - BET_PILL_ROUND.bottom - 36} />
      )}
      <AnimatePresence>
        {t.screen === 'table' && t.roundIsFever && stage !== 'collect' && stage !== 'payout' && (
          <motion.div key="fever-tag" className="fever-tag"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            style={{ left: 232, top: (stage === 'betting' ? H - BET_PILL_BETTING.bottom - 36 : H - BET_PILL_ROUND.bottom - 36) + 7 }}>
            FEVER ×2
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {t.screen === 'table' && stage === 'betting' && (
          <BetButtons key="betbtns" H={H} canClear={t.betTotal > 0 && !t.rules} canDeal={t.canDeal && !t.rules} onClear={t.clearBet} onDeal={t.deal} />
        )}
      </AnimatePresence>

      {/* player actions */}
      <AnimatePresence>
        {actionsVisible && <ActionBar key="actions" H={H} can={t.can} onAct={t.act} />}
      </AnimatePresence>
      <AnimatePresence>
        {t.doubleShort > 0 && actionsVisible && (
          <Tip key="short" dir="down" tail={79} style={{ left: 236, width: 110, top: H - ACTIONS.double.bottom - 60 - 52, fontSize: 10 }}>
            Need ${t.doubleShort} more to double
          </Tip>
        )}
      </AnimatePresence>

      {/* result */}
      <AnimatePresence>{summary && <ResultToast key="toast" summary={summary} top={toastTop} />}</AnimatePresence>

      {/* tutorial (Figma Tutorial 1–7) */}
      <AnimatePresence>
        {tutorial === 1 && stage === 'betting' && <motion.div key="dim" className="dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
      {tutorial === 1 && stage === 'betting' && (
        <>
          <BalanceTip />
          {/* The deal tip sits where the bet stack goes, so it steps aside once a chip is placed. */}
          {t.betTotal === 0 && <DealTip top={H - (844 - 456)} />}
        </>
      )}
      <AnimatePresence>
        {tutorial === 2 && !t.busy && pBubble && (
          <motion.div key="t2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Tip dir="up" tail={48} style={{ left: 268, top: firstBubbleTop + 58, width: 100 }}>Dealers hand total</Tip>
            <Tip dir="up" tail={48} style={{ left: 268, top: pBubble.y + 58, width: 100 }}>Your hand total</Tip>
          </motion.div>
        )}
        {tutorial === 2 && !t.busy && !t.rules && (
          // Bottom-left, in the free thumb zone beside the action buttons; same style as the rules "Next >" button.
          <motion.button key="t2-next" className="gold-btn green" onClick={t.tutorialNext}
            style={{ left: 24, top: H - CLEAR_BTN.bottom - 50, width: 120, zIndex: 41 }}
            initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.3 }}
            whileTap={{ scale: 0.92, filter: 'brightness(0.8)' }}>
            Next &gt;
          </motion.button>
        )}
        {tutorial === 5 && !t.rules && !t.busy && (
          <Tip key="t5" dir="down" tail={60} style={{ left: 285, width: 98, top: H - ACTIONS.hit.bottom - 60 - 62 }}>Press hit to draw another card</Tip>
        )}
        {tutorial === 6 && !t.busy && (
          <Tip key="t6" dir="down" tail={63} style={{ left: 282, width: 104, top: H - ACTIONS.stand.bottom - 60 - 74 }}>Press Stand to keep your current hand and end your turn</Tip>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {t.rules && <RulesOverlay key="rules" mode={t.rules} onNext={t.rulesNext} onContinue={t.rulesContinue} />}
      </AnimatePresence>

      <AnimatePresence>
        {t.screen === 'opening' && <OpeningDialog key="opening" onTutorial={t.startTutorial} onSkip={t.skipTutorial} />}
      </AnimatePresence>
      <AnimatePresence>{t.outOfCoins && <OutOfCoins key="ooc" amount={START_BALANCE} onClaim={t.claimTopUp} />}</AnimatePresence>
      <AnimatePresence>
        {t.feverPaused && <FeverPaused key="fp" need={2 * t.game.rules.minBet} playing={t.adPlaying} onWatch={t.watchAd} onSkip={t.skipAd} />}
      </AnimatePresence>
      <AnimatePresence>
        {t.showFeverPrompt && !t.feverPaused && (
          <FeverPrompt key="fever-prompt" rounds={PROGRESS_RULES.feverRounds} onActivate={() => t.chooseFever(true)} onDecline={() => t.chooseFever(false)} />
        )}
      </AnimatePresence>

      {/* Nerve points float above everything and never block taps */}
      <NerveFloats items={t.floats} H={H} onDone={t.removeFloat} />
    </>
  );
}
