import Decimal from 'decimal.js';

// Core enums
export enum Asset {
  BTC = 'BTC',
  ETH = 'ETH',
  SOL = 'SOL',
  XRP = 'XRP',
  GLOBAL = 'GLOBAL', // For macro signals like stablecoin supply
}

export enum SignalState {
  STRONG_BUY = 'STRONG_BUY',
  BUY = 'BUY',
  NEUTRAL = 'NEUTRAL',
  SELL = 'SELL',
  STRONG_SELL = 'STRONG_SELL',
  // Context-only states (not actionable, for regime awareness only)
  HEDGE_ON = 'HEDGE_ON',       // Gold trend: hedging regime active
  RISK_ON = 'RISK_ON',         // Nasdaq trend: risk-on environment
  RISK_OFF = 'RISK_OFF',       // Nasdaq trend: risk-off environment
}

// Legacy horizons (kept for backward compatibility)
export enum Horizon {
  D1 = '1D',
  D7 = '7D',
  D30 = '30D',
}

// New horizon bucket system
export enum HorizonBucket {
  SHORT = 'short',   // 2-7 days
  MID = 'mid',       // 10-30 days
  LONG = 'long',     // 45-60+ days
}

// Evaluation points per bucket (days)
export const HORIZON_EVAL_POINTS: Record<HorizonBucket, number[]> = {
  [HorizonBucket.SHORT]: [2, 7],
  [HorizonBucket.MID]: [10, 30],
  [HorizonBucket.LONG]: [45, 60],
};

// Success thresholds per evaluation point (as decimal percentages)
export const HORIZON_EVAL_THRESHOLDS: Record<number, number> = {
  2: 0.01,   // 1%
  7: 0.03,   // 3%
  10: 0.04,  // 4%
  30: 0.07,  // 7%
  45: 0.10,  // 10%
  60: 0.12,  // 12%
};

export enum JobStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SignalCategory {
  FUNDING = 'funding',
  OPEN_INTEREST = 'open_interest',
  TECHNICAL = 'technical',
  MACRO = 'macro',
}

// Subcategory for macro signals (liquidity vs risk sentiment)
export enum SignalSubcategory {
  LIQUIDITY = 'liquidity',
  RISK = 'risk',
}

// Signal identifiers
export enum SignalId {
  FUNDING_RATE = 'funding_rate',
  OPEN_INTEREST = 'open_interest',
  RSI_14 = 'rsi_14',
  MA_200_REGIME = 'ma_200_regime',
  STABLECOIN_SUPPLY = 'stablecoin_supply',
  DXY_TREND = 'dxy_trend',
  FED_BALANCE_SHEET = 'fed_balance_sheet',
  // New context-only macro signals
  LIQUIDITY_PLUMBING = 'liquidity_plumbing',
  GOLD_TREND = 'gold_trend',
  NASDAQ_TREND = 'nasdaq_trend',
}

// Type definitions
export interface PriceData {
  asset: Asset;
  ts: Date;
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  volume: Decimal;
  source: string;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SignalResult {
  signalId: SignalId;
  asset: Asset;
  ts: Date;
  state: SignalState | string; // Allow string for context-only states
  rawJson: Record<string, unknown>;
  horizonBucket?: HorizonBucket; // Which bucket this signal applies to
}

// Evidence structure for signal snapshots
export interface SignalEvidence {
  inputs: Record<string, number | string | boolean | null>;
  thresholds: Record<string, number | string>;
  computedAt: string;
}

// Justification structure for signal snapshots
export interface SignalJustification {
  claim: string;
  drivers: Array<{
    name: string;
    value: string;
    threshold: string;
  }>;
  assumptions: string[];
  invalidation: string[];
  narrative?: string; // Optional LLM-generated text
}

// Signal snapshot for audit/learning
export interface SignalSnapshotData {
  snapshotTs: Date;
  asset: Asset | string;
  horizonBucket: HorizonBucket;
  signalId: SignalId | string;
  state: string;
  evidence: SignalEvidence;
  justification: SignalJustification;
  entryPrice?: number;
  priceSource?: string;
  signalVersion: string;
  dataVersion: string;
  promptVersion?: string;
}

export interface SignalConfig {
  id: SignalId;
  name: string;
  category: SignalCategory;
  subcategory?: SignalSubcategory;
  frequency: 'hourly' | 'daily' | 'weekly';
  assets: Asset[];
  horizons: Horizon[];
  horizonBuckets: HorizonBucket[]; // Which buckets this signal applies to
  thresholds: Record<Horizon, number>; // Success threshold per horizon (legacy)
  contextOnly?: boolean; // If true, signal is for context/regime awareness only
}

// Provider response types
export interface CoinGeckoMarketChart {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface CoinGeckoSimplePrice {
  [coinId: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

export interface DeFiLlamaStablecoin {
  id: string;
  name: string;
  symbol: string;
  pegMechanism: string;
  circulating: {
    peggedUSD: number;
  };
  circulatingPrevMonth?: {
    peggedUSD: number;
  };
}

export interface FREDObservation {
  date: string;
  value: string;
}

export interface FREDSeriesResponse {
  observations: FREDObservation[];
}

export interface CoinGlassFundingRate {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
}

export interface CoinGlassOpenInterest {
  symbol: string;
  openInterest: number;
  openInterestUSD: number;
  change24h: number;
}

// Utility types
export type HorizonDays = {
  [K in Horizon]: number;
};

export const HORIZON_DAYS: HorizonDays = {
  [Horizon.D1]: 1,
  [Horizon.D7]: 7,
  [Horizon.D30]: 30,
};

// Success thresholds by horizon (as decimal percentages)
export const SUCCESS_THRESHOLDS: HorizonDays = {
  [Horizon.D1]: 0.01, // 1%
  [Horizon.D7]: 0.03, // 3%
  [Horizon.D30]: 0.07, // 7%
};

// Stats windows
export const STATS_WINDOWS = ['90d', '365d'] as const;
export type StatsWindow = typeof STATS_WINDOWS[number];

