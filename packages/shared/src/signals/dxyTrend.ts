import { Asset, SignalId, SignalResult, SignalState } from '../types';
import { getUTCNow } from '../utils';

export interface DXYTrendInput {
  currentValue: number;
  sma20Week: number;
  trend: 'up' | 'down' | 'neutral';
}

/**
 * DXY (Dollar Index) Trend Signal (GLOBAL)
 *
 * DXY and crypto are generally inversely correlated:
 * - Strong dollar = headwind for crypto
 * - Weak dollar = tailwind for crypto
 *
 * Uses DXY vs 20-week SMA and trend direction:
 *
 * DXY well above SMA + uptrend: STRONG_SELL (strong dollar, bad for crypto)
 * DXY above SMA: SELL
 * DXY at SMA: NEUTRAL
 * DXY below SMA: BUY
 * DXY well below SMA + downtrend: STRONG_BUY (weak dollar, good for crypto)
 *
 * Thresholds:
 * - Deviation > 3% from SMA: Strong signal
 * - Deviation > 1.5% from SMA: Regular signal
 */
export function computeDXYTrendSignal(
  input: DXYTrendInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (!input || input.currentValue === undefined || input.sma20Week === undefined) {
    return {
      signalId: SignalId.DXY_TREND,
      asset: Asset.GLOBAL,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'missing_data',
        input: null,
      },
    };
  }

  const { currentValue, sma20Week, trend } = input;
  const deviation = ((currentValue - sma20Week) / sma20Week) * 100;

  let state: SignalState;

  // DXY above SMA = strong dollar = bearish for crypto
  // DXY below SMA = weak dollar = bullish for crypto
  if (deviation > 3 && trend === 'up') {
    state = SignalState.STRONG_SELL;
  } else if (deviation > 1.5) {
    state = SignalState.SELL;
  } else if (deviation < -3 && trend === 'down') {
    state = SignalState.STRONG_BUY;
  } else if (deviation < -1.5) {
    state = SignalState.BUY;
  } else {
    state = SignalState.NEUTRAL;
  }

  return {
    signalId: SignalId.DXY_TREND,
    asset: Asset.GLOBAL,
    ts,
    state,
    rawJson: {
      currentValue,
      sma20Week,
      deviation,
      trend,
      thresholds: {
        strongDeviation: 3,
        regularDeviation: 1.5,
      },
    },
  };
}

