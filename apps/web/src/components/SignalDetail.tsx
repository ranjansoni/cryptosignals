'use client';

import { useState } from 'react';
import SignalBadge from './SignalBadge';

interface SignalDetailProps {
  signalId: string;
  name: string;
  state: string;
  rawJson: Record<string, unknown>;
  source?: string;
}

// Data source configuration
const signalSources: Record<string, { name: string; icon: string; color: string; url: string }> = {
  funding_rate: { name: 'CoinGlass', icon: '📊', color: 'text-blue-400', url: 'https://www.coinglass.com/FundingRate' },
  open_interest: { name: 'CoinGlass', icon: '📊', color: 'text-blue-400', url: 'https://www.coinglass.com/OpenInterest' },
  rsi_14: { name: 'CoinGecko', icon: '🦎', color: 'text-green-400', url: 'https://www.coingecko.com' },
  ma_200_regime: { name: 'CoinGecko', icon: '🦎', color: 'text-green-400', url: 'https://www.coingecko.com' },
  stablecoin_supply: { name: 'DeFiLlama', icon: '🦙', color: 'text-purple-400', url: 'https://defillama.com/stablecoins' },
  fed_balance_sheet: { name: 'FRED', icon: '🏛️', color: 'text-amber-400', url: 'https://fred.stlouisfed.org' },
  dxy_trend: { name: 'FRED', icon: '🏛️', color: 'text-amber-400', url: 'https://fred.stlouisfed.org' },
  liquidity_plumbing: { name: 'FRED', icon: '🏛️', color: 'text-amber-400', url: 'https://fred.stlouisfed.org' },
  gold_trend: { name: 'Stooq', icon: '📈', color: 'text-yellow-400', url: 'https://stooq.com' },
  nasdaq_trend: { name: 'Stooq', icon: '📈', color: 'text-cyan-400', url: 'https://stooq.com' },
};

// Format large numbers
function formatNumber(num: number | undefined | null, decimals = 2): string {
  if (num === undefined || num === null) return 'N/A';
  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(decimals)}T`;
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(decimals)}B`;
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(decimals)}M`;
  if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(decimals)}K`;
  return `$${num.toFixed(decimals)}`;
}

function formatPercent(num: number | undefined | null, decimals = 2): string {
  if (num === undefined || num === null) return 'N/A';
  const prefix = num > 0 ? '+' : '';
  return `${prefix}${num.toFixed(decimals)}%`;
}

