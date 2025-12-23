import { Asset, SignalId, SignalResult, SignalState } from '../types';
import { getUTCNow } from '../utils';

export interface FedBalanceSheetInput {
  currentValue: number; // Current total assets in millions
  yearAgoValue: number; // Value from 52 weeks ago
  yoyChange: number; // Absolute change
  yoyPercentChange: number; // Percentage change
}

/**
 * Fed Balance Sheet Year-over-Year Signal (GLOBAL)
 *
 * Fed balance sheet expansion (QE) = liquidity injection = bullish for risk assets
 * Fed balance sheet contraction (QT) = liquidity drain = bearish for risk assets
 *
 * Thresholds (YoY % change):
 * - > +10%: STRONG_BUY (aggressive expansion)
 * - > +5%: BUY (expansion)
 * - -5% to +5%: NEUTRAL (stable/slow changes)
 * - < -5%: SELL (contraction)
 * - < -10%: STRONG_SELL (aggressive contraction)
 */
export function computeFedBalanceSheetSignal(
  input: FedBalanceSheetInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (
    !input ||
    input.currentValue === undefined ||
    input.yoyPercentChange === undefined
  ) {
    return {
      signalId: SignalId.FED_BALANCE_SHEET,
      asset: Asset.GLOBAL,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'missing_data',
        input: null,
      },
    };
  }

  const { currentValue, yearAgoValue, yoyChange, yoyPercentChange } = input;

  let state: SignalState;

  // Expansion = bullish, Contraction = bearish
  if (yoyPercentChange > 10) {
    state = SignalState.STRONG_BUY;
  } else if (yoyPercentChange > 5) {
    state = SignalState.BUY;
  } else if (yoyPercentChange < -10) {
    state = SignalState.STRONG_SELL;
  } else if (yoyPercentChange < -5) {
    state = SignalState.SELL;
  } else {
    state = SignalState.NEUTRAL;
  }

  return {
    signalId: SignalId.FED_BALANCE_SHEET,
    asset: Asset.GLOBAL,
    ts,
    state,
    rawJson: {
      currentValue,
      yearAgoValue,
      yoyChange,
      yoyPercentChange,
      thresholds: {
        strongBuy: 10,
        buy: 5,
        sell: -5,
        strongSell: -10,
      },
    },
  };
}

