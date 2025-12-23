import { Asset, CoinGeckoMarketChart, CoinGeckoSimplePrice, OHLCV } from '../types';
import { retryWithBackoff, sleep, wrapProviderError } from '../utils';

const BASE_URL = 'https://api.coingecko.com/api/v3';

// Map our asset enum to CoinGecko coin IDs
const ASSET_TO_COIN_ID: Record<Asset, string> = {
  [Asset.BTC]: 'bitcoin',
  [Asset.ETH]: 'ethereum',
  [Asset.SOL]: 'solana',
  [Asset.XRP]: 'ripple',
  [Asset.GLOBAL]: '',
};

// CoinGecko free tier has strict rate limits: ~10-30 calls/minute
const RATE_LIMIT_DELAY = 3000; // 3 seconds between calls

let lastCallTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;

  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - timeSinceLastCall);
  }

  lastCallTime = Date.now();

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 429) {
    throw new Error('rate limit exceeded');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

/**
 * Get current prices for assets
 */
export async function getSimplePrices(
  assets: Asset[]
): Promise<CoinGeckoSimplePrice | null> {
  try {
    const coinIds = assets
      .filter((a) => a !== Asset.GLOBAL)
      .map((a) => ASSET_TO_COIN_ID[a])
      .join(',');

    if (!coinIds) return null;

    const url = `${BASE_URL}/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true`;

    const response = await retryWithBackoff(() => rateLimitedFetch(url));
    const data = (await response.json()) as CoinGeckoSimplePrice;

    return data;
  } catch (error) {
    console.error('CoinGecko getSimplePrices error:', wrapProviderError('coingecko', error));
    return null;
  }
}

/**
 * Get market chart data (OHLCV-like) for an asset
 * Note: CoinGecko free tier only provides prices, market_caps, total_volumes
 * We'll use prices as close and derive OHLC from granular data
 */
export async function getMarketChart(
  asset: Asset,
  days: number = 365
): Promise<CoinGeckoMarketChart | null> {
  try {
    if (asset === Asset.GLOBAL) return null;

    const coinId = ASSET_TO_COIN_ID[asset];
    const url = `${BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;

    const response = await retryWithBackoff(() => rateLimitedFetch(url));
    const data = (await response.json()) as CoinGeckoMarketChart;

    return data;
  } catch (error) {
    console.error('CoinGecko getMarketChart error:', wrapProviderError('coingecko', error));
    return null;
  }
}

/**
 * Get OHLC candles (available on free tier)
 * Note: 1/7/14/30/90/180/365 days supported
 */
export async function getOHLC(
  asset: Asset,
  days: 1 | 7 | 14 | 30 | 90 | 180 | 365 = 365
): Promise<OHLCV[] | null> {
  try {
    if (asset === Asset.GLOBAL) return null;

    const coinId = ASSET_TO_COIN_ID[asset];
    const url = `${BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;

    const response = await retryWithBackoff(() => rateLimitedFetch(url));
    // Response format: [[timestamp, open, high, low, close], ...]
    const data = (await response.json()) as [number, number, number, number, number][];

    // Convert to OHLCV format (no volume in OHLC endpoint)
    const ohlcv: OHLCV[] = data.map(([timestamp, open, high, low, close]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume: 0, // Volume not available in OHLC endpoint
    }));

    return ohlcv;
  } catch (error) {
    console.error('CoinGecko getOHLC error:', wrapProviderError('coingecko', error));
    return null;
  }
}

/**
 * Convert market chart data to daily OHLCV format
 * Uses price data points to construct OHLC candles
 */
export function marketChartToOHLCV(chart: CoinGeckoMarketChart): OHLCV[] {
  const pricesByDay = new Map<string, number[]>();
  const volumesByDay = new Map<string, number>();

  // Group prices by day
  for (const [timestamp, price] of chart.prices) {
    const day = new Date(timestamp).toISOString().split('T')[0];
    if (!pricesByDay.has(day)) {
      pricesByDay.set(day, []);
    }
    pricesByDay.get(day)!.push(price);
  }

  // Get daily volumes
  for (const [timestamp, volume] of chart.total_volumes) {
    const day = new Date(timestamp).toISOString().split('T')[0];
    volumesByDay.set(day, volume);
  }

  // Convert to OHLCV
  const ohlcv: OHLCV[] = [];
  const sortedDays = Array.from(pricesByDay.keys()).sort();

  for (const day of sortedDays) {
    const prices = pricesByDay.get(day)!;
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volume = volumesByDay.get(day) || 0;

    ohlcv.push({
      timestamp: new Date(day).getTime(),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return ohlcv;
}

/**
 * Get current price for an asset
 */
export async function getCurrentPrice(asset: Asset): Promise<number | null> {
  if (asset === Asset.GLOBAL) return null;

  const prices = await getSimplePrices([asset]);
  if (!prices) return null;

  const coinId = ASSET_TO_COIN_ID[asset];
  return prices[coinId]?.usd || null;
}

/**
 * Get price at a specific timestamp (approximation using market chart)
 */
export async function getPriceAtTime(
  asset: Asset,
  targetTime: Date
): Promise<number | null> {
  try {
    if (asset === Asset.GLOBAL) return null;

    // Calculate days from now to target
    const now = Date.now();
    const targetMs = targetTime.getTime();
    const daysDiff = Math.ceil((now - targetMs) / (24 * 60 * 60 * 1000));

    // Get market chart for that range
    const days = Math.min(Math.max(daysDiff + 1, 1), 365);
    const chart = await getMarketChart(asset, days);
    if (!chart || !chart.prices.length) return null;

    // Find closest price to target time
    let closestPrice = chart.prices[0][1];
    let closestDiff = Math.abs(chart.prices[0][0] - targetMs);

    for (const [timestamp, price] of chart.prices) {
      const diff = Math.abs(timestamp - targetMs);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestPrice = price;
      }
    }

    return closestPrice;
  } catch (error) {
    console.error('CoinGecko getPriceAtTime error:', wrapProviderError('coingecko', error));
    return null;
  }
}

