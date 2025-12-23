import { Asset, SignalId, SignalResult, SignalState } from '../types';
import { getUTCNow } from '../utils';

export interface OpenInterestInput {
  openInterest: number; // Total OI in USD
  change24h: number; // 24h change as percentage
  priceChange24h: number; // Price change as percentage
}

/**
 * Open Interest Signal
 *
 * Combines OI change with price change to determine market positioning:
 *
 * OI Rising + Price Rising = New longs entering (bullish continuation)
 * OI Rising + Price Falling = New shorts entering (bearish continuation)
 * OI Falling + Price Rising = Short covering (weak rally)
 * OI Falling + Price Falling = Long liquidation (weak decline)
 *
 * Thresholds based on OI change magnitude:
 * - |OI change| > 10%: Strong signal
 * - |OI change| > 5%: Regular signal
 * - |OI change| <= 5%: Neutral
 */
export function computeOpenInterestSignal(
  asset: Asset,
  input: OpenInterestInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (
    !input ||
    input.openInterest === undefined ||
    input.change24h === undefined ||
    input.priceChange24h === undefined
  ) {
    return {
      signalId: SignalId.OPEN_INTEREST,
      asset,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'missing_data',
        input: null,
      },
    };
  }

  const { openInterest, change24h, priceChange24h } = input;

  let state: SignalState;
  let interpretation: string;

  const oiRising = change24h > 0;
  const priceRising = priceChange24h > 0;
  const oiMagnitude = Math.abs(change24h);

  // Determine regime and signal
  if (oiRising && priceRising) {
    // New longs entering - bullish continuation
    interpretation = 'new_longs_entering';
    if (oiMagnitude > 10) {
      state = SignalState.STRONG_BUY;
    } else if (oiMagnitude > 5) {
      state = SignalState.BUY;
    } else {
      state = SignalState.NEUTRAL;
    }
  } else if (oiRising && !priceRising) {
    // New shorts entering - bearish continuation
    interpretation = 'new_shorts_entering';
    if (oiMagnitude > 10) {
      state = SignalState.STRONG_SELL;
    } else if (oiMagnitude > 5) {
      state = SignalState.SELL;
    } else {
      state = SignalState.NEUTRAL;
    }
  } else if (!oiRising && priceRising) {
    // Short covering - weak rally, be cautious
    interpretation = 'short_covering';
    if (oiMagnitude > 10) {
      state = SignalState.SELL; // Strong short covering = exhaustion
    } else if (oiMagnitude > 5) {
      state = SignalState.NEUTRAL; // Moderate = watch
    } else {
      state = SignalState.NEUTRAL;
    }
  } else {
    // Long liquidation - weak decline, watch for bounce
    interpretation = 'long_liquidation';
    if (oiMagnitude > 10) {
      state = SignalState.BUY; // Capitulation = potential bottom
    } else if (oiMagnitude > 5) {
      state = SignalState.NEUTRAL;
    } else {
      state = SignalState.NEUTRAL;
    }
  }

  return {
    signalId: SignalId.OPEN_INTEREST,
    asset,
    ts,
    state,
    rawJson: {
      openInterest,
      change24h,
      priceChange24h,
      interpretation,
      oiRising,
      priceRising,
      thresholds: {
        strongChange: 10,
        regularChange: 5,
      },
    },
  };
}

