import { Asset, Horizon, HorizonBucket, SignalCategory, SignalSubcategory, SignalConfig, SignalId, SUCCESS_THRESHOLDS } from './index';

// Signal registry - defines all signals and their configurations
export const SIGNAL_REGISTRY: Record<SignalId, SignalConfig> = {
  // Leverage/Derivatives signals (short-term focus)
  [SignalId.FUNDING_RATE]: {
    id: SignalId.FUNDING_RATE,
    name: 'Funding Rate',
    category: SignalCategory.FUNDING,
    frequency: 'hourly',
    assets: [Asset.BTC, Asset.ETH, Asset.SOL, Asset.XRP],
    horizons: [Horizon.D1, Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.SHORT],
    thresholds: SUCCESS_THRESHOLDS,
  },
  [SignalId.OPEN_INTEREST]: {
    id: SignalId.OPEN_INTEREST,
    name: 'Open Interest',
    category: SignalCategory.OPEN_INTEREST,
    frequency: 'hourly',
    assets: [Asset.BTC, Asset.ETH, Asset.SOL, Asset.XRP],
    horizons: [Horizon.D1, Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.SHORT],
    thresholds: SUCCESS_THRESHOLDS,
  },
  // Technical signals (short + mid focus)
  [SignalId.RSI_14]: {
    id: SignalId.RSI_14,
    name: 'RSI (14)',
    category: SignalCategory.TECHNICAL,
    frequency: 'daily',
    assets: [Asset.BTC, Asset.ETH, Asset.SOL, Asset.XRP],
    horizons: [Horizon.D1, Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.SHORT, HorizonBucket.MID],
    thresholds: SUCCESS_THRESHOLDS,
  },
  [SignalId.MA_200_REGIME]: {
    id: SignalId.MA_200_REGIME,
    name: '200-Day MA Regime',
    category: SignalCategory.TECHNICAL,
    frequency: 'daily',
    assets: [Asset.BTC, Asset.ETH, Asset.SOL, Asset.XRP],
    horizons: [Horizon.D1, Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.MID, HorizonBucket.LONG],
    thresholds: SUCCESS_THRESHOLDS,
  },
  // Macro Liquidity Signals (mid + long focus)
  [SignalId.STABLECOIN_SUPPLY]: {
    id: SignalId.STABLECOIN_SUPPLY,
    name: 'Stablecoin Supply',
    category: SignalCategory.MACRO,
    subcategory: SignalSubcategory.LIQUIDITY,
    frequency: 'weekly',
    assets: [Asset.GLOBAL],
    horizons: [Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.MID, HorizonBucket.LONG],
    thresholds: SUCCESS_THRESHOLDS,
  },
  [SignalId.FED_BALANCE_SHEET]: {
    id: SignalId.FED_BALANCE_SHEET,
    name: 'Fed Balance Sheet',
    category: SignalCategory.MACRO,
    subcategory: SignalSubcategory.LIQUIDITY,
    frequency: 'weekly',
    assets: [Asset.GLOBAL],
    horizons: [Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.MID, HorizonBucket.LONG],
    thresholds: SUCCESS_THRESHOLDS,
  },
  [SignalId.LIQUIDITY_PLUMBING]: {
    id: SignalId.LIQUIDITY_PLUMBING,
    name: 'Liquidity Plumbing',
    category: SignalCategory.MACRO,
    subcategory: SignalSubcategory.LIQUIDITY,
    frequency: 'weekly',
    assets: [Asset.GLOBAL],
    horizons: [Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.MID, HorizonBucket.LONG],
    thresholds: SUCCESS_THRESHOLDS,
    contextOnly: true,
  },
  // Macro Risk Sentiment Signals (mid + long focus)
  [SignalId.DXY_TREND]: {
    id: SignalId.DXY_TREND,
    name: 'DXY Trend',
    category: SignalCategory.MACRO,
    subcategory: SignalSubcategory.RISK,
    frequency: 'weekly',
    assets: [Asset.GLOBAL],
    horizons: [Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.MID, HorizonBucket.LONG],
    thresholds: SUCCESS_THRESHOLDS,
  },
  [SignalId.GOLD_TREND]: {
    id: SignalId.GOLD_TREND,
    name: 'Gold Trend',
    category: SignalCategory.MACRO,
    subcategory: SignalSubcategory.RISK,
    frequency: 'weekly',
    assets: [Asset.GLOBAL],
    horizons: [Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.MID, HorizonBucket.LONG],
    thresholds: SUCCESS_THRESHOLDS,
    contextOnly: true,
  },
  [SignalId.NASDAQ_TREND]: {
    id: SignalId.NASDAQ_TREND,
    name: 'Nasdaq Trend',
    category: SignalCategory.MACRO,
    subcategory: SignalSubcategory.RISK,
    frequency: 'weekly',
    assets: [Asset.GLOBAL],
    horizons: [Horizon.D7, Horizon.D30],
    horizonBuckets: [HorizonBucket.MID, HorizonBucket.LONG],
    thresholds: SUCCESS_THRESHOLDS,
    contextOnly: true,
  },
};

// Get signals by frequency
export function getSignalsByFrequency(frequency: 'hourly' | 'daily' | 'weekly'): SignalConfig[] {
  return Object.values(SIGNAL_REGISTRY).filter((signal) => signal.frequency === frequency);
}

// Get signals by category
export function getSignalsByCategory(category: SignalCategory): SignalConfig[] {
  return Object.values(SIGNAL_REGISTRY).filter((signal) => signal.category === category);
}

// Get signals for a specific asset
export function getSignalsForAsset(asset: Asset): SignalConfig[] {
  return Object.values(SIGNAL_REGISTRY).filter((signal) => signal.assets.includes(asset));
}

// Get signals by subcategory
export function getSignalsBySubcategory(subcategory: SignalSubcategory): SignalConfig[] {
  return Object.values(SIGNAL_REGISTRY).filter((signal) => signal.subcategory === subcategory);
}

// Get context-only signals
export function getContextOnlySignals(): SignalConfig[] {
  return Object.values(SIGNAL_REGISTRY).filter((signal) => signal.contextOnly === true);
}

// Check if a signal is context-only
export function isContextOnlySignal(signalId: SignalId): boolean {
  return SIGNAL_REGISTRY[signalId]?.contextOnly === true;
}

// Get signals by horizon bucket
export function getSignalsByHorizonBucket(bucket: HorizonBucket): SignalConfig[] {
  return Object.values(SIGNAL_REGISTRY).filter((signal) => 
    signal.horizonBuckets.includes(bucket)
  );
}

// Get signals for a specific asset and horizon bucket
export function getSignalsForAssetAndBucket(asset: Asset, bucket: HorizonBucket): SignalConfig[] {
  return Object.values(SIGNAL_REGISTRY).filter(
    (signal) => signal.assets.includes(asset) && signal.horizonBuckets.includes(bucket)
  );
}

