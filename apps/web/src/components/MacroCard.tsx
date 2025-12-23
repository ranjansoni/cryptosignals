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

interface MacroCardProps {
  signals: Signal[];
  animationDelay?: number;
}

// Define which signals belong to which row
const liquiditySignals = ['stablecoin_supply', 'fed_balance_sheet', 'liquidity_plumbing'];
const riskSignals = ['dxy_trend', 'gold_trend', 'nasdaq_trend'];

// Signal display names for better formatting
const signalDisplayNames: Record<string, string> = {
  stablecoin_supply: 'Stablecoin Supply',
  fed_balance_sheet: 'Fed Balance Sheet',
  liquidity_plumbing: 'Liquidity Plumbing',
  dxy_trend: 'DXY Trend',
  gold_trend: 'Gold Trend',
  nasdaq_trend: 'Nasdaq Trend',
};

// Context-only signals (should show "Context" tag)
const contextOnlySignals = ['liquidity_plumbing', 'gold_trend', 'nasdaq_trend'];

export default function MacroCard({
  signals,
  animationDelay = 0,
}: MacroCardProps) {
  // Filter signals into liquidity and risk categories
  const liquidityList = signals.filter((s) =>
    liquiditySignals.includes(s.signalId)
  );
  const riskList = signals.filter((s) => riskSignals.includes(s.signalId));

  // Sort by signal order
  const sortByOrder = (list: Signal[], orderList: string[]) =>
    list.sort(
      (a, b) => orderList.indexOf(a.signalId) - orderList.indexOf(b.signalId)
    );

  sortByOrder(liquidityList, liquiditySignals);
  sortByOrder(riskList, riskSignals);

  const hasSignals = liquidityList.length > 0 || riskList.length > 0;

  return (
    <div
      className="card card-glow p-6 opacity-0 animate-fade-in"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-cyan-400">◉</span>
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-white">
              Liquidity & Risk Regime
            </h2>
            <p className="text-sm text-dark-muted">GLOBAL CONTEXT</p>
          </div>
        </div>
        {/* Context badge */}
        <div className="px-2 py-1 rounded text-[10px] uppercase tracking-wider bg-dark-border/50 text-dark-muted border border-dark-border">
          Context
        </div>
      </div>

      {!hasSignals && (
        <div className="text-center py-8 text-dark-muted">
          No signals available
        </div>
      )}

      {hasSignals && (
        <div className="space-y-6">
          {/* Row 1: Liquidity Conditions */}
          {liquidityList.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-cyan-400 text-lg">💧</span>
                <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  Liquidity Conditions
                </h3>
              </div>
              <div className="grid gap-2">
                {liquidityList.map((signal) => (
                  <SignalDetail
                    key={signal.signalId}
                    signalId={signal.signalId}
                    name={signalDisplayNames[signal.signalId] || signal.name}
                    state={signal.state}
                    rawJson={(signal.rawJson as Record<string, unknown>) || {}}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Row 2: Risk Sentiment & Capital Preference */}
          {riskList.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-400 text-lg">📊</span>
                <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                  Risk Sentiment
                </h3>
              </div>
              <div className="grid gap-2">
                {riskList.map((signal) => (
                  <SignalDetail
                    key={signal.signalId}
                    signalId={signal.signalId}
                    name={signalDisplayNames[signal.signalId] || signal.name}
                    state={signal.state}
                    rawJson={(signal.rawJson as Record<string, unknown>) || {}}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend for context-only states */}
      <div className="mt-6 pt-4 border-t border-dark-border/50">
        <p className="text-[10px] text-dark-muted">
          <span className="text-cyan-400">●</span> Liquidity signals show system
          liquidity conditions.{' '}
          <span className="text-purple-400">●</span> Risk signals show market
          sentiment regime. <span className="font-medium">ctx</span> = context-only
          (not actionable).
        </p>
      </div>
    </div>
  );
}

