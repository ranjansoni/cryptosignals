// Export all signal functions
export { computeFundingRateSignal, type FundingRateInput } from './fundingRate';
export { computeOpenInterestSignal, type OpenInterestInput } from './openInterest';
export { computeRSISignal, type RSIInput } from './rsi';
export { computeMA200RegimeSignal, type MA200RegimeInput } from './ma200Regime';
export { computeStablecoinSupplySignal, type StablecoinSupplyInput } from './stablecoinSupply';
export { computeDXYTrendSignal, type DXYTrendInput } from './dxyTrend';
export { computeFedBalanceSheetSignal, type FedBalanceSheetInput } from './fedBalanceSheetYoY';

// New context-only macro signals
export { computeLiquidityPlumbingSignal, type LiquidityPlumbingInput } from './liquidityPlumbing';
export { computeGoldTrendSignal, type GoldTrendInput } from './goldTrend';
export { computeNasdaqTrendSignal, type NasdaqTrendInput } from './nasdaqTrend';

