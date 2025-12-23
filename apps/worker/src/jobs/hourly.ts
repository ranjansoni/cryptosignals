import {
  Asset,
  log,
  providers,
  computeFundingRateSignal,
  computeOpenInterestSignal,
} from '@crypto-signals/shared';
import {
  acquireJobLock,
  markJobCompleted,
  markJobFailed,
  upsertPrice,
  processSignalResult,
  evaluateMaturedEvents,
  recomputeStats,
} from './common';

const JOB_NAME = 'hourly';

export async function runHourlyJob(): Promise<boolean> {
  // Acquire lock
  const lock = await acquireJobLock(JOB_NAME, 'hourly');
  if (!lock) {
    return false;
  }

  const { id: jobRunId, lockKey } = lock;
  log(JOB_NAME, lockKey, 'Starting hourly job');

  try {
    const assets = [Asset.BTC, Asset.ETH, Asset.SOL, Asset.XRP];
    const coinglassApiKey = process.env.COINGLASS_API_KEY || '';

    // Map assets to CoinGecko coin IDs
    const assetToCoinId: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      SOL: 'solana',
      XRP: 'ripple',
    };

    // Step 1: Fetch current prices
    log(JOB_NAME, lockKey, 'Fetching current prices');
    const prices = await providers.coingecko.getSimplePrices(assets);

    if (!prices) {
      log(JOB_NAME, lockKey, 'Failed to fetch prices', { error: 'no_price_data' });
    }

    // Step 2: Fetch and store prices, compute signals per asset
    for (const asset of assets) {
      const coinId = assetToCoinId[asset];
      const priceData = prices?.[coinId];
      const currentPrice = priceData?.usd || null;
      const priceChange24h = priceData?.usd_24h_change || 0;

      // Store price if available
      if (currentPrice) {
        const now = new Date();
        await upsertPrice(
          asset,
          now,
          currentPrice,
          currentPrice,
          currentPrice,
          currentPrice,
          0,
          'coingecko'
        );
        log(JOB_NAME, lockKey, `Stored price for ${asset}`, { price: currentPrice });
      }

      // Fetch derivatives data from CoinGlass
      log(JOB_NAME, lockKey, `Fetching derivatives data for ${asset}`);
      const derivativesData = await providers.coinglass.getDerivativesData(asset, coinglassApiKey);

      // Compute Funding Rate signal
      const fundingInput = derivativesData?.fundingRate
        ? {
            fundingRate: derivativesData.fundingRate.fundingRate,
            nextFundingTime: derivativesData.fundingRate.nextFundingTime,
          }
        : null;

      const fundingResult = computeFundingRateSignal(asset, fundingInput);
      const fundingProcessed = await processSignalResult(fundingResult, currentPrice);

      log(JOB_NAME, lockKey, `Funding rate signal for ${asset}`, {
        state: fundingResult.state,
        transitioned: fundingProcessed.transitioned,
        prevState: fundingProcessed.prevState,
      });

      // Compute Open Interest signal
      const oiInput = derivativesData?.openInterest
        ? {
            openInterest: derivativesData.openInterest.openInterestUSD,
            change24h: derivativesData.openInterest.change24h,
            priceChange24h,
          }
        : null;

      const oiResult = computeOpenInterestSignal(asset, oiInput);
      const oiProcessed = await processSignalResult(oiResult, currentPrice);

      log(JOB_NAME, lockKey, `Open interest signal for ${asset}`, {
        state: oiResult.state,
        transitioned: oiProcessed.transitioned,
        prevState: oiProcessed.prevState,
      });
    }

    // Step 3: Evaluate matured events
    log(JOB_NAME, lockKey, 'Evaluating matured events');
    await evaluateMaturedEvents(JOB_NAME, lockKey);

    // Step 4: Recompute stats
    log(JOB_NAME, lockKey, 'Recomputing stats');
    await recomputeStats(JOB_NAME, lockKey);

    // Mark job completed
    await markJobCompleted(jobRunId);
    log(JOB_NAME, lockKey, 'Hourly job completed successfully');

    return true;
  } catch (error) {
    log(JOB_NAME, lockKey, 'Hourly job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await markJobFailed(jobRunId, error);
    throw error;
  }
}

