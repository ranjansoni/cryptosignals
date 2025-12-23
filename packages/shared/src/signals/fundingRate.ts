import { Asset, SignalId, SignalResult, SignalState } from '../types';
import { getUTCNow } from '../utils';

export interface FundingRateInput {
  fundingRate: number; // As percentage (e.g., 0.01 = 0.01%)
  nextFundingTime?: number;
}

/**
 * Funding Rate Signal
 *
 * Thresholds:
 * - STRONG_SELL: rate > 0.1% (extremely high, indicates overleveraged longs)
 * - SELL: rate > 0.05% (elevated longs)
 * - NEUTRAL: -0.01% <= rate <= 0.05%
 * - BUY: rate < -0.01% (negative funding, shorts paying longs)
 * - STRONG_BUY: rate < -0.03% (deeply negative, capitulation)
 *
 * Funding rate interpretation:
 * - Positive rate: Longs pay shorts (bullish sentiment, but can indicate top)
 * - Negative rate: Shorts pay longs (bearish sentiment, but can indicate bottom)
 * - Extreme rates often precede reversals
 */
export function computeFundingRateSignal(
  asset: Asset,
  input: FundingRateInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (!input || input.fundingRate === undefined || input.fundingRate === null) {
    return {
      signalId: SignalId.FUNDING_RATE,
      asset,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'missing_data',
        input: null,
      },
    };
  }

  const rate = input.fundingRate;
  let state: SignalState;

  // Determine signal state
  if (rate > 0.1) {
    // Extremely high funding = overleveraged longs, expect correction
    state = SignalState.STRONG_SELL;
  } else if (rate > 0.05) {
    // Elevated funding = longs dominant, cautious
    state = SignalState.SELL;
  } else if (rate < -0.03) {
    // Deeply negative = shorts dominant, capitulation signal
    state = SignalState.STRONG_BUY;
  } else if (rate < -0.01) {
    // Negative funding = shorts paying, potential reversal
    state = SignalState.BUY;
  } else {
    // Normal range
    state = SignalState.NEUTRAL;
  }

  return {
    signalId: SignalId.FUNDING_RATE,
    asset,
    ts,
    state,
    rawJson: {
      fundingRate: rate,
      nextFundingTime: input.nextFundingTime,
      thresholds: {
        strongSell: 0.1,
        sell: 0.05,
        buy: -0.01,
        strongBuy: -0.03,
      },
    },
  };
}

