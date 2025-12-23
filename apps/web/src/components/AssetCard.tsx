import SignalDetail from './SignalDetail';

interface Signal {
  signalId: string;
  name: string;
  category: string;
  asset: string;
  state: string;
  ts: string;
  rawJson?: Record<string, unknown>;
}

interface AssetCardProps {
  asset: 'BTC' | 'ETH' | 'SOL' | 'XRP' | 'GLOBAL';
  price?: number | null;
  signals: Signal[];
  animationDelay?: number;
}

const assetConfig = {
  BTC: {
    name: 'Bitcoin',
    symbol: '₿',
    gradient: 'from-orange-500 to-amber-600',
    iconBg: 'bg-orange-500/20',
    iconColor: 'text-orange-400',
  },
  ETH: {
    name: 'Ethereum',
    symbol: 'Ξ',
    gradient: 'from-indigo-500 to-purple-600',
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
  },
  SOL: {
    name: 'Solana',
    symbol: '◎',
    gradient: 'from-purple-500 to-pink-600',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
  },
  XRP: {
    name: 'XRP',
    symbol: '✕',
    gradient: 'from-blue-500 to-cyan-600',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  GLOBAL: {
    name: 'Macro',
    symbol: '◉',
    gradient: 'from-cyan-500 to-teal-600',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
};

const categoryOrder = ['funding', 'open_interest', 'technical', 'macro'];

export default function AssetCard({
  asset,
  price,
  signals,
  animationDelay = 0,
}: AssetCardProps) {
  const config = assetConfig[asset];

  // Group signals by category
  const groupedSignals = signals.reduce((acc, signal) => {
    const cat = signal.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(signal);
    return acc;
  }, {} as Record<string, Signal[]>);

  // Sort categories
  const sortedCategories = Object.keys(groupedSignals).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <div
      className="card card-glow p-6 opacity-0 animate-fade-in"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center`}
          >
            <span className={`text-2xl font-bold ${config.iconColor}`}>
              {config.symbol}
            </span>
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-white">
              {config.name}
            </h2>
            <p className="text-sm text-dark-muted">{asset}</p>
          </div>
        </div>

        {price && (
          <div className="text-right">
            <p className="text-2xl font-bold text-white">
              ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-dark-muted">Latest Price</p>
          </div>
        )}
      </div>

      {/* Signals by category */}
      <div className="space-y-4">
        {sortedCategories.map((category) => (
          <div key={category}>
            <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wider mb-2">
              {category.replace('_', ' ')}
            </h3>
            <div className="space-y-2">
              {groupedSignals[category].map((signal) => (
                <SignalDetail
                  key={signal.signalId}
                  signalId={signal.signalId}
                  name={signal.name}
                  state={signal.state}
                  rawJson={(signal.rawJson as Record<string, unknown>) || {}}
                />
              ))}
            </div>
          </div>
        ))}

        {signals.length === 0 && (
          <div className="text-center py-8 text-dark-muted">
            No signals available
          </div>
        )}
      </div>
    </div>
  );
}

