'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type HorizonBucket = 'short' | 'mid' | 'long';

interface HorizonSelectorProps {
  selected: HorizonBucket;
}

const horizonConfig: Record<HorizonBucket, { label: string; sublabel: string; evalDays: string }> = {
  short: {
    label: 'Short',
    sublabel: '2-7 days',
    evalDays: 'Eval: 2d, 7d',
  },
  mid: {
    label: 'Mid',
    sublabel: '10-30 days',
    evalDays: 'Eval: 10d, 30d',
  },
  long: {
    label: 'Long',
    sublabel: '45-60+ days',
    evalDays: 'Eval: 45d, 60d',
  },
};

export default function HorizonSelector({ selected }: HorizonSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (bucket: HorizonBucket) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('horizon', bucket);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
      <span className="text-sm font-medium text-dark-muted uppercase tracking-wider">
        Horizon
      </span>
      <div className="flex gap-2">
        {(Object.keys(horizonConfig) as HorizonBucket[]).map((bucket) => {
          const config = horizonConfig[bucket];
          const isSelected = selected === bucket;
          
          return (
            <button
              key={bucket}
              onClick={() => handleSelect(bucket)}
              className={`
                relative px-4 py-2 rounded-lg transition-all duration-200
                ${isSelected 
                  ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-white shadow-lg shadow-accent-primary/25' 
                  : 'bg-dark-card border border-dark-border text-dark-muted hover:text-white hover:border-accent-primary/50'
                }
              `}
            >
              <div className="flex flex-col items-center">
                <span className={`font-semibold ${isSelected ? 'text-white' : ''}`}>
                  {config.label}
                </span>
                <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-dark-muted'}`}>
                  {config.sublabel}
                </span>
              </div>
              {isSelected && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-accent-primary rotate-45" />
              )}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-dark-muted ml-auto hidden sm:block">
        {horizonConfig[selected].evalDays}
      </span>
    </div>
  );
}

