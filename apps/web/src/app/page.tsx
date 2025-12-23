import Navigation from '@/components/Navigation';
import AssetCard from '@/components/AssetCard';
import MacroCard from '@/components/MacroCard';
import HorizonSelector from '@/components/HorizonSelector';
import prisma from '@/lib/db';
import { SignalId, Asset, SIGNAL_REGISTRY, HorizonBucket } from '@crypto-signals/shared';

interface SnapshotSignal {
  signalId: string;
  name: string;
  category: string;
  subcategory?: string;
  asset: string;
  state: string;
  ts: string;
  rawJson: unknown;
  horizonBuckets: string[];
}

interface SnapshotData {
  data: {
    btc: SnapshotSignal[];
    eth: SnapshotSignal[];
    sol: SnapshotSignal[];
    xrp: SnapshotSignal[];
    global: SnapshotSignal[];
  };
  latestPrices: {
    btc: number | null;
    eth: number | null;
    sol: number | null;
    xrp: number | null;
  };
  updatedAt: string;
}

async function getSnapshot(): Promise<SnapshotData | null> {
  try {
    const signalIds = Object.values(SignalId);
    const assets = [Asset.BTC, Asset.ETH, Asset.SOL, Asset.XRP, Asset.GLOBAL];
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
            subcategory: config?.subcategory,
            asset: state.asset,
            state: state.state,
            ts: state.ts.toISOString(),
            rawJson: state.rawJson,
            horizonBuckets: config?.horizonBuckets || [],
          });
        }
      }
    }

    const [btcPrice, ethPrice, solPrice, xrpPrice] = await Promise.all([
      prisma.price.findFirst({
        where: { asset: Asset.BTC },
        orderBy: { ts: 'desc' },
      }),
      prisma.price.findFirst({
        where: { asset: Asset.ETH },
        orderBy: { ts: 'desc' },
      }),
      prisma.price.findFirst({
        where: { asset: Asset.SOL },
        orderBy: { ts: 'desc' },
      }),
      prisma.price.findFirst({
        where: { asset: Asset.XRP },
        orderBy: { ts: 'desc' },
      }),
    ]);

    return {
      data: {
        btc: latestStates.filter((s) => s.asset === Asset.BTC),
        eth: latestStates.filter((s) => s.asset === Asset.ETH),
        sol: latestStates.filter((s) => s.asset === Asset.SOL),
        xrp: latestStates.filter((s) => s.asset === Asset.XRP),
        global: latestStates.filter((s) => s.asset === Asset.GLOBAL),
      },
      latestPrices: {
        btc: btcPrice ? Number(btcPrice.close) : null,
        eth: ethPrice ? Number(ethPrice.close) : null,
        sol: solPrice ? Number(solPrice.close) : null,
        xrp: xrpPrice ? Number(xrpPrice.close) : null,
      },
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('getSnapshot error:', error);
    return null;
  }
}

interface PageProps {
  searchParams: Promise<{ horizon?: string }>;
}

export default async function SnapshotPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedHorizon = (params.horizon as 'short' | 'mid' | 'long') || 'short';
  const data = await getSnapshot();

  // Filter signals by selected horizon bucket
  const filterByHorizon = (signals: SnapshotSignal[]) => {
    return signals.filter((s) => 
      s.horizonBuckets.length === 0 || s.horizonBuckets.includes(selectedHorizon)
    );
  };

  return (
    <>
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6 opacity-0 animate-fade-in">
          <h1 className="font-display text-3xl font-bold text-white mb-2">
            Signal Snapshot
          </h1>
          <p className="text-dark-muted">
            Current state of all signals across assets
          </p>
          {data?.updatedAt && (
            <p className="text-xs text-dark-muted mt-1">
              Last updated: {new Date(data.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {/* Horizon selector */}
        <HorizonSelector selected={selectedHorizon} />

        {/* No data state */}
        {!data && (
          <div className="card card-glow p-12 text-center">
            <div className="text-6xl mb-4">📡</div>
            <h2 className="text-xl font-bold text-white mb-2">
              No Signal Data Available
            </h2>
            <p className="text-dark-muted max-w-md mx-auto">
              Run the job scheduler to start collecting signal data. Jobs can be
              triggered via API or local cron.
            </p>
          </div>
        )}

        {/* Asset cards grid */}
        {data && (
          <>
            {/* Top row: BTC, ETH, SOL, XRP */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
              <AssetCard
                asset="BTC"
                price={data.latestPrices.btc}
                signals={filterByHorizon(data.data.btc)}
                animationDelay={100}
              />
              <AssetCard
                asset="ETH"
                price={data.latestPrices.eth}
                signals={filterByHorizon(data.data.eth)}
                animationDelay={150}
              />
              <AssetCard
                asset="SOL"
                price={data.latestPrices.sol}
                signals={filterByHorizon(data.data.sol)}
                animationDelay={200}
              />
              <AssetCard
                asset="XRP"
                price={data.latestPrices.xrp}
                signals={filterByHorizon(data.data.xrp)}
                animationDelay={250}
              />
            </div>
            {/* Bottom row: Macro */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MacroCard
                signals={filterByHorizon(data.data.global)}
                animationDelay={300}
              />
            </div>
          </>
        )}

        {/* Signal legend */}
        <div className="mt-12 opacity-0 animate-fade-in animate-delay-500">
          <h3 className="text-sm font-medium text-dark-muted mb-4">
            Signal States
          </h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL'].map(
              (state) => (
                <div
                  key={state}
                  className={`signal-badge signal-${state
                    .toLowerCase()
                    .replace('_', '-')}`}
                >
                  {state.replace('_', ' ')}
                </div>
              )
            )}
          </div>
          <h3 className="text-sm font-medium text-dark-muted mb-4">
            Context-Only States
          </h3>
          <div className="flex flex-wrap gap-3">
            {['HEDGE_ON', 'RISK_ON', 'RISK_OFF'].map((state) => (
              <div
                key={state}
                className={`signal-badge signal-${state
                  .toLowerCase()
                  .replace('_', '-')}`}
              >
                {state.replace('_', '-')}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

