import Navigation from '@/components/Navigation';
import SignalBadge from '@/components/SignalBadge';
import prisma from '@/lib/db';
import { SIGNAL_REGISTRY, SignalId, subtractDays } from '@crypto-signals/shared';

interface Outcome {
  horizon: string;
  exitTs: string;
  exitPrice: number;
  forwardReturn: number;
  success: boolean | null;
}

interface EventData {
  id: number;
  signalId: string;
  signalName: string;
  category: string;
  asset: string;
  ts: string;
  prevState: string;
  newState: string;
  entryPrice: number;
  outcomes: Outcome[];
}

interface EventsResponse {
  data: EventData[];
  count: number;
  days: number;
}

async function getEvents(days: number = 30): Promise<EventsResponse | null> {
  try {
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

    const data: EventData[] = events.map((event) => {
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

    return { data, count: data.length, days };
  } catch (error) {
    console.error('getEvents error:', error);
    return null;
  }
}

function formatReturn(value: number): string {
  const percent = value * 100;
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

function OutcomeCell({ outcome }: { outcome: Outcome | undefined }) {
  if (!outcome) {
    return <span className="text-dark-muted">—</span>;
  }

  const returnClass =
    outcome.forwardReturn >= 0 ? 'text-emerald-400' : 'text-red-400';
  const successIcon =
    outcome.success === true ? '✓' : outcome.success === false ? '✗' : '○';
  const successClass =
    outcome.success === true
      ? 'text-emerald-400'
      : outcome.success === false
      ? 'text-red-400'
      : 'text-dark-muted';

  return (
    <div className="flex items-center gap-2">
      <span className={returnClass}>{formatReturn(outcome.forwardReturn)}</span>
      <span className={successClass}>{successIcon}</span>
    </div>
  );
}

export default async function EventsPage() {
  const data = await getEvents(30);

  return (
    <>
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8 opacity-0 animate-fade-in">
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            Signal Events
          </h1>
          <p className="text-dark-muted">
            State transitions from the last {data?.days || 30} days
          </p>
        </div>

        {/* No data state */}
        {(!data || data.data.length === 0) && (
          <div className="card card-glow p-12 text-center opacity-0 animate-fade-in animate-delay-100">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-xl font-bold text-white mb-2">
              No Events Recorded
            </h2>
            <p className="text-dark-muted max-w-md mx-auto">
              Signal events are logged when a signal transitions from one state
              to another. Run jobs to start generating events.
            </p>
          </div>
        )}

        {/* Events table */}
        {data && data.data.length > 0 && (
          <div className="card card-glow overflow-hidden opacity-0 animate-fade-in animate-delay-100">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-dark-bg/50">
                    <th>Time</th>
                    <th>Signal</th>
                    <th>Asset</th>
                    <th>Transition</th>
                    <th>Entry Price</th>
                    <th>1D</th>
                    <th>7D</th>
                    <th>30D</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((event) => {
                    const outcome1D = event.outcomes.find(
                      (o) => o.horizon === '1D'
                    );
                    const outcome7D = event.outcomes.find(
                      (o) => o.horizon === '7D'
                    );
                    const outcome30D = event.outcomes.find(
                      (o) => o.horizon === '30D'
                    );

                    return (
                      <tr key={event.id}>
                        <td className="whitespace-nowrap">
                          <div className="text-white">
                            {new Date(event.ts).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-dark-muted">
                            {new Date(event.ts).toLocaleTimeString()}
                          </div>
                        </td>
                        <td>
                          <div className="text-white font-medium">
                            {event.signalName}
                          </div>
                          <div className="text-xs text-dark-muted">
                            {event.category}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`font-medium ${
                              event.asset === 'BTC'
                                ? 'text-orange-400'
                                : event.asset === 'ETH'
                                ? 'text-indigo-400'
                                : 'text-cyan-400'
                            }`}
                          >
                            {event.asset}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <SignalBadge state={event.prevState} size="sm" />
                            <span className="text-dark-muted">→</span>
                            <SignalBadge state={event.newState} size="sm" />
                          </div>
                        </td>
                        <td className="text-white font-mono">
                          $
                          {event.entryPrice.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td>
                          <OutcomeCell outcome={outcome1D} />
                        </td>
                        <td>
                          <OutcomeCell outcome={outcome7D} />
                        </td>
                        <td>
                          <OutcomeCell outcome={outcome30D} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-dark-border bg-dark-bg/30">
              <p className="text-sm text-dark-muted">
                Showing {data.count} events
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 card p-4 opacity-0 animate-fade-in animate-delay-300">
          <h3 className="text-sm font-medium text-dark-muted mb-3">Legend</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-dark-muted">
                Success (met threshold)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400">✗</span>
              <span className="text-dark-muted">Failed (missed threshold)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-dark-muted">○</span>
              <span className="text-dark-muted">
                Not evaluated (NEUTRAL)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-dark-muted">—</span>
              <span className="text-dark-muted">Pending evaluation</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

