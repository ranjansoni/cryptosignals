import { DeFiLlamaStablecoin } from '../types';
import { retryWithBackoff, wrapProviderError } from '../utils';

const BASE_URL = 'https://stablecoins.llama.fi';

// Stablecoins we track
const TRACKED_STABLECOINS = ['USDT', 'USDC'];

interface StablecoinResponse {
  peggedAssets: DeFiLlamaStablecoin[];
}

interface StablecoinChartData {
  date: string;
  totalCirculating: {
    peggedUSD: number;
  };
}

interface StablecoinChartResponse {
  [chainId: string]: StablecoinChartData[];
}

/**
 * Get all stablecoins data
 */
export async function getAllStablecoins(): Promise<DeFiLlamaStablecoin[] | null> {
  try {
    const url = `${BASE_URL}/stablecoins?includePrices=false`;

    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    });

    const data = (await response.json()) as StablecoinResponse;
    return data.peggedAssets || null;
  } catch (error) {
    console.error('DeFiLlama getAllStablecoins error:', wrapProviderError('defillama', error));
    return null;
  }
}

/**
 * Get USDT + USDC combined supply data
 */
export async function getTrackedStablecoinSupply(): Promise<{
  totalSupply: number;
  supplies: Record<string, number>;
} | null> {
  try {
    const stablecoins = await getAllStablecoins();
    if (!stablecoins) return null;

    const supplies: Record<string, number> = {};
    let totalSupply = 0;

    for (const coin of stablecoins) {
      if (TRACKED_STABLECOINS.includes(coin.symbol.toUpperCase())) {
        const supply = coin.circulating?.peggedUSD || 0;
        supplies[coin.symbol.toUpperCase()] = supply;
        totalSupply += supply;
      }
    }

    return { totalSupply, supplies };
  } catch (error) {
    console.error('DeFiLlama getTrackedStablecoinSupply error:', wrapProviderError('defillama', error));
    return null;
  }
}

/**
 * Get historical stablecoin data for a specific stablecoin
 */
export async function getStablecoinHistory(
  stablecoinId: string
): Promise<StablecoinChartData[] | null> {
  try {
    const url = `${BASE_URL}/stablecoincharts/all?stablecoin=${stablecoinId}`;

    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    });

    const data = (await response.json()) as StablecoinChartData[];
    return data;
  } catch (error) {
    console.error('DeFiLlama getStablecoinHistory error:', wrapProviderError('defillama', error));
    return null;
  }
}

/**
 * Get 30-day supply change for tracked stablecoins
 */
export async function get30DaySupplyChange(): Promise<{
  currentSupply: number;
  supply30DaysAgo: number;
  netChange: number;
  percentChange: number;
} | null> {
  try {
    const stablecoins = await getAllStablecoins();
    if (!stablecoins) return null;

    let currentSupply = 0;
    let supply30DaysAgo = 0;

    for (const coin of stablecoins) {
      if (TRACKED_STABLECOINS.includes(coin.symbol.toUpperCase())) {
        const current = coin.circulating?.peggedUSD || 0;
        const prev = coin.circulatingPrevMonth?.peggedUSD || current;

        currentSupply += current;
        supply30DaysAgo += prev;
      }
    }

    const netChange = currentSupply - supply30DaysAgo;
    const percentChange = supply30DaysAgo > 0 ? (netChange / supply30DaysAgo) * 100 : 0;

    return {
      currentSupply,
      supply30DaysAgo,
      netChange,
      percentChange,
    };
  } catch (error) {
    console.error('DeFiLlama get30DaySupplyChange error:', wrapProviderError('defillama', error));
    return null;
  }
}

/**
 * Get stablecoin supply signal data
 * Returns all data needed for the stablecoin supply signal
 */
export async function getStablecoinSignalData(): Promise<{
  totalSupply: number;
  supplies: Record<string, number>;
  change30d: {
    netChange: number;
    percentChange: number;
  };
} | null> {
  try {
    const [supplyData, changeData] = await Promise.all([
      getTrackedStablecoinSupply(),
      get30DaySupplyChange(),
    ]);

    if (!supplyData || !changeData) return null;

    return {
      totalSupply: supplyData.totalSupply,
      supplies: supplyData.supplies,
      change30d: {
        netChange: changeData.netChange,
        percentChange: changeData.percentChange,
      },
    };
  } catch (error) {
    console.error('DeFiLlama getStablecoinSignalData error:', wrapProviderError('defillama', error));
    return null;
  }
}

