import { OHLCV } from '../types';
import { retryWithBackoff, wrapProviderError } from '../utils';

/**
 * Market Data Provider - Fetches daily OHLCV for traditional assets
 * 
 * Default backend: Stooq (free, no API key required)
 * Symbols:
 *   - Gold: GLD (ETF proxy) or XAUUSD
 *   - Nasdaq: QQQ (ETF proxy)
 */

const STOOQ_BASE_URL = 'https://stooq.com/q/d/l/';

// Symbol mappings for Stooq
const STOOQ_SYMBOL_MAP: Record<string, string> = {
  'GLD': 'gld.us',
  'XAUUSD': 'xauusd',
  'QQQ': 'qqq.us',
  'SPY': 'spy.us',
  'NDX': '^ndx',
};

interface MarketDataCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Parse Stooq CSV response into candles
 * Format: Date,Open,High,Low,Close,Volume
 */
function parseStooqCSV(csv: string): MarketDataCandle[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const candles: MarketDataCandle[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 5) continue;

    const [date, open, high, low, close, volume] = parts;
    
    // Validate data
    const openNum = parseFloat(open);
    const highNum = parseFloat(high);
    const lowNum = parseFloat(low);
    const closeNum = parseFloat(close);
    const volumeNum = parseFloat(volume) || 0;

    if (isNaN(openNum) || isNaN(closeNum)) continue;

    candles.push({
      date,
      open: openNum,
      high: highNum,
      low: lowNum,
      close: closeNum,
      volume: volumeNum,
    });
  }

  // Stooq returns newest first, we want oldest first
  return candles.reverse();
}

/**
 * Fetch daily OHLCV from Stooq
 */
async function fetchStooqOHLCV(
  symbol: string,
  lookbackDays: number = 365
): Promise<MarketDataCandle[] | null> {
  try {
    const stooqSymbol = STOOQ_SYMBOL_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    const d1 = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const d2 = endDate.toISOString().split('T')[0].replace(/-/g, '');

    const url = `${STOOQ_BASE_URL}?s=${stooqSymbol}&d1=${d1}&d2=${d2}&i=d`;

    const response = await retryWithBackoff(async () => {
      const res = await fetch(url, {
        headers: {
          'Accept': 'text/csv',
          'User-Agent': 'Mozilla/5.0 (compatible; CryptoSignals/1.0)',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return res;
    });

    const csv = await response.text();
    
    // Check for error responses
    if (csv.includes('No data') || csv.length < 50) {
      console.error(`Stooq: No data for symbol ${symbol}`);
      return null;
    }

    return parseStooqCSV(csv);
  } catch (error) {
    console.error(`Stooq fetchOHLCV(${symbol}) error:`, wrapProviderError('stooq', error));
    return null;
  }
}

/**
 * Convert MarketDataCandle to OHLCV format
 */
function candlesToOHLCV(candles: MarketDataCandle[]): OHLCV[] {
  return candles.map((c) => ({
    timestamp: new Date(c.date).getTime(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

/**
 * Get daily OHLCV data for a symbol
 * 
 * @param symbol - Asset symbol (GLD, QQQ, XAUUSD, etc.)
 * @param lookbackDays - Number of days of history to fetch
 * @param backend - Data backend to use (default: 'stooq')
 */
export async function getDailyOHLCV(
  symbol: string,
  lookbackDays: number = 365,
  backend: 'stooq' = 'stooq'
): Promise<OHLCV[] | null> {
  try {
    let candles: MarketDataCandle[] | null = null;

    switch (backend) {
      case 'stooq':
      default:
        candles = await fetchStooqOHLCV(symbol, lookbackDays);
        break;
    }

    if (!candles || candles.length === 0) {
      return null;
    }

    return candlesToOHLCV(candles);
  } catch (error) {
    console.error(`getDailyOHLCV(${symbol}) error:`, wrapProviderError('marketData', error));
    return null;
  }
}

/**
 * Get closing prices for a symbol
 */
export async function getClosingPrices(
  symbol: string,
  lookbackDays: number = 365,
  backend: 'stooq' = 'stooq'
): Promise<{ dates: string[]; closes: number[] } | null> {
  try {
    let candles: MarketDataCandle[] | null = null;

    switch (backend) {
      case 'stooq':
      default:
        candles = await fetchStooqOHLCV(symbol, lookbackDays);
        break;
    }

    if (!candles || candles.length === 0) {
      return null;
    }

    return {
      dates: candles.map((c) => c.date),
      closes: candles.map((c) => c.close),
    };
  } catch (error) {
    console.error(`getClosingPrices(${symbol}) error:`, wrapProviderError('marketData', error));
    return null;
  }
}

/**
 * Get latest price for a symbol
 */
export async function getLatestPrice(
  symbol: string,
  backend: 'stooq' = 'stooq'
): Promise<{ price: number; date: string } | null> {
  const data = await getClosingPrices(symbol, 10, backend);
  if (!data || data.closes.length === 0) return null;

  const lastIdx = data.closes.length - 1;
  return {
    price: data.closes[lastIdx],
    date: data.dates[lastIdx],
  };
}

