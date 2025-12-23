'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Snapshot', icon: '◎' },
  { href: '/events', label: 'Events', icon: '⚡' },
  { href: '/stats', label: 'Stats', icon: '📊' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-dark-border bg-dark-bg/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <span className="text-xl font-bold text-white">₿</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-wider text-white">
                SIGNAL<span className="text-accent-primary">TRACKER</span>
              </h1>
              <p className="text-[10px] text-dark-muted uppercase tracking-widest">
                BTC • ETH Monitor
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link flex items-center gap-2 ${
                  pathname === item.href ? 'active' : ''
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-dark-muted">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}

