import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SIGNAL_REGISTRY, SignalId } from '@crypto-signals/shared';

export const dynamic = 'force-dynamic';

interface StatsResponse {
  signalId: string;
  signalName: string;
  category: string;
  asset: string;
  horizon: string;
  window: string;
  nEvents: number;
  hitRate: number | null;
  avgReturn: number | null;
  isReliable: boolean; // true if nEvents >= 30
  updatedAt: string;
}

export async function GET() {
  try {
    const stats = await prisma.signalStats.findMany({
      orderBy: [
        { signalId: 'asc' },
        { asset: 'asc' },
        { horizon: 'asc' },
        { window: 'asc' },
      ],
    });

    const response: StatsResponse[] = stats.map((stat) => {
      const config = SIGNAL_REGISTRY[stat.signalId as SignalId];
      return {
        signalId: stat.signalId,
        signalName: config?.name || stat.signalId,
        category: config?.category || 'unknown',
        asset: stat.asset,
        horizon: stat.horizon,
        window: stat.window,
        nEvents: stat.nEvents,
        hitRate: stat.hitRate !== null ? Number(stat.hitRate) : null,
        avgReturn: stat.avgReturn !== null ? Number(stat.avgReturn) : null,
        isReliable: stat.nEvents >= 30,
        updatedAt: stat.updatedAt.toISOString(),
      };
    });

    // Group stats by signal for easier consumption
    interface GroupedStat {
      signalId: string;
      signalName: string;
      category: string;
      asset: string;
      stats: Array<{
        horizon: string;
        window: string;
        nEvents: number;
        hitRate: number | null;
        avgReturn: number | null;
        isReliable: boolean;
      }>;
    }
    
    const grouped = response.reduce((acc, stat) => {
      const key = `${stat.signalId}_${stat.asset}`;
      if (!acc[key]) {
        acc[key] = {
          signalId: stat.signalId,
          signalName: stat.signalName,
          category: stat.category,
          asset: stat.asset,
          stats: [],
        };
      }
      acc[key].stats.push({
        horizon: stat.horizon,
        window: stat.window,
        nEvents: stat.nEvents,
        hitRate: stat.hitRate,
        avgReturn: stat.avgReturn,
        isReliable: stat.isReliable,
      });
      return acc;
    }, {} as Record<string, GroupedStat>);

    return NextResponse.json({
      success: true,
      data: response,
      grouped: Object.values(grouped),
      count: response.length,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

