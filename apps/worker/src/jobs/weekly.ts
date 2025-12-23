import {
  Asset,
  log,
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
} from './common';

const JOB_NAME = 'weekly';

export async function runWeeklyJob(): Promise<boolean> {
  // Acquire lock
  const lock = await acquireJobLock(JOB_NAME, 'weekly');
  if (!lock) {
    return false;
  }

  const { id: jobRunId, lockKey } = lock;
  log(JOB_NAME, lockKey, 'Starting weekly job');

  try {
    const fredApiKey = process.env.FRED_API_KEY || '';

    // Get a reference price (BTC as proxy for crypto market)
    const btcPrice = await getLatestPrice(Asset.BTC);

    // Step 1: Stablecoin Supply Signal
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
      // Store a NEUTRAL state for tracking
      const neutralResult = computeStablecoinSupplySignal(null);
      await processSignalResult(neutralResult, btcPrice);
    }

    // Step 2: DXY Trend Signal
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
          sma20Week: dxyData.sma20Week,
          trend: dxyData.trend,
          transitioned: dxyProcessed.transitioned,
        });
      } else {
        log(JOB_NAME, lockKey, 'Failed to fetch DXY data');
        const neutralResult = computeDXYTrendSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }

      // Step 3: Fed Balance Sheet Signal
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
      
      // Store NEUTRAL states for tracking
      const dxyNeutral = computeDXYTrendSignal(null);
      await processSignalResult(dxyNeutral, btcPrice);
      
      const fedNeutral = computeFedBalanceSheetSignal(null);
      await processSignalResult(fedNeutral, btcPrice);
    }

    // Step 4: Liquidity Plumbing Signal (TGA + RRP)
    if (fredApiKey) {
      log(JOB_NAME, lockKey, 'Fetching liquidity plumbing data (TGA + RRP)');
      try {
        const liquidityData = await providers.fred.getLiquidityPlumbingData(fredApiKey);

        if (liquidityData) {
          const liquidityResult = computeLiquidityPlumbingSignal(liquidityData);
          const liquidityProcessed = await processSignalResult(liquidityResult, btcPrice);

          log(JOB_NAME, lockKey, 'Liquidity plumbing signal', {
            state: liquidityResult.state,
            rawJson: liquidityResult.rawJson,
            transitioned: liquidityProcessed.transitioned,
          });
        } else {
          log(JOB_NAME, lockKey, 'Failed to fetch liquidity plumbing data');
          const neutralResult = computeLiquidityPlumbingSignal(null);
          await processSignalResult(neutralResult, btcPrice);
        }
      } catch (error) {
        log(JOB_NAME, lockKey, 'Liquidity plumbing signal error', {
          error: error instanceof Error ? error.message : String(error),
        });
        const neutralResult = computeLiquidityPlumbingSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }
    } else {
      log(JOB_NAME, lockKey, 'FRED_API_KEY not set, skipping liquidity plumbing signal');
      const neutralResult = computeLiquidityPlumbingSignal(null);
      await processSignalResult(neutralResult, btcPrice);
    }

    // Step 5: Gold Trend Signal (context-only)
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
          rawJson: goldResult.rawJson,
          transitioned: goldProcessed.transitioned,
        });
      } else {
        log(JOB_NAME, lockKey, 'Insufficient gold data', {
          dataPoints: goldOHLCV?.length || 0,
        });
        const neutralResult = computeGoldTrendSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }
    } catch (error) {
      log(JOB_NAME, lockKey, 'Gold trend signal error', {
        error: error instanceof Error ? error.message : String(error),
      });
      const neutralResult = computeGoldTrendSignal(null);
      await processSignalResult(neutralResult, btcPrice);
    }

    // Step 6: Nasdaq Trend Signal (context-only)
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
          rawJson: nasdaqResult.rawJson,
          transitioned: nasdaqProcessed.transitioned,
        });
      } else {
        log(JOB_NAME, lockKey, 'Insufficient nasdaq data', {
          dataPoints: nasdaqOHLCV?.length || 0,
        });
        const neutralResult = computeNasdaqTrendSignal(null);
        await processSignalResult(neutralResult, btcPrice);
      }
    } catch (error) {
      log(JOB_NAME, lockKey, 'Nasdaq trend signal error', {
        error: error instanceof Error ? error.message : String(error),
      });
      const neutralResult = computeNasdaqTrendSignal(null);
      await processSignalResult(neutralResult, btcPrice);
    }

    // Step 7: Evaluate matured events
    log(JOB_NAME, lockKey, 'Evaluating matured events');
    await evaluateMaturedEvents(JOB_NAME, lockKey);

    // Step 8: Recompute stats
    log(JOB_NAME, lockKey, 'Recomputing stats');
    await recomputeStats(JOB_NAME, lockKey);

    // Mark job completed
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

