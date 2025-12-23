import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SignalId, Asset, SIGNAL_REGISTRY } from '@crypto-signals/shared';

export const dynamic = 'force-dynamic';

interface SnapshotSignal {
  signalId: string;
  name: string;
  category: string;
  asset: string;
  state: string;
  ts: string;
  rawJson: unknown;
}

interface SnapshotResponse {
  success: boolean;
  data: {
    btc: SnapshotSignal[];
    eth: SnapshotSignal[];
    global: SnapshotSignal[];
  };
  latestPrices: {
    btc: number | null;
    eth: number | null;
  };
  updatedAt: string;
}

export async function GET() {
  try {
    // Get latest state for each signal/asset combination
    const signalIds = Object.values(SignalId);
    const assets = [Asset.BTC, Asset.ETH, Asset.GLOBAL];

    const latestStates: SnapshotSignal[] = [];

    for (const signalId of signalIds) {
      for (const asset of assets) {
        const state = await prisma.signalState.findFirst({
          where: { signalId, asset },
          orderBy: { ts: 'desc' },
        });

        if (state) {
          const config = SIGNAL_REGISTRY[signalId as SignalId];
          latestStates.push({
            signalId: state.signalId,
            name: config?.name || state.signalId,
            category: config?.category || 'unknown',
            asset: state.asset,
            state: state.state,
            ts: state.ts.toISOString(),
            rawJson: state.rawJson,
          });
        }
      }
    }

    // Get latest prices
    const btcPrice = await prisma.price.findFirst({
      where: { asset: Asset.BTC },
      orderBy: { ts: 'desc' },
    });

    const ethPrice = await prisma.price.findFirst({
      where: { asset: Asset.ETH },
      orderBy: { ts: 'desc' },
    });

    // Group by asset
    const response: SnapshotResponse = {
      success: true,
      data: {
        btc: latestStates.filter((s) => s.asset === Asset.BTC),
        eth: latestStates.filter((s) => s.asset === Asset.ETH),
        global: latestStates.filter((s) => s.asset === Asset.GLOBAL),
      },
      latestPrices: {
        btc: btcPrice ? Number(btcPrice.close) : null,
        eth: ethPrice ? Number(ethPrice.close) : null,
      },
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Snapshot API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

