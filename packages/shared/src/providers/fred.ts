import { FREDObservation, FREDSeriesResponse } from '../types';
import { retryWithBackoff, wrapProviderError, calculateYoYChange } from '../utils';

const BASE_URL = 'https://api.stlouisfed.org/fred';

// FRED series IDs (defaults, can be overridden via env)
// DXY proxy: Trade Weighted U.S. Dollar Index: Broad, Goods and Services
const DXY_SERIES_ID = 'DTWEXBGS';
// Fed Balance Sheet: Total Assets
const FED_BALANCE_SHEET_SERIES_ID = 'WALCL';
// Default TGA and RRP series IDs (can be overridden via env)
// TGA (Treasury General Account): WTREGEN
// RRP (Overnight Reverse Repo): RRPONTSYD
const DEFAULT_TGA_SERIES_ID = 'WTREGEN';
const DEFAULT_RRP_SERIES_ID = 'RRPONTSYD';

export interface FREDSeriesData {
  seriesId: string;
  observations: { date: string; value: number }[];
  latestValue: number | null;
  latestDate: string | null;
}

/**
 * Get FRED series observations - PUBLIC export for generic series access
 */
export async function getSeriesObservations(
  seriesId: string,
  apiKey: string,
  startDate?: string,
  endDate?: string
): Promise<FREDObservation[] | null> {
  try {
    let url = `${BASE_URL}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json`;

    if (startDate) {
      url += `&observation_start=${startDate}`;
    }
    if (endDate) {
      url += `&observation_end=${endDate}`;
    }

    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    });

    const data = (await response.json()) as FREDSeriesResponse;
    return data.observations || null;
  } catch (error) {
    console.error(`FRED getSeriesObservations(${seriesId}) error:`, wrapProviderError('fred', error));
    return null;
  }
}

/**
 * Parse FRED observation value (handles "." for missing data)
 */
