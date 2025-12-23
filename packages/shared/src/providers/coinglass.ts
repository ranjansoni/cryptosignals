import { Asset, CoinGlassFundingRate, CoinGlassOpenInterest } from '../types';
import { retryWithBackoff, sleep, wrapProviderError } from '../utils';

const BASE_URL = 'https://open-api.coinglass.com/public/v2';

// Map our asset enum to CoinGlass symbols
const ASSET_TO_SYMBOL: Record<Asset, string> = {
  [Asset.BTC]: 'BTC',
  [Asset.ETH]: 'ETH',
  [Asset.SOL]: 'SOL',
  [Asset.XRP]: 'XRP',
  [Asset.GLOBAL]: '',
};

// CoinGlass has rate limits - be conservative
const RATE_LIMIT_DELAY = 2000; // 2 seconds between calls
let lastCallTime = 0;

interface CoinGlassResponse<T> {
  code: string;
  msg: string;
  data: T;
  success: boolean;
}

async function rateLimitedFetch(
  url: string,
  apiKey: string
): Promise<Response> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;

  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - timeSinceLastCall);
  }

  lastCallTime = Date.now();

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'coinglassSecret': apiKey,
    },
  });

  if (response.status === 429) {
    throw new Error('rate limit exceeded');
  }

  if (response.status === 401) {
    throw new Error('unauthorized - check API key');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

interface FundingRateData {
  symbol: string;
  uMarginList?: Array<{
    exchangeName: string;
    rate: number;
    nextFundingTime: number;
  }>;
}

/**
 * Get funding rates for an asset
 * Returns weighted average across major exchanges
 */
export async function getFundingRate(
  asset: Asset,
  apiKey: string
): Promise<CoinGlassFundingRate | null> {
  try {
    if (asset === Asset.GLOBAL || !apiKey) return null;

    const symbol = ASSET_TO_SYMBOL[asset];
    const url = `${BASE_URL}/funding?symbol=${symbol}`;

    const response = await retryWithBackoff(
      () => rateLimitedFetch(url, apiKey),
      3,
      2000
    );

    const result = (await response.json()) as CoinGlassResponse<FundingRateData[]>;

    if (!result.success || !result.data?.length) {
      return null;
    }

    // Find the data for our symbol
    const assetData = result.data.find((d) => d.symbol === symbol);
    if (!assetData?.uMarginList?.length) {
      return null;
    }

    // Calculate weighted average funding rate across exchanges
    let totalRate = 0;
    let count = 0;
    let latestFundingTime = 0;

    for (const exchange of assetData.uMarginList) {
      if (exchange.rate !== undefined && exchange.rate !== null) {
        totalRate += exchange.rate;
        count++;
        if (exchange.nextFundingTime > latestFundingTime) {
          latestFundingTime = exchange.nextFundingTime;
        }
      }
    }

    if (count === 0) return null;

    return {
      symbol,
      fundingRate: totalRate / count,
      nextFundingTime: latestFundingTime,
    };
  } catch (error) {
    console.error(`CoinGlass getFundingRate(${asset}) error:`, wrapProviderError('coinglass', error));
    return null;
  }
}

interface OpenInterestData {
  symbol: string;
  openInterest: number;
  h24Change?: number;
}

/**
 * Get open interest for an asset
 */
export async function getOpenInterest(
  asset: Asset,
  apiKey: string
): Promise<CoinGlassOpenInterest | null> {
  try {
    if (asset === Asset.GLOBAL || !apiKey) return null;

    const symbol = ASSET_TO_SYMBOL[asset];
    const url = `${BASE_URL}/open_interest?symbol=${symbol}`;

    const response = await retryWithBackoff(
      () => rateLimitedFetch(url, apiKey),
      3,
      2000
    );

    const result = (await response.json()) as CoinGlassResponse<OpenInterestData[]>;

    if (!result.success || !result.data?.length) {
      return null;
    }

    // Aggregate open interest across exchanges
    let totalOI = 0;
    let totalChange = 0;
    let count = 0;

    for (const exchange of result.data) {
      if (exchange.openInterest) {
        totalOI += exchange.openInterest;
        if (exchange.h24Change !== undefined) {
          totalChange += exchange.h24Change;
          count++;
        }
      }
    }

    return {
      symbol,
      openInterest: totalOI,
      openInterestUSD: totalOI, // Already in USD for most endpoints
      change24h: count > 0 ? totalChange / count : 0,
    };
  } catch (error) {
    console.error(`CoinGlass getOpenInterest(${asset}) error:`, wrapProviderError('coinglass', error));
    return null;
  }
}

/**
 * Get all derivatives data for an asset
 */
export async function getDerivativesData(
  asset: Asset,
  apiKey: string
): Promise<{
  fundingRate: CoinGlassFundingRate | null;
  openInterest: CoinGlassOpenInterest | null;
} | null> {
  try {
    if (asset === Asset.GLOBAL || !apiKey) {
      return { fundingRate: null, openInterest: null };
    }

    const [fundingRate, openInterest] = await Promise.all([
      getFundingRate(asset, apiKey),
      getOpenInterest(asset, apiKey),
    ]);

    return { fundingRate, openInterest };
  } catch (error) {
    console.error(`CoinGlass getDerivativesData(${asset}) error:`, wrapProviderError('coinglass', error));
    return null;
  }
}

/**
 * Batch fetch derivatives data for multiple assets
 */
export async function getBatchDerivativesData(
  assets: Asset[],
  apiKey: string
): Promise<Map<Asset, Awaited<ReturnType<typeof getDerivativesData>>>> {
  const results = new Map<Asset, Awaited<ReturnType<typeof getDerivativesData>>>();

  // Process sequentially to respect rate limits
  for (const asset of assets) {
    if (asset !== Asset.GLOBAL) {
      const data = await getDerivativesData(asset, apiKey);
      results.set(asset, data);
    }
  }

  return results;
}

