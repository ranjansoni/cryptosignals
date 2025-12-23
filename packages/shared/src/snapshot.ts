/**
 * Signal Snapshot Utilities
 * Creates evidence and justification structures for audit/learning
 */

import {
  SignalEvidence,
  SignalJustification,
  SignalSnapshotData,
  SignalId,
  Asset,
  HorizonBucket,
  SignalState,
} from './types';

const SIGNAL_VERSION = '1.1.0';
const DATA_VERSION = '1.0.0';

/**
 * Create evidence structure from signal computation inputs
 */
export function createEvidence(
  inputs: Record<string, number | string | boolean | null>,
  thresholds: Record<string, number | string>
): SignalEvidence {
  return {
    inputs,
    thresholds,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Create justification structure for a signal decision
 */
export function createJustification(
  claim: string,
  drivers: Array<{ name: string; value: string; threshold: string }>,
  assumptions: string[],
  invalidation: string[],
  narrative?: string
): SignalJustification {
  return {
    claim,
    drivers,
    assumptions,
    invalidation,
    narrative,
  };
}

/**
 * Build justification for funding rate signal
 */
export function buildFundingRateJustification(
  state: string,
  fundingRate: number,
  fundingAnnualized: number
): SignalJustification {
  const drivers = [
    {
      name: 'Funding Rate',
      value: `${(fundingRate * 100).toFixed(4)}%`,
      threshold: '>0.01% or <-0.01%',
    },
    {
      name: 'Annualized',
      value: `${fundingAnnualized.toFixed(1)}%`,
      threshold: '>15% or <-15%',
    },
  ];

  const assumptions = [
    'High positive funding indicates crowded longs; risk of liquidation cascade',
    'High negative funding indicates crowded shorts; potential short squeeze',
  ];

  const invalidation = [
    'Funding normalizes (within ±0.01%)',
    'Open interest resets significantly',
  ];

  const claim = state === SignalState.NEUTRAL
    ? 'Neutral funding - no leverage signal'
    : state === SignalState.BUY || state === SignalState.STRONG_BUY
    ? 'Negative funding suggests short-term bullish bias'
    : 'Positive funding suggests short-term bearish bias';

  return createJustification(claim, drivers, assumptions, invalidation);
}

/**
 * Build justification for open interest signal
 */
export function buildOpenInterestJustification(
  state: string,
  oiChange: number,
  priceChange: number
): SignalJustification {
  const divergence = oiChange - priceChange;
  
  const drivers = [
    {
      name: 'OI 24h Change',
      value: `${oiChange.toFixed(2)}%`,
      threshold: '>10% or <-10%',
    },
    {
      name: 'Price 24h Change',
      value: `${priceChange.toFixed(2)}%`,
      threshold: 'relative to OI change',
    },
    {
      name: 'Divergence',
      value: `${divergence.toFixed(2)}%`,
      threshold: '>8% or <-8%',
    },
  ];

  const assumptions = [
    'Rising OI with flat/falling price indicates building positions for a move',
    'OI divergence from price often precedes mean reversion',
  ];

  const invalidation = [
    'OI change aligns with price direction',
    'Divergence reduces below 5%',
  ];

  const claim = state === SignalState.NEUTRAL
    ? 'No significant OI divergence'
    : oiChange > priceChange
    ? 'OI rising faster than price - potential bearish divergence'
    : 'OI falling while price rises - potential bullish continuation';

  return createJustification(claim, drivers, assumptions, invalidation);
}

/**
 * Build justification for RSI signal
 */
export function buildRSIJustification(
  state: string,
  rsi: number
): SignalJustification {
  const drivers = [
    {
      name: 'RSI(14)',
      value: rsi.toFixed(2),
      threshold: '>70 overbought, <30 oversold',
    },
  ];

  const assumptions = [
    'Extreme RSI levels tend to mean-revert over short-term',
    'RSI works better in ranging markets than trending',
  ];

  const invalidation = [
    'RSI returns to 40-60 neutral zone',
    'Strong directional momentum continues',
  ];

  let claim: string;
  if (rsi >= 70) {
    claim = 'Overbought conditions - potential short-term pullback';
  } else if (rsi <= 30) {
    claim = 'Oversold conditions - potential short-term bounce';
  } else if (rsi >= 60) {
    claim = 'Approaching overbought - momentum weakening';
  } else if (rsi <= 40) {
    claim = 'Approaching oversold - momentum building';
  } else {
    claim = 'Neutral RSI - no momentum signal';
  }

  return createJustification(claim, drivers, assumptions, invalidation);
}

/**
 * Build justification for MA200 regime signal
 */
export function buildMA200Justification(
  state: string,
  currentPrice: number,
  ma200: number,
  slope: number,
  deviation: number
): SignalJustification {
  const priceAboveMA = currentPrice > ma200;
  
  const drivers = [
    {
      name: 'Price vs MA200',
      value: priceAboveMA ? 'Above' : 'Below',
      threshold: 'Price position relative to MA',
    },
    {
      name: 'MA200 Slope',
      value: slope > 0 ? 'Rising' : 'Falling',
      threshold: 'Slope direction',
    },
    {
      name: 'Deviation',
      value: `${deviation.toFixed(2)}%`,
      threshold: '>20% extended, <-20% discounted',
    },
  ];

  const assumptions = [
    'Price above rising MA200 indicates bull market regime',
    'Price below falling MA200 indicates bear market regime',
    'Extreme deviations tend to revert toward the mean',
  ];

  const invalidation = [
    'Price crosses MA200 in opposite direction',
    'MA200 slope reverses',
  ];

  return createJustification(state.replace('_', ' '), drivers, assumptions, invalidation);
}

/**
 * Build justification for stablecoin supply signal
 */
export function buildStablecoinSupplyJustification(
  state: string,
  change30d: number,
  totalSupply: number
): SignalJustification {
  const drivers = [
    {
      name: '30D Supply Change',
      value: `${change30d.toFixed(2)}%`,
      threshold: '>2% bullish, <-2% bearish',
    },
    {
      name: 'Total Supply',
      value: `$${(totalSupply / 1e9).toFixed(1)}B`,
      threshold: 'Context reference',
    },
  ];

  const assumptions = [
    'Rising stablecoin supply indicates capital inflow to crypto',
    'Declining stablecoin supply indicates capital outflow',
    'Supply changes reflect underlying demand for crypto exposure',
  ];

  const invalidation = [
    'Supply change reverses direction',
    'Macro liquidity conditions change significantly',
  ];

  const claim = change30d > 0
    ? 'Stablecoin inflows suggest building crypto demand'
    : change30d < 0
    ? 'Stablecoin outflows suggest waning crypto demand'
    : 'Stable supply - no clear liquidity signal';

  return createJustification(claim, drivers, assumptions, invalidation);
}

/**
 * Build justification for liquidity plumbing signal
 */
export function buildLiquidityPlumbingJustification(
  state: string,
  impulse: number,
  deltaTGA: number,
  deltaRRP: number,
  percentile: number
): SignalJustification {
  const drivers = [
    {
      name: 'Net Impulse',
      value: `$${(impulse / 1e9).toFixed(1)}B`,
      threshold: 'Top/bottom 25% percentile',
    },
    {
      name: 'TGA Delta (4w)',
      value: `$${(deltaTGA / 1e9).toFixed(1)}B`,
      threshold: 'Rising drains, falling adds liquidity',
    },
    {
      name: 'RRP Delta (4w)',
      value: `$${(deltaRRP / 1e9).toFixed(1)}B`,
      threshold: 'Rising drains, falling adds liquidity',
    },
    {
      name: 'Percentile',
      value: `${percentile}%`,
      threshold: '>75% bullish, <25% bearish',
    },
  ];

  const assumptions = [
    'TGA drawdowns inject liquidity into markets',
    'RRP drawdowns free up collateral for lending',
    'Combined impulse reflects net system liquidity change',
  ];

  const invalidation = [
    'Impulse moves back toward neutral percentile (40-60)',
    'Fed policy changes liquidity dynamics',
  ];

  const claim = percentile >= 75
    ? 'Net liquidity injection - favorable conditions'
    : percentile <= 25
    ? 'Net liquidity drain - unfavorable conditions'
    : 'Neutral liquidity conditions';

  return createJustification(claim, drivers, assumptions, invalidation);
}

/**
 * Create a complete signal snapshot
 */
export function createSignalSnapshot(
  signalId: SignalId | string,
  asset: Asset | string,
  horizonBucket: HorizonBucket,
  state: string,
  evidence: SignalEvidence,
  justification: SignalJustification,
  entryPrice?: number,
  priceSource?: string,
  promptVersion?: string
): SignalSnapshotData {
  return {
    snapshotTs: new Date(),
    asset,
    horizonBucket,
    signalId,
    state,
    evidence,
    justification,
    entryPrice,
    priceSource,
    signalVersion: SIGNAL_VERSION,
    dataVersion: DATA_VERSION,
    promptVersion,
  };
}

export { SIGNAL_VERSION, DATA_VERSION };

