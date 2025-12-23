import Navigation from '@/components/Navigation';
import prisma from '@/lib/db';
import { SIGNAL_REGISTRY, SignalId } from '@crypto-signals/shared';

interface StatData {
  horizon: string;
  window: string;
  nEvents: number;
  hitRate: number | null;
  avgReturn: number | null;
  isReliable: boolean;
}

interface GroupedStats {
  signalId: string;
  signalName: string;
  category: string;
  asset: string;
  stats: StatData[];
}

interface StatsResponse {
  grouped: GroupedStats[];
}

async function getStats(): Promise<StatsResponse | null> {
  try {
    const stats = await prisma.signalStats.findMany({
      orderBy: [
        { signalId: 'asc' },
        { asset: 'asc' },
        { horizon: 'asc' },
        { window: 'asc' },
      ],
    });

    const mapped = stats.map((stat) => {
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
      };
    });

    const grouped = mapped.reduce((acc, stat) => {
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
    }, {} as Record<string, GroupedStats>);

    return { grouped: Object.values(grouped) };
  } catch (error) {
    console.error('getStats error:', error);
    return null;
  }
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatReturn(value: number | null): string {
  if (value === null) return '—';
  const percent = value * 100;
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}

function StatCell({
  hitRate,
  avgReturn,
  nEvents,
  isReliable,
}: {
  hitRate: number | null;
  avgReturn: number | null;
  nEvents: number;
  isReliable: boolean;
}) {
  if (nEvents === 0) {
    return (
      <div className="text-center text-dark-muted">
        <div className="text-lg">—</div>
        <div className="text-xs">No data</div>
      </div>
    );
  }

  const hitRateClass =
    hitRate !== null && hitRate >= 0.5
      ? 'text-emerald-400'
      : hitRate !== null && hitRate < 0.5
      ? 'text-red-400'
      : 'text-white';

  const returnClass =
    avgReturn !== null && avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${hitRateClass}`}>
        {formatPercent(hitRate)}
      </div>
      <div className={`text-sm ${returnClass}`}>{formatReturn(avgReturn)}</div>
      <div className="text-xs text-dark-muted">
        n={nEvents}
        {!isReliable && (
          <span className="ml-1 text-amber-400" title="Less than 30 events">
            ⚠
          </span>
        )}
      </div>
    </div>
  );
}

export default async function StatsPage() {
  const data = await getStats();

  // Group by category for display
  const byCategory =
    data?.grouped.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, GroupedStats[]>) || {};

  const categoryOrder = ['funding', 'open_interest', 'technical', 'macro'];
  const sortedCategories = Object.keys(byCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <>
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8 opacity-0 animate-fade-in">
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            Signal Statistics
          </h1>
          <p className="text-dark-muted">
            Hit rates and average returns by signal, asset, and horizon
          </p>
        </div>

        {/* No data state */}
        {(!data || data.grouped.length === 0) && (
          <div className="card card-glow p-12 text-center opacity-0 animate-fade-in animate-delay-100">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-white mb-2">
              No Statistics Available
            </h2>
            <p className="text-dark-muted max-w-md mx-auto">
              Statistics are computed after signal events mature and outcomes
              are evaluated. Run jobs regularly to build up signal history.
            </p>
          </div>
        )}

        {/* Stats by category */}
        {data && data.grouped.length > 0 && (
          <div className="space-y-8">
            {sortedCategories.map((category, catIdx) => (
              <div
                key={category}
                className="opacity-0 animate-fade-in"
                style={{ animationDelay: `${(catIdx + 1) * 100}ms` }}
              >
                <h2 className="text-lg font-display font-bold text-white mb-4 uppercase tracking-wider">
                  {category.replace('_', ' ')} Signals
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {byCategory[category].map((item) => (
                    <div key={`${item.signalId}_${item.asset}`} className="card card-glow p-5">
                      {/* Signal header */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-white">
                            {item.signalName}
                          </h3>
                          <p className="text-xs text-dark-muted">
                            {item.signalId}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            item.asset === 'BTC'
                              ? 'bg-orange-500/20 text-orange-400'
                              : item.asset === 'ETH'
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : 'bg-cyan-500/20 text-cyan-400'
                          }`}
                        >
                          {item.asset}
                        </span>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="text-center text-xs text-dark-muted uppercase tracking-wider">
                          1 Day
                        </div>
                        <div className="text-center text-xs text-dark-muted uppercase tracking-wider">
                          7 Days
                        </div>
                        <div className="text-center text-xs text-dark-muted uppercase tracking-wider">
                          30 Days
                        </div>
                      </div>

                      {/* 90-day window */}
                      <div className="mb-4">
                        <div className="text-xs text-dark-muted mb-2">
                          90-Day Window
                        </div>
                        <div className="grid grid-cols-3 gap-4 bg-dark-bg/50 rounded-lg p-3">
                          {['1D', '7D', '30D'].map((horizon) => {
                            const stat = item.stats.find(
                              (s) => s.horizon === horizon && s.window === '90d'
                            );
                            return (
                              <StatCell
                                key={horizon}
                                hitRate={stat?.hitRate ?? null}
                                avgReturn={stat?.avgReturn ?? null}
                                nEvents={stat?.nEvents ?? 0}
                                isReliable={stat?.isReliable ?? false}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* 365-day window */}
                      <div>
                        <div className="text-xs text-dark-muted mb-2">
                          365-Day Window
                        </div>
                        <div className="grid grid-cols-3 gap-4 bg-dark-bg/50 rounded-lg p-3">
                          {['1D', '7D', '30D'].map((horizon) => {
                            const stat = item.stats.find(
                              (s) =>
                                s.horizon === horizon && s.window === '365d'
                            );
                            return (
                              <StatCell
                                key={horizon}
                                hitRate={stat?.hitRate ?? null}
                                avgReturn={stat?.avgReturn ?? null}
                                nEvents={stat?.nEvents ?? 0}
                                isReliable={stat?.isReliable ?? false}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 card p-4 opacity-0 animate-fade-in animate-delay-500">
          <h3 className="text-sm font-medium text-dark-muted mb-3">
            How to Read
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-dark-muted">
            <div>
              <span className="text-white font-medium">Hit Rate:</span> Percentage
              of signals that met the success threshold
            </div>
            <div>
              <span className="text-white font-medium">Avg Return:</span> Mean
              forward return for all events in the window
            </div>
            <div>
              <span className="text-amber-400 font-medium">⚠ Warning:</span> Less
              than 30 events - low statistical confidence
            </div>
          </div>
          <div className="mt-3 text-xs text-dark-muted">
            Success thresholds: 1D = ±1%, 7D = ±3%, 30D = ±7%
          </div>
        </div>
      </main>
    </>
  );
}

