import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SIGNAL_REGISTRY, SignalId, subtractDays } from '@crypto-signals/shared';

export const dynamic = 'force-dynamic';

interface EventResponse {
  id: number;
  signalId: string;
  signalName: string;
  category: string;
  asset: string;
  ts: string;
  prevState: string;
  newState: string;
  entryPrice: number;
  outcomes: Array<{
    horizon: string;
    exitTs: string;
    exitPrice: number;
    forwardReturn: number;
    success: boolean | null;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    const startDate = subtractDays(new Date(), days);

    const events = await prisma.signalEvent.findMany({
      where: {
        ts: { gte: startDate },
      },
      include: {
        outcomes: true,
      },
      orderBy: { ts: 'desc' },
      take: 100,
    });

    const response: EventResponse[] = events.map((event) => {
      const config = SIGNAL_REGISTRY[event.signalId as SignalId];
      return {
        id: event.id,
        signalId: event.signalId,
        signalName: config?.name || event.signalId,
        category: config?.category || 'unknown',
        asset: event.asset,
        ts: event.ts.toISOString(),
        prevState: event.prevState,
        newState: event.newState,
        entryPrice: Number(event.entryPrice),
        outcomes: event.outcomes.map((o) => ({
          horizon: o.horizon,
          exitTs: o.exitTs.toISOString(),
          exitPrice: Number(o.exitPrice),
          forwardReturn: Number(o.forwardReturn),
          success: o.success,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: response,
      count: response.length,
      days,
    });
  } catch (error) {
    console.error('Events API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

