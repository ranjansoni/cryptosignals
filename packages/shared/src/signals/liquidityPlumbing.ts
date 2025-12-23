import { Asset, SignalId, SignalResult, SignalState } from '../types';
import { getUTCNow } from '../utils';

export interface LiquidityPlumbingInput {
  tga: {
    seriesId: string;
    observations: { date: string; value: number }[];
    latestValue: number | null;
    latestDate: string | null;
  } | null;
  rrp: {
    seriesId: string;
    observations: { date: string; value: number }[];
    latestValue: number | null;
    latestDate: string | null;
  } | null;
}

/**
 * Liquidity Plumbing Signal (CONTEXT-ONLY)
 * 
 * Combines TGA (Treasury General Account) and RRP (Overnight Reverse Repo)
 * to measure net liquidity impulse in the financial system.
 * 
 * Mechanics:
 * - Rising TGA: Treasury accumulates cash, drains liquidity from system
 * - Rising RRP: Money parked at Fed, drains liquidity from system
 * - Falling TGA: Treasury spends, injects liquidity into system
 * - Falling RRP: Money returns to system, adds liquidity
 * 
 * Impulse = -(delta_TGA) - (delta_RRP)
 * Positive impulse = net liquidity injection (bullish)
 * Negative impulse = net liquidity drain (bearish)
 * 
 * States (context-only, no STRONG variants):
 * - BUY: Impulse in top 25% (strong liquidity injection)
 * - SELL: Impulse in bottom 25% (strong liquidity drain)
 * - NEUTRAL: Otherwise
 */

const LOOKBACK_WEEKS = 4; // 4-week delta for impulse calculation
const PERCENTILE_LOOKBACK = 104; // ~2 years of weekly data for percentile calculation

/**
 * Get value from N weeks ago
 */
function getValueWeeksAgo(
  observations: { date: string; value: number }[],
  weeksAgo: number
): number | null {
  if (observations.length === 0) return null;

  const latestDate = new Date(observations[0].date);
  const targetDate = new Date(latestDate);
  targetDate.setDate(targetDate.getDate() - weeksAgo * 7);

  // Find closest observation to target date
  let closest: { date: string; value: number } | null = null;
  let closestDiff = Infinity;

  for (const obs of observations) {
    const obsDate = new Date(obs.date);
    const diff = Math.abs(obsDate.getTime() - targetDate.getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = obs;
    }
  }

  // Only accept if within 10 days of target
  if (closest && closestDiff < 10 * 24 * 60 * 60 * 1000) {
    return closest.value;
  }

  return null;
}

/**
 * Calculate impulse values for percentile ranking
 */
function calculateImpulseHistory(
  tgaObs: { date: string; value: number }[],
  rrpObs: { date: string; value: number }[],
  lookbackWeeks: number,
  historyLength: number
): number[] {
  const impulses: number[] = [];

  // Calculate impulse for each week in history
  for (let i = 0; i < Math.min(historyLength, tgaObs.length - lookbackWeeks); i++) {
    const tgaCurrent = tgaObs[i]?.value;
    const tgaPast = getValueWeeksAgo(tgaObs.slice(i), lookbackWeeks);
    const rrpCurrent = rrpObs[i]?.value;
    const rrpPast = getValueWeeksAgo(rrpObs.slice(i), lookbackWeeks);

    if (tgaCurrent != null && tgaPast != null && rrpCurrent != null && rrpPast != null) {
      const deltaTGA = tgaCurrent - tgaPast;
      const deltaRRP = rrpCurrent - rrpPast;
      const impulse = -deltaTGA - deltaRRP;
      impulses.push(impulse);
    }
  }

  return impulses;
}

/**
 * Calculate percentile of a value in an array
 */
function calculatePercentile(value: number, values: number[]): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < value).length;
  return (below / sorted.length) * 100;
}

export function computeLiquidityPlumbingSignal(
  input: LiquidityPlumbingInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (!input || !input.tga || !input.rrp) {
    return {
      signalId: SignalId.LIQUIDITY_PLUMBING,
      asset: Asset.GLOBAL,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'missing_data',
        tgaAvailable: !!input?.tga,
        rrpAvailable: !!input?.rrp,
      },
    };
  }

  const { tga, rrp } = input;

  // Check for sufficient data
  if (
    !tga.observations.length ||
    !rrp.observations.length ||
    tga.latestValue == null ||
    rrp.latestValue == null
  ) {
    return {
      signalId: SignalId.LIQUIDITY_PLUMBING,
      asset: Asset.GLOBAL,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'insufficient_data',
        tgaDataPoints: tga.observations.length,
        rrpDataPoints: rrp.observations.length,
      },
    };
  }

  // Calculate current deltas
  const tgaPastValue = getValueWeeksAgo(tga.observations, LOOKBACK_WEEKS);
  const rrpPastValue = getValueWeeksAgo(rrp.observations, LOOKBACK_WEEKS);

  if (tgaPastValue == null || rrpPastValue == null) {
    return {
      signalId: SignalId.LIQUIDITY_PLUMBING,
      asset: Asset.GLOBAL,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'insufficient_lookback_data',
        lookbackWeeks: LOOKBACK_WEEKS,
      },
    };
  }

  const deltaTGA = tga.latestValue - tgaPastValue;
  const deltaRRP = rrp.latestValue - rrpPastValue;
  const currentImpulse = -deltaTGA - deltaRRP;

  // Calculate historical impulses for percentile
  const impulseHistory = calculateImpulseHistory(
    tga.observations,
    rrp.observations,
    LOOKBACK_WEEKS,
    PERCENTILE_LOOKBACK
  );

  const percentile = calculatePercentile(currentImpulse, impulseHistory);

  // Determine state based on percentile (context-only: no STRONG states)
  let state: SignalState;
  if (percentile >= 75) {
    // Top 25% = strong liquidity injection
    state = SignalState.BUY;
  } else if (percentile <= 25) {
    // Bottom 25% = strong liquidity drain
    state = SignalState.SELL;
  } else {
    state = SignalState.NEUTRAL;
  }

  return {
    signalId: SignalId.LIQUIDITY_PLUMBING,
    asset: Asset.GLOBAL,
    ts,
    state,
    rawJson: {
      tga: {
        seriesId: tga.seriesId,
        latestValue: tga.latestValue,
        latestDate: tga.latestDate,
        pastValue: tgaPastValue,
        delta: deltaTGA,
      },
      rrp: {
        seriesId: rrp.seriesId,
        latestValue: rrp.latestValue,
        latestDate: rrp.latestDate,
        pastValue: rrpPastValue,
        delta: deltaRRP,
      },
      impulse: currentImpulse,
      percentile,
      lookbackWeeks: LOOKBACK_WEEKS,
      historyLength: impulseHistory.length,
      interpretation:
        currentImpulse > 0
          ? 'net_liquidity_injection'
          : currentImpulse < 0
          ? 'net_liquidity_drain'
          : 'neutral',
    },
  };
}