// Generate justification from rawJson
function generateJustification(signalId: string, state: string, rawJson: Record<string, unknown>) {
  const justification: {
    claim: string;
    drivers: Array<{ name: string; value: string; threshold: string; met: boolean }>;
    assumptions: string[];
    invalidation: string[];
  } = {
    claim: '',
    drivers: [],
    assumptions: [],
    invalidation: [],
  };

  switch (signalId) {
    case 'funding_rate': {
      const rate = rawJson.fundingRate as number || 0;
      const annualized = rawJson.annualizedRate as number || rate * 3 * 365 * 100;
      justification.claim = state === 'NEUTRAL' 
        ? 'Funding rates are balanced - no clear leverage signal'
        : state.includes('BUY') 
          ? 'Negative funding suggests shorts are paying longs - potential squeeze setup'
          : 'High positive funding indicates crowded longs - risk of liquidation cascade';
      justification.drivers = [
        { name: 'Funding Rate', value: `${(rate * 100).toFixed(4)}%`, threshold: '±0.01%', met: Math.abs(rate) > 0.0001 },
        { name: 'Annualized', value: `${annualized.toFixed(1)}%`, threshold: '±15%', met: Math.abs(annualized) > 15 },
      ];
      justification.assumptions = [
        'High positive funding = crowded longs → liquidation risk',
        'High negative funding = crowded shorts → squeeze potential',
      ];
      justification.invalidation = ['Funding normalizes to ±0.01%', 'Open interest resets significantly'];
      break;
    }

    case 'open_interest': {
      const oiChange = rawJson.change24h as number || 0;
      const priceChange = rawJson.priceChange24h as number || 0;
      const divergence = oiChange - priceChange;
      justification.claim = state === 'NEUTRAL'
        ? 'No significant OI divergence from price'
        : Math.abs(divergence) > 8
          ? `OI diverging ${divergence > 0 ? 'up' : 'down'} vs price - potential reversal setup`
          : 'OI and price moving together';
      justification.drivers = [
        { name: 'OI 24h Change', value: `${oiChange.toFixed(2)}%`, threshold: '±10%', met: Math.abs(oiChange) > 10 },
        { name: 'Price 24h Change', value: `${priceChange.toFixed(2)}%`, threshold: 'vs OI', met: true },
        { name: 'Divergence', value: `${divergence.toFixed(2)}%`, threshold: '±8%', met: Math.abs(divergence) > 8 },
      ];
      justification.assumptions = [
        'Rising OI with flat price = positions building for a move',
        'OI divergence often precedes mean reversion',
      ];
      justification.invalidation = ['OI aligns with price direction', 'Divergence < 5%'];
      break;
    }

    case 'rsi_14': {
      const rsi = rawJson.rsi as number || 50;
      justification.claim = rsi >= 70
        ? 'Overbought - potential short-term pullback'
        : rsi <= 30
          ? 'Oversold - potential short-term bounce'
          : 'Neutral momentum - no extreme reading';
      justification.drivers = [
        { name: 'RSI(14)', value: rsi.toFixed(1), threshold: '>70 / <30', met: rsi > 70 || rsi < 30 },
      ];
      justification.assumptions = [
        'Extreme RSI levels tend to mean-revert short-term',
        'RSI works better in ranging vs trending markets',
      ];
      justification.invalidation = ['RSI returns to 40-60 zone', 'Strong momentum continues'];
      break;
    }

    case 'ma_200_regime': {
      const ma200 = rawJson.ma200 as number || 0;
      const currentPrice = rawJson.currentPrice as number || 0;
      const slope = rawJson.slope as number || 0;
      const deviation = rawJson.deviation as number || ((currentPrice - ma200) / ma200) * 100;
      const regime = rawJson.regime as string || '';
      justification.claim = regime.includes('strong_uptrend')
        ? 'Bull market regime confirmed - price above rising MA200'
        : regime.includes('strong_downtrend')
          ? 'Bear market regime - price below falling MA200'
          : 'Transitional regime - trend direction unclear';
      justification.drivers = [
        { name: 'Price vs MA200', value: currentPrice > ma200 ? 'Above' : 'Below', threshold: 'Position', met: true },
        { name: 'MA200 Slope', value: slope > 0 ? 'Rising' : 'Falling', threshold: 'Direction', met: true },
        { name: 'Deviation', value: `${deviation.toFixed(1)}%`, threshold: '±20%', met: Math.abs(deviation) > 20 },
      ];
      justification.assumptions = [
        'Price above rising MA200 = bull market',
        'Extreme deviations revert toward the mean',
      ];
      justification.invalidation = ['Price crosses MA200', 'Slope reverses'];
      break;
    }

    case 'stablecoin_supply': {
      const change30d = rawJson.change30dPct as number || rawJson.change30d as number || 0;
      const total = rawJson.totalSupply as number || rawJson.usdtSupply as number || 0;
      justification.claim = change30d > 2
        ? 'Stablecoin inflows - capital entering crypto ecosystem'
        : change30d < -2
          ? 'Stablecoin outflows - capital leaving crypto'
          : 'Stable supply - no clear flow signal';
      justification.drivers = [
        { name: '30D Supply Change', value: `${change30d.toFixed(2)}%`, threshold: '±2%', met: Math.abs(change30d) > 2 },
        { name: 'Total Supply', value: `$${(total / 1e9).toFixed(1)}B`, threshold: 'Context', met: true },
      ];
      justification.assumptions = [
        'Rising supply = capital inflow to crypto',
        'Supply changes reflect underlying demand',
      ];
      justification.invalidation = ['Supply change reverses', 'Macro conditions shift'];
      break;
    }

    case 'liquidity_plumbing': {
      const impulse = rawJson.impulse as number || 0;
      const percentile = rawJson.percentile as number || 50;
      const deltaTGA = (rawJson.tga as Record<string, unknown>)?.delta as number || 0;
      const deltaRRP = (rawJson.rrp as Record<string, unknown>)?.delta as number || 0;
      justification.claim = percentile >= 75
        ? 'Net liquidity injection - favorable for risk assets'
        : percentile <= 25
          ? 'Net liquidity drain - headwind for risk assets'
          : 'Neutral liquidity conditions';
      justification.drivers = [
        { name: 'Net Impulse', value: `$${(impulse / 1e9).toFixed(1)}B`, threshold: 'Top/Bot 25%', met: percentile >= 75 || percentile <= 25 },
        { name: 'TGA Delta (4w)', value: `$${(deltaTGA / 1e9).toFixed(1)}B`, threshold: '↑ drains', met: true },
        { name: 'RRP Delta (4w)', value: `$${(deltaRRP / 1e9).toFixed(1)}B`, threshold: '↑ drains', met: true },
        { name: 'Percentile', value: `${percentile}%`, threshold: '>75 / <25', met: percentile >= 75 || percentile <= 25 },
      ];
      justification.assumptions = [
        'TGA drawdowns inject liquidity',
        'RRP drawdowns free collateral',
      ];
      justification.invalidation = ['Impulse moves to 40-60 percentile', 'Fed policy changes'];
      break;
    }

    case 'gold_trend': {
      const ma200 = rawJson.ma200 as number || 0;
      const price = rawJson.currentPrice as number || 0;
      const slope = rawJson.slope as number || 0;
      justification.claim = state === 'HEDGE_ON'
        ? 'Gold in uptrend - hedge demand / inflation concerns'
        : 'Gold neutral - no strong hedge signal';
      justification.drivers = [
        { name: 'Price vs MA200', value: price > ma200 ? 'Above' : 'Below', threshold: 'Above', met: price > ma200 },
        { name: 'MA200 Slope', value: slope > 0 ? 'Rising' : 'Falling', threshold: 'Rising', met: slope > 0 },
      ];
      justification.assumptions = [
        'Gold uptrend = inflation/uncertainty hedge demand',
        'Risk-off environment indicator',
      ];
      justification.invalidation = ['Price breaks below MA200', 'Slope turns negative'];
      break;
    }

    case 'nasdaq_trend': {
      const ma200 = rawJson.ma200 as number || 0;
      const price = rawJson.currentPrice as number || 0;
      const slope = rawJson.slope as number || 0;
      justification.claim = state === 'RISK_ON'
        ? 'Risk-on environment - equities in uptrend'
        : state === 'RISK_OFF'
          ? 'Risk-off environment - equities in downtrend'
          : 'Transitional risk sentiment';
      justification.drivers = [
        { name: 'Price vs MA200', value: price > ma200 ? 'Above' : 'Below', threshold: 'Position', met: true },
        { name: 'MA200 Slope', value: slope > 0 ? 'Rising' : 'Falling', threshold: 'Direction', met: true },
      ];
      justification.assumptions = [
        'Nasdaq uptrend = risk-on, favorable for crypto',
        'Nasdaq downtrend = risk-off, headwind for crypto',
      ];
      justification.invalidation = ['Price crosses MA200', 'Slope reverses'];
      break;
    }

    case 'dxy_trend':
    case 'fed_balance_sheet': {
      const yoyChange = rawJson.yoyChange as number || rawJson.change as number || 0;
      justification.claim = signalId === 'dxy_trend'
        ? yoyChange > 0 ? 'Dollar strengthening - headwind for crypto' : 'Dollar weakening - tailwind for crypto'
        : yoyChange > 0 ? 'Fed balance sheet expanding - liquidity injection' : 'Fed balance sheet contracting - liquidity drain';
      justification.drivers = [
        { name: 'YoY Change', value: `${yoyChange.toFixed(2)}%`, threshold: 'Direction', met: true },
      ];
      justification.assumptions = signalId === 'dxy_trend'
        ? ['Strong dollar = tighter conditions', 'Weak dollar = easier conditions']
        : ['Expansion = liquidity injection', 'Contraction = liquidity drain'];
      justification.invalidation = ['Trend reverses'];
      break;
    }

    default:
      justification.claim = 'Signal computed from available data';
      justification.drivers = [];
      justification.assumptions = [];
      justification.invalidation = [];
  }

  return justification;
}

