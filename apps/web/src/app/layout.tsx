import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crypto Signal Tracker',
  description: 'Personal BTC & ETH signal monitoring dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen grid-pattern">
          {children}
        </div>
      </body>
    </html>
  );
}

