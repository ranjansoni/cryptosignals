import { Asset, SignalId, SignalResult, SignalState } from '../types';
import { getUTCNow } from '../utils';

export interface StablecoinSupplyInput {
  totalSupply: number; // Total USDT + USDC supply in USD
  change30d: {
    netChange: number; // Absolute change
    percentChange: number; // Percentage change
  };
  // Detailed breakdown from DeFiLlama
  breakdown?: {
    usdt: { supply: number; change30d: number; chains?: string[] };
    usdc: { supply: number; change30d: number; chains?: string[] };
    dai?: { supply: number; change30d: number };
    others?: { supply: number; change30d: number };
  };
  // Historical data points
  supplyHistory?: Array<{ date: string; supply: number }>;
  dominance?: number; // Stablecoin market cap as % of total crypto
}

/**
 * Stablecoin Supply Signal (GLOBAL)
 *
 * Tracks USDT + USDC combined supply as a liquidity indicator.
 * Increasing supply = more dry powder for crypto purchases = bullish
 * Decreasing supply = capital leaving crypto = bearish
 *
 * Thresholds (30-day change):
 * - > +5%: STRONG_BUY (aggressive capital inflow)
 * - > +2%: BUY (healthy inflow)
 * - -2% to +2%: NEUTRAL (stable)
 * - < -2%: SELL (capital outflow)
 * - < -5%: STRONG_SELL (significant outflow)
 */
export function computeStablecoinSupplySignal(
  input: StablecoinSupplyInput | null
): SignalResult {
  const ts = getUTCNow();

  // Handle missing data
  if (!input || input.totalSupply === undefined || !input.change30d) {
    return {
      signalId: SignalId.STABLECOIN_SUPPLY,
      asset: Asset.GLOBAL,
      ts,
      state: SignalState.NEUTRAL,
      rawJson: {
        error: 'missing_data',
        input: null,
      },
    };
  }

  const { totalSupply, change30d } = input;
  const percentChange = change30d.percentChange;

  let state: SignalState;

  // Determine signal based on 30-day supply change
  if (percentChange > 5) {
    state = SignalState.STRONG_BUY;
  } else if (percentChange > 2) {
    state = SignalState.BUY;
  } else if (percentChange < -5) {
    state = SignalState.STRONG_SELL;
  } else if (percentChange < -2) {
    state = SignalState.SELL;
  } else {
    state = SignalState.NEUTRAL;
  }

  // Calculate supply velocity (rate of change)
  const supplyVelocity = percentChange > 0 ? 'expanding' : percentChange < 0 ? 'contracting' : 'stable';
  
  // Determine flow direction
  const flowDirection = percentChange > 2 ? 'strong_inflow' : 
                        percentChange > 0 ? 'mild_inflow' :
                        percentChange < -2 ? 'strong_outflow' :
                        percentChange < 0 ? 'mild_outflow' : 'neutral';

  return {
    signalId: SignalId.STABLECOIN_SUPPLY,
    asset: Asset.GLOBAL,
    ts,
    state,
    rawJson: {
      // Core supply data
      totalSupply,
      totalSupplyFormatted: `$${(totalSupply / 1e9).toFixed(2)}B`,
      netChange: change30d.netChange,
      netChangeFormatted: `$${(Math.abs(change30d.netChange) / 1e9).toFixed(2)}B`,
      percentChange,
      change30dPct: percentChange,
      
      // Breakdown by stablecoin (from DeFiLlama)
      breakdown: input.breakdown ? {
        usdt: {
          supply: input.breakdown.usdt.supply,
          supplyFormatted: `$${(input.breakdown.usdt.supply / 1e9).toFixed(2)}B`,
          change30d: input.breakdown.usdt.change30d,
          share: ((input.breakdown.usdt.supply / totalSupply) * 100).toFixed(1),
        },
        usdc: {
          supply: input.breakdown.usdc.supply,
          supplyFormatted: `$${(input.breakdown.usdc.supply / 1e9).toFixed(2)}B`,
          change30d: input.breakdown.usdc.change30d,
          share: ((input.breakdown.usdc.supply / totalSupply) * 100).toFixed(1),
        },
        dai: input.breakdown.dai ? {
          supply: input.breakdown.dai.supply,
          supplyFormatted: `$${(input.breakdown.dai.supply / 1e9).toFixed(2)}B`,
          change30d: input.breakdown.dai.change30d,
        } : null,
      } : null,
      
      // Analysis
      supplyVelocity,
      flowDirection,
      dominance: input.dominance,
      
      // Thresholds
      thresholds: {
        strongBuy: 5,
        buy: 2,
        sell: -2,
        strongSell: -5,
      },
      
      // Source attribution
      source: 'defillama',
      sourceUrl: 'https://defillama.com/stablecoins',
    },
  };
}

