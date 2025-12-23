import { Asset, SignalId, SignalResult, SignalState } from '../types';
import { calculateSMA, calculateSlope, getUTCNow } from '../utils';

export interface MA200RegimeInput {
  closes: number[]; // Array of closing prices (oldest first)
  currentPrice: number;
  // Additional CoinGecko market data
  high24h?: number;
  low24h?: number;
  ath?: number;
  athDate?: string;
  athChangePct?: number;
  marketCap?: number;
  marketCapRank?: number;
  totalVolume?: number;
}

/**
 * 200-Day Moving Average Regime Signal
 *
 * Combines price position relative to 200 MA with MA slope:
 *
 * Price > MA + MA Rising: STRONG_BUY (strong uptrend)
 * Price > MA + MA Flat/Falling: BUY (uptrend losing momentum)
 * Price < MA + MA Rising/Flat: SELL (recovery potential but below trend)
 * Price < MA + MA Falling: STRONG_SELL (strong downtrend)
 *
 * Thresholds:
 * - Price deviation > 20% from MA: Extreme levels
 * - Slope measured over 20 periods
 */
export function computeMA200RegimeSignal(
  asset: Asset,
  input: MA200RegimeInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (!input || !input.closes || input.closes.length < 200) {
    return {
      signalId: SignalId.MA_200_REGIME,
      asset,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'insufficient_data',
        dataPoints: input?.closes?.length || 0,
        required: 200,
      },
    };
  }

  const { closes, currentPrice } = input;

  // Calculate 200-day SMA
  const ma200 = calculateSMA(closes, 200);
  if (ma200 === null) {
    return {
      signalId: SignalId.MA_200_REGIME,
      asset,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'ma_calculation_failed',
      },
    };
  }

  // Calculate MA values for last 20 periods to get slope
  const maValues: number[] = [];
  for (let i = Math.max(0, closes.length - 20); i <= closes.length; i++) {
    const sliceEnd = i;
    if (sliceEnd >= 200) {
      const ma = calculateSMA(closes.slice(0, sliceEnd), 200);
      if (ma !== null) {
        maValues.push(ma);
      }
    }
  }

  // Calculate slope of MA (normalized by MA value)
  const slope = calculateSlope(maValues, maValues.length);
  const normalizedSlope = slope !== null && ma200 !== 0 ? (slope / ma200) * 100 : 0;

  // Determine regime
  const priceAboveMA = currentPrice > ma200;
  const deviation = ((currentPrice - ma200) / ma200) * 100;

  // Slope thresholds (as percentage)
  const maRising = normalizedSlope > 0.01; // MA rising > 0.01% per period
  const maFalling = normalizedSlope < -0.01;

  let state: SignalState;
  let regime: string;

  if (priceAboveMA) {
    if (maRising) {
      regime = 'strong_uptrend';
      state = deviation > 20 ? SignalState.SELL : SignalState.STRONG_BUY; // Extreme deviation = mean reversion
    } else if (maFalling) {
      regime = 'uptrend_weakening';
      state = SignalState.NEUTRAL;
    } else {
      regime = 'uptrend_consolidating';
      state = SignalState.BUY;
    }
  } else {
    if (maFalling) {
      regime = 'strong_downtrend';
      state = deviation < -20 ? SignalState.BUY : SignalState.STRONG_SELL; // Extreme oversold = bounce potential
    } else if (maRising) {
      regime = 'downtrend_recovering';
      state = SignalState.NEUTRAL;
    } else {
      regime = 'downtrend_consolidating';
      state = SignalState.SELL;
    }
  }

  // Calculate additional metrics
  const ma50 = closes.length >= 50 ? calculateSMA(closes, 50) : null;
  const ma20 = closes.length >= 20 ? calculateSMA(closes, 20) : null;
  
  // Trend strength (distance from MA as multiple of recent volatility)
  const recentCloses = closes.slice(-20);
  const avgPrice = recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;
  const volatility = Math.sqrt(recentCloses.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / recentCloses.length);
  const trendStrength = volatility > 0 ? Math.abs(currentPrice - ma200) / volatility : 0;

  return {
    signalId: SignalId.MA_200_REGIME,
    asset,
    ts,
    state,
    rawJson: {
      // Core MA data
      currentPrice,
      ma200,
      ma50,
      ma20,
      deviation,
      deviationFormatted: `${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}%`,
      slope: normalizedSlope,
      slopeDirection: maRising ? 'rising' : maFalling ? 'falling' : 'flat',
      priceAboveMA,
      maRising,
      maFalling,
      regime,
      
      // CoinGecko market data
      high24h: input.high24h,
      low24h: input.low24h,
      ath: input.ath,
      athDate: input.athDate,
      athChangePct: input.athChangePct,
      marketCap: input.marketCap,
      marketCapFormatted: input.marketCap ? `$${(input.marketCap / 1e9).toFixed(2)}B` : null,
      marketCapRank: input.marketCapRank,
      totalVolume: input.totalVolume,
      volumeFormatted: input.totalVolume ? `$${(input.totalVolume / 1e9).toFixed(2)}B` : null,
      
      // Analysis
      trendStrength: trendStrength.toFixed(2),
      trendStrengthLabel: trendStrength > 2 ? 'strong' : trendStrength > 1 ? 'moderate' : 'weak',
      goldenCross: ma50 && ma200 && ma50 > ma200,
      deathCross: ma50 && ma200 && ma50 < ma200,
      dataPoints: closes.length,
      
      // Source attribution  
      source: 'coingecko',
      sourceUrl: 'https://www.coingecko.com',
    },
  };
}

