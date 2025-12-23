import {
  Asset,
  providers,
  computeStablecoinSupplySignal,
  computeDXYTrendSignal,
  computeFedBalanceSheetSignal,
  computeLiquidityPlumbingSignal,
  computeGoldTrendSignal,
  computeNasdaqTrendSignal,
} from '@crypto-signals/shared';
import {
  acquireJobLock,
  markJobCompleted,
  markJobFailed,
  processSignalResult,
  evaluateMaturedEvents,
  recomputeStats,
  getLatestPrice,
  log,
} from './common';

const JOB_NAME = 'weekly';

export async function runWeeklyJob(): Promise<boolean> {
  const lock = await acquireJobLock(JOB_NAME, 'weekly');
  if (!lock) {
    return false;
  }

  const { id: jobRunId, lockKey } = lock;
  log(JOB_NAME, lockKey, 'Starting weekly job');

  try {
    const fredApiKey = process.env.FRED_API_KEY || '';
    const btcPrice = await getLatestPrice(Asset.BTC);

    log(JOB_NAME, lockKey, 'Fetching stablecoin supply data');
    const stablecoinData = await providers.defillama.getStablecoinSignalData();

    if (stablecoinData) {
      const stablecoinResult = computeStablecoinSupplySignal({
        totalSupply: stablecoinData.totalSupply,
        change30d: stablecoinData.change30d,
      });
      const stablecoinProcessed = await processSignalResult(stablecoinResult, btcPrice);

      log(JOB_NAME, lockKey, 'Stablecoin supply signal', {
        state: stablecoinResult.state,
        totalSupply: stablecoinData.totalSupply,
        percentChange: stablecoinData.change30d.percentChange,
        transitioned: stablecoinProcessed.transitioned,
      });
    } else {
      log(JOB_NAME, lockKey, 'Failed to fetch stablecoin data');
      const neutralResult = computeStablecoinSupplySignal(null);
      await processSignalResult(neutralResult, btcPrice);
    }

    if (fredApiKey) {
      log(JOB_NAME, lockKey, 'Fetching DXY data');
      const dxyData = await providers.fred.getDXYData(fredApiKey);

      if (dxyData) {
        const dxyResult = computeDXYTrendSignal({
          currentValue: dxyData.currentValue,
          sma20Week: dxyData.sma20Week,
          trend: dxyData.trend,
        });
        const dxyProcessed = await processSignalResult(dxyResult, btcPrice);

        log(JOB_NAME, lockKey, 'DXY trend signal', {
          state: dxyResult.state,
          currentValue: dxyData.currentValue,
          trend: dxyData.trend,
          transitioned: dxyProcessed.transitioned,
        });
      } else {
        log(JOB_NAME, lockKey, 'Failed to fetch DXY data');
        const neutralResult = computeDXYTrendSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }

      log(JOB_NAME, lockKey, 'Fetching Fed balance sheet data');
      const fedData = await providers.fred.getFedBalanceSheetData(fredApiKey);

      if (fedData) {
        const fedResult = computeFedBalanceSheetSignal({
          currentValue: fedData.currentValue,
          yearAgoValue: fedData.yearAgoValue,
          yoyChange: fedData.yoyChange,
          yoyPercentChange: fedData.yoyPercentChange,
        });
        const fedProcessed = await processSignalResult(fedResult, btcPrice);

        log(JOB_NAME, lockKey, 'Fed balance sheet signal', {
          state: fedResult.state,
          yoyPercentChange: fedData.yoyPercentChange,
          transitioned: fedProcessed.transitioned,
        });
      } else {
        log(JOB_NAME, lockKey, 'Failed to fetch Fed balance sheet data');
        const neutralResult = computeFedBalanceSheetSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }
    } else {
      log(JOB_NAME, lockKey, 'FRED_API_KEY not set, skipping DXY and Fed signals');
      const dxyNeutral = computeDXYTrendSignal(null);
      await processSignalResult(dxyNeutral, btcPrice);
      const fedNeutral = computeFedBalanceSheetSignal(null);
      await processSignalResult(fedNeutral, btcPrice);
    }

    // Liquidity Plumbing Signal (TGA + RRP)
    if (fredApiKey) {
      log(JOB_NAME, lockKey, 'Fetching liquidity plumbing data');
      try {
        const liquidityData = await providers.fred.getLiquidityPlumbingData(fredApiKey);
        if (liquidityData) {
          const liquidityResult = computeLiquidityPlumbingSignal(liquidityData);
          const liquidityProcessed = await processSignalResult(liquidityResult, btcPrice);
          log(JOB_NAME, lockKey, 'Liquidity plumbing signal', {
            state: liquidityResult.state,
            transitioned: liquidityProcessed.transitioned,
          });
        } else {
          const neutralResult = computeLiquidityPlumbingSignal(null);
          await processSignalResult(neutralResult, btcPrice);
        }
      } catch (error) {
        log(JOB_NAME, lockKey, 'Liquidity plumbing error', { error: String(error) });
        const neutralResult = computeLiquidityPlumbingSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }
    } else {
      const neutralResult = computeLiquidityPlumbingSignal(null);
      await processSignalResult(neutralResult, btcPrice);
    }

    // Gold Trend Signal (context-only)
    log(JOB_NAME, lockKey, 'Fetching gold trend data');
    try {
      const goldSymbol = process.env.GOLD_SYMBOL || 'GLD';
      const goldOHLCV = await providers.marketData.getDailyOHLCV(goldSymbol, 365);
      if (goldOHLCV && goldOHLCV.length >= 200) {
        const goldResult = computeGoldTrendSignal({
          symbol: goldSymbol,
          ohlcv: goldOHLCV,
          backend: 'stooq',
        });
        const goldProcessed = await processSignalResult(goldResult, btcPrice);
        log(JOB_NAME, lockKey, 'Gold trend signal', {
          state: goldResult.state,
          transitioned: goldProcessed.transitioned,
        });
      } else {
        const neutralResult = computeGoldTrendSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }
    } catch (error) {
      log(JOB_NAME, lockKey, 'Gold trend error', { error: String(error) });
      const neutralResult = computeGoldTrendSignal(null);
      await processSignalResult(neutralResult, btcPrice);
    }

    // Nasdaq Trend Signal (context-only)
    log(JOB_NAME, lockKey, 'Fetching nasdaq trend data');
    try {
      const nasdaqSymbol = process.env.NASDAQ_SYMBOL || 'QQQ';
      const nasdaqOHLCV = await providers.marketData.getDailyOHLCV(nasdaqSymbol, 365);
      if (nasdaqOHLCV && nasdaqOHLCV.length >= 200) {
        const nasdaqResult = computeNasdaqTrendSignal({
          symbol: nasdaqSymbol,
          ohlcv: nasdaqOHLCV,
          backend: 'stooq',
        });
        const nasdaqProcessed = await processSignalResult(nasdaqResult, btcPrice);
        log(JOB_NAME, lockKey, 'Nasdaq trend signal', {
          state: nasdaqResult.state,
          transitioned: nasdaqProcessed.transitioned,
        });
      } else {
        const neutralResult = computeNasdaqTrendSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }
    } catch (error) {
      log(JOB_NAME, lockKey, 'Nasdaq trend error', { error: String(error) });
      const neutralResult = computeNasdaqTrendSignal(null);
      await processSignalResult(neutralResult, btcPrice);
    }

    log(JOB_NAME, lockKey, 'Evaluating matured events');
    await evaluateMaturedEvents(JOB_NAME, lockKey);

    log(JOB_NAME, lockKey, 'Recomputing stats');
    await recomputeStats(JOB_NAME, lockKey);

    await markJobCompleted(jobRunId);
    log(JOB_NAME, lockKey, 'Weekly job completed successfully');

    return true;
  } catch (error) {
    log(JOB_NAME, lockKey, 'Weekly job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await markJobFailed(jobRunId, error);
    throw error;
  }
}

