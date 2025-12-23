import Decimal from 'decimal.js';
import { Horizon, HORIZON_DAYS, SignalState, OHLCV } from '../types';

// Date utilities
export function getUTCNow(): Date {
  return new Date();
}

export function truncateToHour(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export function truncateToDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function truncateToWeek(date: Date): Date {
  const d = truncateToDay(date);
  const dayOfWeek = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  return d;
}

export function formatLockKey(date: Date, frequency: 'hourly' | 'daily' | 'weekly'): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');

  switch (frequency) {
    case 'hourly':
      return `${year}${month}${day}${hour}`;
    case 'daily':
      return `${year}${month}${day}`;
    case 'weekly':
      const weekStart = truncateToWeek(date);
      const wYear = weekStart.getUTCFullYear();
      const wMonth = String(weekStart.getUTCMonth() + 1).padStart(2, '0');
      const wDay = String(weekStart.getUTCDate()).padStart(2, '0');
      return `${wYear}${wMonth}${wDay}`;
  }
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

export function getHorizonEndDate(startDate: Date, horizon: Horizon): Date {
  const days = HORIZON_DAYS[horizon];
  return addDays(startDate, days);
}

export function isHorizonMatured(eventDate: Date, horizon: Horizon, now: Date): boolean {
  const endDate = getHorizonEndDate(eventDate, horizon);
  return now >= endDate;
}

// Calculation utilities
export function calculateForwardReturn(entryPrice: Decimal, exitPrice: Decimal): Decimal {
  if (entryPrice.isZero()) return new Decimal(0);
  return exitPrice.minus(entryPrice).dividedBy(entryPrice);
}

export function evaluateSuccess(
  forwardReturn: Decimal,
  state: SignalState,
  threshold: number
): boolean | null {
  if (state === SignalState.NEUTRAL) {
    return null;
  }

  const isBullish = state === SignalState.BUY || state === SignalState.STRONG_BUY;
  const isBearish = state === SignalState.SELL || state === SignalState.STRONG_SELL;
  const returnNum = forwardReturn.toNumber();

  if (isBullish) {
    return returnNum > threshold;
  } else if (isBearish) {
    return returnNum < -threshold;
  }

  return null;
}

// Technical analysis utilities
export function calculateSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

export function calculateEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;

  const multiplier = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((acc, val) => acc + val, 0) / period;

  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }

  return ema;
}

export function calculateRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RSI using smoothed averages
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateSlope(values: number[], lookback: number): number | null {
  if (values.length < lookback) return null;

  const slice = values.slice(-lookback);
  const n = slice.length;

  // Simple linear regression slope
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += slice[i];
    sumXY += i * slice[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

export function calculateYoYChange(currentValue: number, yearAgoValue: number): number | null {
  if (yearAgoValue === 0) return null;
  return (currentValue - yearAgoValue) / yearAgoValue;
}

// OHLCV conversion utilities
export function ohlcvToCloses(ohlcv: OHLCV[]): number[] {
  return ohlcv.map((candle) => candle.close);
}

export function ohlcvToVolumes(ohlcv: OHLCV[]): number[] {
  return ohlcv.map((candle) => candle.volume);
}

// Logging utility
export function log(jobName: string, timeBucket: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    jobName,
    timeBucket,
    message,
    ...(data ? { data } : {}),
  };
  console.log(JSON.stringify(logEntry));
}

// Error wrapper for provider calls
export interface ProviderError {
  provider: string;
  error: string;
  retryable: boolean;
}

export function wrapProviderError(provider: string, error: unknown): ProviderError {
  const message = error instanceof Error ? error.message : String(error);
  const retryable =
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('ECONNRESET') ||
    message.includes('503') ||
    message.includes('429');

  return {
    provider,
    error: message,
    retryable,
  };
}

// Sleep utility for rate limiting
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