// Render CoinGecko-specific data section
function renderCoinGeckoData(rawJson: Record<string, unknown>, signalId: string) {
  if (signalId !== 'rsi_14' && signalId !== 'ma_200_regime') return null;
  
  return (
    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-green-400">🦎</span>
        <h4 className="text-[10px] uppercase tracking-wider text-green-400 font-medium">CoinGecko Data</h4>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {rawJson.currentPrice && (
          <div className="flex justify-between">
            <span className="text-dark-muted">Price</span>
            <span className="text-white font-mono">{formatNumber(rawJson.currentPrice as number)}</span>
          </div>
        )}
        {rawJson.high24h && (
          <div className="flex justify-between">
            <span className="text-dark-muted">24h High</span>
            <span className="text-green-400 font-mono">{formatNumber(rawJson.high24h as number)}</span>
          </div>
        )}
        {rawJson.low24h && (
          <div className="flex justify-between">
            <span className="text-dark-muted">24h Low</span>
            <span className="text-red-400 font-mono">{formatNumber(rawJson.low24h as number)}</span>
          </div>
        )}
        {rawJson.priceChangePct24h !== undefined && (
          <div className="flex justify-between">
            <span className="text-dark-muted">24h Change</span>
            <span className={`font-mono ${(rawJson.priceChangePct24h as number) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(rawJson.priceChangePct24h as number)}
            </span>
          </div>
        )}
        {rawJson.marketCapFormatted && (
          <div className="flex justify-between">
            <span className="text-dark-muted">Market Cap</span>
            <span className="text-white font-mono">{rawJson.marketCapFormatted as string}</span>
          </div>
        )}
        {rawJson.volumeFormatted && (
          <div className="flex justify-between">
            <span className="text-dark-muted">24h Volume</span>
            <span className="text-white font-mono">{rawJson.volumeFormatted as string}</span>
          </div>
        )}
        {rawJson.ma200 && (
          <div className="flex justify-between">
            <span className="text-dark-muted">MA200</span>
            <span className="text-cyan-400 font-mono">{formatNumber(rawJson.ma200 as number)}</span>
          </div>
        )}
        {rawJson.ma50 && (
          <div className="flex justify-between">
            <span className="text-dark-muted">MA50</span>
            <span className="text-cyan-400 font-mono">{formatNumber(rawJson.ma50 as number)}</span>
          </div>
        )}
        {rawJson.deviation !== undefined && (
          <div className="flex justify-between">
            <span className="text-dark-muted">MA200 Deviation</span>
            <span className={`font-mono ${(rawJson.deviation as number) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(rawJson.deviation as number)}
            </span>
          </div>
        )}
        {rawJson.athChangePct !== undefined && (
          <div className="flex justify-between">
            <span className="text-dark-muted">From ATH</span>
            <span className="text-red-400 font-mono">{formatPercent(rawJson.athChangePct as number)}</span>
          </div>
        )}
        {rawJson.goldenCross !== undefined && (
          <div className="flex justify-between col-span-2">
            <span className="text-dark-muted">Cross Signal</span>
            <span className={rawJson.goldenCross ? 'text-green-400' : rawJson.deathCross ? 'text-red-400' : 'text-dark-muted'}>
              {rawJson.goldenCross ? '🌟 Golden Cross' : rawJson.deathCross ? '💀 Death Cross' : 'None'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Render DeFiLlama-specific data section
function renderDeFiLlamaData(rawJson: Record<string, unknown>, signalId: string) {
  if (signalId !== 'stablecoin_supply') return null;
  
  const breakdown = rawJson.breakdown as Record<string, unknown> | null;
  
  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-purple-400">🦙</span>
        <h4 className="text-[10px] uppercase tracking-wider text-purple-400 font-medium">DeFiLlama Data</h4>
      </div>
      <div className="space-y-2 text-xs">
        {/* Total supply */}
        <div className="flex justify-between items-center pb-2 border-b border-dark-border/30">
          <span className="text-dark-muted">Total Stablecoin Supply</span>
          <div className="text-right">
            <span className="text-white font-mono block">{rawJson.totalSupplyFormatted as string || formatNumber(rawJson.totalSupply as number)}</span>
            {rawJson.change30dPct !== undefined && (
              <span className={`text-[10px] ${(rawJson.change30dPct as number) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercent(rawJson.change30dPct as number)} (30d)
              </span>
            )}
          </div>
        </div>
        
        {/* Breakdown by stablecoin */}
        {breakdown && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-dark-muted uppercase tracking-wider">Breakdown</div>
            {breakdown.usdt && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-dark-muted">USDT</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-mono">{(breakdown.usdt as Record<string, unknown>).supplyFormatted as string}</span>
                  <span className="text-dark-muted ml-2">({(breakdown.usdt as Record<string, unknown>).share as string}%)</span>
                </div>
              </div>
            )}
            {breakdown.usdc && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-dark-muted">USDC</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-mono">{(breakdown.usdc as Record<string, unknown>).supplyFormatted as string}</span>
                  <span className="text-dark-muted ml-2">({(breakdown.usdc as Record<string, unknown>).share as string}%)</span>
                </div>
              </div>
            )}
            {breakdown.dai && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span className="text-dark-muted">DAI</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-mono">{(breakdown.dai as Record<string, unknown>).supplyFormatted as string}</span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Flow direction */}
        {rawJson.flowDirection && (
          <div className="flex justify-between items-center pt-2 border-t border-dark-border/30">
            <span className="text-dark-muted">Capital Flow</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              (rawJson.flowDirection as string).includes('inflow') 
                ? 'bg-green-500/20 text-green-400' 
                : (rawJson.flowDirection as string).includes('outflow')
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-dark-border/50 text-dark-muted'
            }`}>
              {(rawJson.flowDirection as string).replace('_', ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignalDetail({ signalId, name, state, rawJson }: SignalDetailProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const source = signalSources[signalId] || { name: 'Unknown', icon: '📊', color: 'text-gray-400', url: '#' };
  const justification = generateJustification(signalId, state, rawJson || {});

  return (
    <div className="rounded-lg bg-dark-bg/50 border border-dark-border/50 overflow-hidden">
      {/* Collapsed view - clickable header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-dark-border/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">{name}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${source.color} bg-current/10`}>
            {source.icon} {source.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SignalBadge state={state} size="sm" />
          <span className={`text-dark-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded view - reasoning details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-dark-border/30 space-y-3">
          {/* Claim */}
          <div className="bg-dark-card/50 rounded-lg p-3">
            <p className="text-sm text-white font-medium">{justification.claim}</p>
          </div>

          {/* Source-specific data sections */}
          {renderCoinGeckoData(rawJson, signalId)}
          {renderDeFiLlamaData(rawJson, signalId)}

          {/* Drivers/Evidence */}
          {justification.drivers.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-dark-muted mb-2">Signal Evidence</h4>
              <div className="space-y-1.5">
                {justification.drivers.map((driver, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-dark-muted">{driver.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white">{driver.value}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        driver.met ? 'bg-green-500/20 text-green-400' : 'bg-dark-border/50 text-dark-muted'
                      }`}>
                        {driver.threshold}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assumptions */}
          {justification.assumptions.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-dark-muted mb-2">Assumptions</h4>
              <ul className="space-y-1">
                {justification.assumptions.map((assumption, i) => (
                  <li key={i} className="text-xs text-dark-muted flex items-start gap-2">
                    <span className="text-accent-primary mt-0.5">→</span>
                    {assumption}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Invalidation */}
          {justification.invalidation.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-dark-muted mb-2">Invalidation</h4>
              <ul className="space-y-1">
                {justification.invalidation.map((condition, i) => (
                  <li key={i} className="text-xs text-red-400/80 flex items-start gap-2">
                    <span className="mt-0.5">⚠</span>
                    {condition}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data source with link */}
          <div className="pt-2 border-t border-dark-border/30 flex items-center justify-between">
            <a 
              href={source.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-dark-muted hover:text-white transition-colors flex items-center gap-1"
            >
              Data Source: <span className={source.color}>{source.icon} {source.name}</span>
              <span className="text-dark-muted">↗</span>
            </a>
            {rawJson?.error && (
              <span className="text-[10px] text-red-400">⚠ Data error</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

