import { Asset, SignalId, SignalResult, SignalState, OHLCV } from '../types';
import { calculateSMA, calculateSlope, getUTCNow, ohlcvToCloses } from '../utils';

export interface NasdaqTrendInput {
  symbol: string;
  ohlcv: OHLCV[];
  backend?: string;
}

/**
 * Nasdaq Trend Signal (CONTEXT-ONLY)
 * 
 * Tracks Nasdaq (via QQQ ETF) as a risk sentiment indicator.
 * Nasdaq/tech leadership often indicates:
 * - Risk appetite in the market
 * - Growth/momentum preference
 * - Liquidity flowing to risk assets
 * 
 * Uses 200-day MA and slope to determine regime:
 * - RISK_ON: Price above rising 200D MA (strong risk appetite)
 * - RISK_OFF: Price below falling 200D MA (risk aversion)
 * - NEUTRAL: Transitional/unclear
 * 
 * Note: This is context-only - no STRONG states.
 */

const MA_PERIOD = 200;
const SLOPE_LOOKBACK = 20;
const SLOPE_THRESHOLD = 0.0001; // Minimum slope to consider "rising" or "falling"

export function computeNasdaqTrendSignal(
  input: NasdaqTrendInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (!input || !input.ohlcv || input.ohlcv.length < MA_PERIOD) {
    return {
      signalId: SignalId.NASDAQ_TREND,
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
      signalId: SignalId.NASDAQ_TREND,
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
  const maFalling = normalizedSlope < -SLOPE_THRESHOLD;

  // Context-only states: RISK_ON, RISK_OFF, or NEUTRAL
  let state: SignalState;
  let regime: string;

  if (priceAboveMA && maRising) {
    // Strong uptrend = risk-on environment
    state = SignalState.RISK_ON;
    regime = 'risk_on_confirmed';
  } else if (!priceAboveMA && maFalling) {
    // Strong downtrend = risk-off environment
    state = SignalState.RISK_OFF;
    regime = 'risk_off_confirmed';
  } else if (priceAboveMA) {
    // Above MA but not rising strongly - cautiously bullish
    state = SignalState.NEUTRAL;
    regime = 'risk_on_weakening';
  } else if (!priceAboveMA && !maFalling) {
    // Below MA but not falling strongly - could be bottoming
    state = SignalState.NEUTRAL;
    regime = 'risk_off_moderating';
  } else {
    state = SignalState.NEUTRAL;
    regime = 'transitional';
  }

  const deviation = ((currentPrice - ma200) / ma200) * 100;

  return {
    signalId: SignalId.NASDAQ_TREND,
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
      maFalling,
      regime,
      dataPoints: closes.length,
    },
  };
}

