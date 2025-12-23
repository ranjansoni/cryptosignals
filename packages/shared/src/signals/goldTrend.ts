import { Asset, SignalId, SignalResult, SignalState, OHLCV } from '../types';
import { calculateSMA, calculateSlope, getUTCNow, ohlcvToCloses } from '../utils';

export interface GoldTrendInput {
  symbol: string;
  ohlcv: OHLCV[];
  backend?: string;
}

/**
 * Gold Trend Signal (CONTEXT-ONLY)
 * 
 * Tracks Gold (via GLD ETF or XAUUSD) as a hedge/safe-haven indicator.
 * Gold strength often indicates:
 * - Flight to safety
 * - Inflation concerns
 * - Currency debasement fears
 * - Geopolitical uncertainty
 * 
 * Uses 200-day MA and slope to determine regime:
 * - HEDGE_ON: Price above rising 200D MA (hedging regime active)
 * - NEUTRAL: Otherwise
 * 
 * Note: This is context-only - only two states, no SELL.
 * Gold being weak doesn't necessarily mean "risk-on" - could be deflation or dollar strength.
 */

const MA_PERIOD = 200;
const SLOPE_LOOKBACK = 20;
const SLOPE_THRESHOLD = 0.0001; // Minimum slope to consider "rising"

export function computeGoldTrendSignal(
  input: GoldTrendInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (!input || !input.ohlcv || input.ohlcv.length < MA_PERIOD) {
    return {
      signalId: SignalId.GOLD_TREND,
      asset: Asset.GLOBAL,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: input ? 'insufficient_data' : 'missing_data',
        dataPoints: input?.ohlcv?.length || 0,
        required: MA_PERIOD,
        symbol: input?.symbol || 'unknown',
      },
    };
  }

  const { symbol, ohlcv, backend } = input;
  const closes = ohlcvToCloses(ohlcv);
  const currentPrice = closes[closes.length - 1];

  // Calculate 200-day MA
  const ma200 = calculateSMA(closes, MA_PERIOD);
  if (ma200 === null) {
    return {
      signalId: SignalId.GOLD_TREND,
      asset: Asset.GLOBAL,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'ma_calculation_failed',
        symbol,
      },
    };
  }

  // Calculate MA values for slope
  const maValues: number[] = [];
  for (let i = Math.max(0, closes.length - SLOPE_LOOKBACK); i <= closes.length; i++) {
    if (i >= MA_PERIOD) {
      const ma = calculateSMA(closes.slice(0, i), MA_PERIOD);
      if (ma !== null) {
        maValues.push(ma);
      }
    }
  }

  // Calculate slope (normalized by MA value)
  const slope = calculateSlope(maValues, maValues.length);
  const normalizedSlope = slope !== null && ma200 !== 0 ? slope / ma200 : 0;

  // Determine regime
  const priceAboveMA = currentPrice > ma200;
  const maRising = normalizedSlope > SLOPE_THRESHOLD;

  // Context-only states: only HEDGE_ON or NEUTRAL
  let state: SignalState;
  let regime: string;

  if (priceAboveMA && maRising) {
    state = SignalState.HEDGE_ON;
    regime = 'hedge_active';
  } else if (priceAboveMA) {
    // Price above MA but MA not rising - transitional
    state = SignalState.NEUTRAL;
    regime = 'hedge_weakening';
  } else {
    state = SignalState.NEUTRAL;
    regime = 'no_hedge_signal';
  }

  const deviation = ((currentPrice - ma200) / ma200) * 100;

  return {
    signalId: SignalId.GOLD_TREND,
    asset: Asset.GLOBAL,
    ts,
    state,
    rawJson: {
      symbol,
      backend: backend || 'stooq',
      currentPrice,
      ma200,
      deviation,
      slope: normalizedSlope,
      priceAboveMA,
      maRising,
      regime,
      dataPoints: closes.length,
    },
  };
}

