import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import {
  Horizon,
  HORIZON_DAYS,
  SignalResult,
  SignalState,
  STATS_WINDOWS,
  SUCCESS_THRESHOLDS,
  calculateForwardReturn,
  evaluateSuccess,
  formatLockKey,
  subtractDays,
} from '@crypto-signals/shared';
import prisma from '../db';

/**
 * Simple logging function
 */
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

/**
 * Acquire a job lock based on time bucket
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
  asset: string,
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
 * Process a signal result and check for state transitions
 */
export async function processSignalResult(
  result: SignalResult,
  entryPrice: number | null
): Promise<{ transitioned: boolean; prevState: SignalState | undefined }> {
  const { signalId, asset, ts, state, rawJson } = result;

  const latestState = await prisma.signalState.findFirst({
    where: { signalId, asset },
    orderBy: { ts: 'desc' },
  });

  await prisma.signalState.create({
    data: {
      signalId,
      asset,
      ts,
      state,
      rawJson: rawJson as Prisma.JsonObject,
    },
  });

  const prevState = latestState?.state as SignalState | undefined;
  const transitioned = prevState !== undefined && prevState !== state;

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
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
  }

  return { transitioned, prevState };
}

/**
 * Evaluate matured events
 */
export async function evaluateMaturedEvents(
  jobName: string,
  lockKey: string
): Promise<number> {
  const now = new Date();
  let evaluatedCount = 0;

  for (const horizon of [Horizon.D1, Horizon.D7, Horizon.D30]) {
    const horizonDays = HORIZON_DAYS[horizon];
    const threshold = SUCCESS_THRESHOLDS[horizon];
    const maturityCutoff = subtractDays(now, horizonDays);

    const eventsToEvaluate = await prisma.signalEvent.findMany({
      where: {
        ts: { lte: maturityCutoff },
        outcomes: {
          none: { horizon },
        },
      },
      include: { outcomes: true },
    });

    for (const event of eventsToEvaluate) {
      if (event.newState === SignalState.NEUTRAL) continue;

      const exitTs = new Date(event.ts.getTime() + horizonDays * 24 * 60 * 60 * 1000);

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

      const entryPrice = new Decimal(event.entryPrice);
      const exitPrice = new Decimal(exitPriceRecord.close);
      const forwardReturn = calculateForwardReturn(entryPrice, exitPrice);
      const success = evaluateSuccess(forwardReturn, event.newState as SignalState, threshold);

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
 * Recompute signal statistics
 */
export async function recomputeStats(
  jobName: string,
  lockKey: string
): Promise<void> {
  const now = new Date();

  const combinations = await prisma.signalEvent.groupBy({
    by: ['signalId', 'asset'],
  });

  for (const { signalId, asset } of combinations) {
    for (const horizon of [Horizon.D1, Horizon.D7, Horizon.D30]) {
      for (const window of STATS_WINDOWS) {
        const windowDays = window === '90d' ? 90 : 365;
        const windowStart = subtractDays(now, windowDays);

        const outcomes = await prisma.signalOutcome.findMany({
          where: {
            horizon,
            event: {
              signalId,
              asset,
              ts: { gte: windowStart },
            },
          },
          include: { event: true },
        });

        const nEvents = outcomes.length;
        const successfulEvents = outcomes.filter((o) => o.success === true).length;
        const hitRate = nEvents > 0 ? successfulEvents / nEvents : null;
        const avgReturn =
          nEvents > 0
            ? outcomes.reduce((sum, o) => sum + Number(o.forwardReturn), 0) / nEvents
            : null;

        await prisma.signalStats.upsert({
          where: {
            signalId_asset_horizon_window: { signalId, asset, horizon, window },
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
export async function getLatestPrice(asset: string): Promise<number | null> {
  const price = await prisma.price.findFirst({
    where: { asset },
    orderBy: { ts: 'desc' },
  });
  return price ? Number(price.close) : null;
}

