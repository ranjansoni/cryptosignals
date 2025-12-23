import {
  Asset,
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
  log,
} from './common';

const JOB_NAME = 'hourly';

export async function runHourlyJob(): Promise<boolean> {
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

    log(JOB_NAME, lockKey, 'Fetching current prices');
    const prices = await providers.coingecko.getSimplePrices(assets);

    if (!prices) {
      log(JOB_NAME, lockKey, 'Failed to fetch prices', { error: 'no_price_data' });
    }

    for (const asset of assets) {
      const coinId = assetToCoinId[asset];
      const priceData = prices?.[coinId];
      const currentPrice = priceData?.usd || null;
      const priceChange24h = priceData?.usd_24h_change || 0;

      if (currentPrice) {
        const now = new Date();
        await upsertPrice(asset, now, currentPrice, currentPrice, currentPrice, currentPrice, 0, 'coingecko');
        log(JOB_NAME, lockKey, `Stored price for ${asset}`, { price: currentPrice });
      }

      log(JOB_NAME, lockKey, `Fetching derivatives data for ${asset}`);
      const derivativesData = await providers.coinglass.getDerivativesData(asset, coinglassApiKey);

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
      });

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
      });
    }

    log(JOB_NAME, lockKey, 'Evaluating matured events');
    await evaluateMaturedEvents(JOB_NAME, lockKey);

    log(JOB_NAME, lockKey, 'Recomputing stats');
    await recomputeStats(JOB_NAME, lockKey);

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