function parseObservationValue(value: string): number | null {
  if (value === '.' || value === '') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Get the latest N observations from a series
 */
function getLatestObservations(
  observations: FREDObservation[],
  count: number
): { date: string; value: number }[] {
  const validObs = observations
    .map((obs) => ({
      date: obs.date,
      value: parseObservationValue(obs.value),
    }))
    .filter((obs): obs is { date: string; value: number } => obs.value !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return validObs.slice(0, count);
}

/**
 * Get DXY (Dollar Index) data
 * Returns current value, 20-week SMA, and trend direction
 */
export async function getDXYData(apiKey: string): Promise<{
  currentValue: number;
  sma20Week: number;
  trend: 'up' | 'down' | 'neutral';
  observations: { date: string; value: number }[];
} | null> {
  try {
    // Get last 2 years of data for SMA calculation
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const startDate = twoYearsAgo.toISOString().split('T')[0];

    const observations = await getSeriesObservations(DXY_SERIES_ID, apiKey, startDate);
    if (!observations || observations.length === 0) return null;

    const latestObs = getLatestObservations(observations, 100); // Get last 100 observations
    if (latestObs.length < 20) return null;

    const currentValue = latestObs[0].value;

    // Calculate 20-week SMA (approximately 100 daily observations, or take weekly data)
    // FRED DXY data is weekly, so take last 20 observations
    const sma20Values = latestObs.slice(0, 20).map((o) => o.value);
    const sma20Week = sma20Values.reduce((a, b) => a + b, 0) / sma20Values.length;

    // Determine trend based on current value vs SMA
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    const percentDiff = ((currentValue - sma20Week) / sma20Week) * 100;

    if (percentDiff > 1) {
      trend = 'up';
    } else if (percentDiff < -1) {
      trend = 'down';
    }

    return {
      currentValue,
      sma20Week,
      trend,
      observations: latestObs.slice(0, 20),
    };
  } catch (error) {
    console.error('FRED getDXYData error:', wrapProviderError('fred', error));
    return null;
  }
}

/**
 * Get Fed Balance Sheet data with YoY change
 */
export async function getFedBalanceSheetData(apiKey: string): Promise<{
  currentValue: number;
  yearAgoValue: number;
  yoyChange: number;
  yoyPercentChange: number;
  observations: { date: string; value: number }[];
} | null> {
  try {
    // Get last 2 years of data
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const startDate = twoYearsAgo.toISOString().split('T')[0];

    const observations = await getSeriesObservations(FED_BALANCE_SHEET_SERIES_ID, apiKey, startDate);
    if (!observations || observations.length === 0) return null;

    const latestObs = getLatestObservations(observations, 100);
    if (latestObs.length < 52) return null; // Need at least a year of weekly data

    const currentValue = latestObs[0].value;

    // Find value from approximately 52 weeks ago
    const currentDate = new Date(latestObs[0].date);
    const yearAgoDate = new Date(currentDate);
    yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);

    // Find closest observation to year ago date
    let yearAgoValue = latestObs[51].value; // Approximate
    let closestDiff = Infinity;

    for (const obs of latestObs) {
      const obsDate = new Date(obs.date);
      const diff = Math.abs(obsDate.getTime() - yearAgoDate.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        yearAgoValue = obs.value;
      }
    }

    const yoyChange = currentValue - yearAgoValue;
    const yoyPercentChange = calculateYoYChange(currentValue, yearAgoValue) ?? 0;

    return {
      currentValue,
      yearAgoValue,
      yoyChange,
      yoyPercentChange: yoyPercentChange * 100, // Convert to percentage
      observations: latestObs.slice(0, 10),
    };
  } catch (error) {
    console.error('FRED getFedBalanceSheetData error:', wrapProviderError('fred', error));
    return null;
  }
}

/**
 * Combined macro data fetch
 */
export async function getMacroData(apiKey: string): Promise<{
  dxy: Awaited<ReturnType<typeof getDXYData>>;
  fedBalanceSheet: Awaited<ReturnType<typeof getFedBalanceSheetData>>;
} | null> {
  try {
    const [dxy, fedBalanceSheet] = await Promise.all([
      getDXYData(apiKey),
      getFedBalanceSheetData(apiKey),
    ]);

    return { dxy, fedBalanceSheet };
  } catch (error) {
    console.error('FRED getMacroData error:', wrapProviderError('fred', error));
    return null;
  }
}

/**
 * Get generic series data with parsed observations
 */
export async function getSeriesData(
  seriesId: string,
  apiKey: string,
  lookbackYears: number = 2
): Promise<FREDSeriesData | null> {
  try {
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - lookbackYears);
    const startDateStr = startDate.toISOString().split('T')[0];

    const observations = await getSeriesObservations(seriesId, apiKey, startDateStr);
    if (!observations || observations.length === 0) return null;

    const parsedObs = getLatestObservations(observations, 200);
    if (parsedObs.length === 0) return null;

    return {
      seriesId,
      observations: parsedObs,
      latestValue: parsedObs[0]?.value ?? null,
      latestDate: parsedObs[0]?.date ?? null,
    };
  } catch (error) {
    console.error(`FRED getSeriesData(${seriesId}) error:`, wrapProviderError('fred', error));
    return null;
  }
}

/**
 * Get TGA (Treasury General Account) data
 * Rising TGA drains liquidity from the system
 */
export async function getTGAData(
  apiKey: string,
  seriesId?: string
): Promise<FREDSeriesData | null> {
  const id = seriesId || process.env.FRED_TGA_SERIES_ID || DEFAULT_TGA_SERIES_ID;
  return getSeriesData(id, apiKey, 2);
}

/**
 * Get RRP (Overnight Reverse Repo) data
 * Rising RRP drains liquidity from the system
 */
export async function getRRPData(
  apiKey: string,
  seriesId?: string
): Promise<FREDSeriesData | null> {
  const id = seriesId || process.env.FRED_RRP_SERIES_ID || DEFAULT_RRP_SERIES_ID;
  return getSeriesData(id, apiKey, 2);
}

/**
 * Get Liquidity Plumbing data (TGA + RRP combined)
 * Returns both series for impulse calculation
 */
export async function getLiquidityPlumbingData(
  apiKey: string,
  tgaSeriesId?: string,
  rrpSeriesId?: string
): Promise<{
  tga: FREDSeriesData | null;
  rrp: FREDSeriesData | null;
} | null> {
  try {
    const [tga, rrp] = await Promise.all([
      getTGAData(apiKey, tgaSeriesId),
      getRRPData(apiKey, rrpSeriesId),
    ]);

    return { tga, rrp };
  } catch (error) {
    console.error('FRED getLiquidityPlumbingData error:', wrapProviderError('fred', error));
    return null;
  }
}

