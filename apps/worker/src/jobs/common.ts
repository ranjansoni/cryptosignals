import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import {
  Asset,
  Horizon,
  HORIZON_DAYS,
  SignalId,
  SignalResult,
  SignalState,
  StatsWindow,
  STATS_WINDOWS,
  SUCCESS_THRESHOLDS,
  calculateForwardReturn,
  evaluateSuccess,
  formatLockKey,
  isHorizonMatured,
  log,
  subtractDays,
} from '@crypto-signals/shared';
import prisma from '../db';

/**
 * Acquire a job lock based on time bucket
 * Returns the JobRun id if lock acquired, null if already locked
 */
export async function acquireJobLock(
  jobName: string,
  frequency: 'hourly' | 'daily' | 'weekly'
): Promise<{ id: number; lockKey: string } | null> {
  const now = new Date();
  const lockKey = formatLockKey(now, frequency);

  try {
    const jobRun = await prisma.jobRun.create({
      data: {
        jobName,
        lockKey,
        status: 'running',
      },
    });

    return { id: jobRun.id, lockKey };
  } catch (error) {
    // Unique constraint violation means job is already running
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      log(jobName, lockKey, 'Job already running or completed for this time bucket');
      return null;
    }
    throw error;
  }
}

/**
 * Mark job as completed
 */
export async function markJobCompleted(jobRunId: number): Promise<void> {
  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      status: 'completed',
      finishedAt: new Date(),
    },
  });
}

/**
 * Mark job as failed
 */
export async function markJobFailed(jobRunId: number, error: unknown): Promise<void> {
  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: {
      status: 'failed',
      finishedAt: new Date(),
      errorJson: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    },
  });
}

/**
 * Upsert price data
 */
export async function upsertPrice(
  asset: Asset,
  ts: Date,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  source: string
): Promise<void> {
  await prisma.price.upsert({
    where: {
      asset_ts_source: { asset, ts, source },
    },
    update: {
      open: new Decimal(open),
      high: new Decimal(high),
      low: new Decimal(low),
      close: new Decimal(close),
      volume: new Decimal(volume),
    },
    create: {
      asset,
      ts,
      open: new Decimal(open),
      high: new Decimal(high),
      low: new Decimal(low),
      close: new Decimal(close),
      volume: new Decimal(volume),
      source,
    },
  });
}

/**
 * Upsert signal state and check for transitions
 */
