import {
  Asset,
  providers,
  computeRSISignal,
  computeMA200RegimeSignal,
  ohlcvToCloses,
} from '@crypto-signals/shared';
import {
  acquireJobLock,
  markJobCompleted,
  markJobFailed,
  upsertPrice,
  processSignalResult,
  evaluateMaturedEvents,
  recomputeStats,
  getLatestPrice,
  log,
} from './common';

const JOB_NAME = 'daily';

export async function runDailyJob(): Promise<boolean> {
  const lock = await acquireJobLock(JOB_NAME, 'daily');
  if (!lock) {
    return false;
  }

  const { id: jobRunId, lockKey } = lock;
  log(JOB_NAME, lockKey, 'Starting daily job');

  try {
    const assets = [Asset.BTC, Asset.ETH, Asset.SOL, Asset.XRP];

    for (const asset of assets) {
      log(JOB_NAME, lockKey, `Fetching OHLCV data for ${asset}`);

      const marketChart = await providers.coingecko.getMarketChart(asset, 365);

      if (!marketChart) {
        log(JOB_NAME, lockKey, `Failed to fetch market chart for ${asset}`);
        continue;
      }

      const ohlcv = providers.coingecko.marketChartToOHLCV(marketChart);
      const closes = ohlcvToCloses(ohlcv);

      if (ohlcv.length < 200) {
        log(JOB_NAME, lockKey, `Insufficient data for ${asset}`, {
          dataPoints: ohlcv.length,
          required: 200,
        });
        continue;
      }

      const latestCandle = ohlcv[ohlcv.length - 1];
      if (latestCandle) {
        await upsertPrice(
          asset,
          new Date(latestCandle.timestamp),
          latestCandle.open,
          latestCandle.high,
          latestCandle.low,
          latestCandle.close,
          latestCandle.volume,
          'coingecko'
        );
      }

      const currentPrice = await getLatestPrice(asset) || latestCandle?.close || null;

      log(JOB_NAME, lockKey, `Computing RSI for ${asset}`);
      const rsiResult = computeRSISignal(asset, { closes, period: 14 });
      const rsiProcessed = await processSignalResult(rsiResult, currentPrice);

      log(JOB_NAME, lockKey, `RSI signal for ${asset}`, {
        state: rsiResult.state,
        rsi: (rsiResult.rawJson as { rsi?: number }).rsi,
        transitioned: rsiProcessed.transitioned,
      });

      log(JOB_NAME, lockKey, `Computing MA200 regime for ${asset}`);
      const ma200Result = computeMA200RegimeSignal(asset, {
        closes,
        currentPrice: currentPrice || closes[closes.length - 1],
      });
      const ma200Processed = await processSignalResult(ma200Result, currentPrice);

      log(JOB_NAME, lockKey, `MA200 regime signal for ${asset}`, {
        state: ma200Result.state,
        regime: (ma200Result.rawJson as { regime?: string }).regime,
        transitioned: ma200Processed.transitioned,
      });
    }

    log(JOB_NAME, lockKey, 'Evaluating matured events');
    await evaluateMaturedEvents(JOB_NAME, lockKey);

    log(JOB_NAME, lockKey, 'Recomputing stats');
    await recomputeStats(JOB_NAME, lockKey);

    await markJobCompleted(jobRunId);
    log(JOB_NAME, lockKey, 'Daily job completed successfully');

    return true;
  } catch (error) {
    log(JOB_NAME, lockKey, 'Daily job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await markJobFailed(jobRunId, error);
    throw error;
  }
}

