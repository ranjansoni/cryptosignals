interface SignalBadgeProps {
  state: string;
  size?: 'sm' | 'md' | 'lg';
}

const stateConfig: Record<string, { class: string; label: string }> = {
  // Actionable states
  STRONG_BUY: { class: 'signal-strong-buy', label: 'Strong Buy' },
  BUY: { class: 'signal-buy', label: 'Buy' },
  NEUTRAL: { class: 'signal-neutral', label: 'Neutral' },
  SELL: { class: 'signal-sell', label: 'Sell' },
  STRONG_SELL: { class: 'signal-strong-sell', label: 'Strong Sell' },
  // Context-only states
  HEDGE_ON: { class: 'signal-hedge-on', label: 'Hedge-On' },
  RISK_ON: { class: 'signal-risk-on', label: 'Risk-On' },
  RISK_OFF: { class: 'signal-risk-off', label: 'Risk-Off' },
};

const sizeClasses = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-3 py-1',
  lg: 'text-sm px-4 py-1.5',
};

export default function SignalBadge({ state, size = 'md' }: SignalBadgeProps) {
  const config = stateConfig[state] || stateConfig.NEUTRAL;

  return (
    <span className={`signal-badge ${config.class} ${sizeClasses[size]}`}>
      {config.label}
    </span>
  );
}