export async function processSignalResult(
  result: SignalResult,
  entryPrice: number | null
): Promise<{ transitioned: boolean; prevState: SignalState | undefined }> {
  const { signalId, asset, ts, state, rawJson } = result;

  // Get the latest previous state
  const latestState = await prisma.signalState.findFirst({
    where: { signalId, asset },
    orderBy: { ts: 'desc' },
  });

  // Upsert the new state
  await prisma.signalState.create({
    data: {
      signalId,
      asset,
      ts,
      state,
      rawJson: rawJson as Prisma.JsonObject,
    },
  });

  // Check for state transition
  const prevState = latestState?.state as SignalState | undefined;
  const transitioned = prevState !== undefined && prevState !== state;

  // If transitioned, create a signal event
  if (transitioned && entryPrice !== null) {
    try {
      await prisma.signalEvent.create({
        data: {
          signalId,
          asset,
          ts,
          prevState: prevState!,
          newState: state,
          entryPrice: new Decimal(entryPrice),
          horizonsJson: [Horizon.D1, Horizon.D7, Horizon.D30],
        },
      });
    } catch (error) {
      // Ignore duplicate event errors (idempotency constraint)
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
  }

  return { transitioned, prevState };
}

/**
 * Evaluate matured events and create outcomes
 */
export async function evaluateMaturedEvents(
  jobName: string,
  lockKey: string
): Promise<number> {
  const now = new Date();
  let evaluatedCount = 0;

  // Find events without outcomes for each horizon
  for (const horizon of [Horizon.D1, Horizon.D7, Horizon.D30]) {
    const horizonDays = HORIZON_DAYS[horizon];
    const threshold = SUCCESS_THRESHOLDS[horizon];

    // Find events that should have matured for this horizon
    const maturityCutoff = subtractDays(now, horizonDays);

    const eventsToEvaluate = await prisma.signalEvent.findMany({
      where: {
        ts: { lte: maturityCutoff },
        outcomes: {
          none: {
            horizon,
          },
        },
      },
      include: {
        outcomes: true,
      },
    });

    for (const event of eventsToEvaluate) {
      // Skip NEUTRAL states
      if (event.newState === SignalState.NEUTRAL) continue;

      // Calculate exit timestamp
      const exitTs = new Date(event.ts.getTime() + horizonDays * 24 * 60 * 60 * 1000);

      // Get exit price from prices table
      const exitPriceRecord = await prisma.price.findFirst({
        where: {
          asset: event.asset,
          ts: { lte: exitTs },
        },
        orderBy: { ts: 'desc' },
      });

      if (!exitPriceRecord) {
        log(jobName, lockKey, `No exit price found for event ${event.id}, horizon ${horizon}`);
        continue;
      }

      // Calculate forward return
      const entryPrice = new Decimal(event.entryPrice);
      const exitPrice = new Decimal(exitPriceRecord.close);
      const forwardReturn = calculateForwardReturn(entryPrice, exitPrice);

      // Evaluate success
      const success = evaluateSuccess(forwardReturn, event.newState as SignalState, threshold);

      // Create outcome
      try {
        await prisma.signalOutcome.create({
          data: {
            eventId: event.id,
            horizon,
            exitTs: exitPriceRecord.ts,
            exitPrice,
            forwardReturn,
            success,
          },
        });
        evaluatedCount++;
      } catch (error) {
        // Ignore duplicate outcomes
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          throw error;
        }
      }
    }
  }

  log(jobName, lockKey, `Evaluated ${evaluatedCount} matured events`);
  return evaluatedCount;
}

/**
 * Recompute signal statistics for rolling windows
 */
export async function recomputeStats(
  jobName: string,
  lockKey: string
): Promise<void> {
  const now = new Date();

  // Get all unique signal/asset/horizon combinations
  const combinations = await prisma.signalEvent.groupBy({
    by: ['signalId', 'asset'],
  });

  for (const { signalId, asset } of combinations) {
    for (const horizon of [Horizon.D1, Horizon.D7, Horizon.D30]) {
      for (const window of STATS_WINDOWS) {
        const windowDays = window === '90d' ? 90 : 365;
        const windowStart = subtractDays(now, windowDays);

        // Get outcomes within the window
        const outcomes = await prisma.signalOutcome.findMany({
          where: {
            horizon,
            event: {
              signalId,
              asset,
              ts: { gte: windowStart },
            },
          },
          include: {
            event: true,
          },
        });

        // Calculate stats
        const nEvents = outcomes.length;
        const successfulEvents = outcomes.filter((o) => o.success === true).length;
        const hitRate = nEvents > 0 ? successfulEvents / nEvents : null;
        const avgReturn =
          nEvents > 0
            ? outcomes.reduce((sum, o) => sum + Number(o.forwardReturn), 0) / nEvents
            : null;

        // Upsert stats
        await prisma.signalStats.upsert({
          where: {
            signalId_asset_horizon_window: {
              signalId,
              asset,
              horizon,
              window,
            },
          },
          update: {
            nEvents,
            hitRate: hitRate !== null ? new Decimal(hitRate) : null,
            avgReturn: avgReturn !== null ? new Decimal(avgReturn) : null,
          },
          create: {
            signalId,
            asset,
            horizon,
            window,
            nEvents,
            hitRate: hitRate !== null ? new Decimal(hitRate) : null,
            avgReturn: avgReturn !== null ? new Decimal(avgReturn) : null,
          },
        });
      }
    }
  }

  log(jobName, lockKey, 'Stats recomputation completed');
}

/**
 * Get latest price for an asset
 */
export async function getLatestPrice(asset: Asset): Promise<number | null> {
  const price = await prisma.price.findFirst({
    where: { asset },
    orderBy: { ts: 'desc' },
  });
  return price ? Number(price.close) : null;
}

