import { Asset, SignalId, SignalResult, SignalState } from '../types';
import { calculateRSI, getUTCNow } from '../utils';

export interface RSIInput {
  closes: number[]; // Array of closing prices (oldest first)
  period?: number; // RSI period, default 14
  // Additional CoinGecko data for richer evidence
  high24h?: number;
  low24h?: number;
  priceChange24h?: number;
  priceChangePct24h?: number;
  marketCap?: number;
  volume24h?: number;
}

/**
 * RSI (Relative Strength Index) Signal
 *
 * Classic threshold-based interpretation:
 * - RSI > 80: STRONG_SELL (extremely overbought)
 * - RSI > 70: SELL (overbought)
 * - RSI 30-70: NEUTRAL
 * - RSI < 30: BUY (oversold)
 * - RSI < 20: STRONG_BUY (extremely oversold)
 *
 * Note: This v1 implementation uses simple thresholds only.
 * Future versions may incorporate divergence detection.
 */
export function computeRSISignal(
  asset: Asset,
  input: RSIInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (!input || !input.closes || input.closes.length < 15) {
    return {
      signalId: SignalId.RSI_14,
      asset,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'insufficient_data',
        dataPoints: input?.closes?.length || 0,
        required: 15,
      },
    };
  }

  const period = input.period || 14;
  const rsi = calculateRSI(input.closes, period);

  // Handle calculation failure
  if (rsi === null) {
    return {
      signalId: SignalId.RSI_14,
      asset,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'calculation_failed',
        dataPoints: input.closes.length,
      },
    };
  }

  let state: SignalState;

  // Determine signal state based on thresholds
  if (rsi > 80) {
    state = SignalState.STRONG_SELL;
  } else if (rsi > 70) {
    state = SignalState.SELL;
  } else if (rsi < 20) {
    state = SignalState.STRONG_BUY;
  } else if (rsi < 30) {
    state = SignalState.BUY;
  } else {
    state = SignalState.NEUTRAL;
  }

  // Calculate additional metrics
  const currentClose = input.closes[input.closes.length - 1];
  const prevClose = input.closes[input.closes.length - 2];
  const dayChange = prevClose ? ((currentClose - prevClose) / prevClose) * 100 : 0;
  
  // Determine momentum direction
  const recentCloses = input.closes.slice(-5);
  const avgRecent = recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;
  const momentum = currentClose > avgRecent ? 'bullish' : currentClose < avgRecent ? 'bearish' : 'neutral';

  return {
    signalId: SignalId.RSI_14,
    asset,
    ts,
    state,
    rawJson: {
      // Core RSI data
      rsi,
      period,
      // Price data from CoinGecko
      currentPrice: currentClose,
      high24h: input.high24h,
      low24h: input.low24h,
      priceChange24h: input.priceChange24h,
      priceChangePct24h: input.priceChangePct24h,
      dayChange,
      // Market data
      marketCap: input.marketCap,
      volume24h: input.volume24h,
      // Analysis
      momentum,
      dataPoints: input.closes.length,
      // Thresholds
      thresholds: {
        strongSell: 80,
        sell: 70,
        buy: 30,
        strongBuy: 20,
      },
      // Source attribution
      source: 'coingecko',
      sourceUrl: 'https://www.coingecko.com',
    },
  };
}

