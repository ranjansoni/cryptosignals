# Crypto Signal Tracker

Personal BTC & ETH signal monitoring dashboard with automated signal computation, state tracking, and performance evaluation.

## Architecture

```
├── apps/
│   ├── web/          # Next.js dashboard + API routes
│   └── worker/       # Node.js job runner for signal computation
├── packages/
│   └── shared/       # Shared types, providers, signals, utilities
├── prisma/           # Database schema and migrations
└── docker-compose.yml
```

## Features

- **7 Signals** across funding, open interest, technical, and macro categories
- **State tracking** with transition logging
- **Performance evaluation** at 1D, 7D, and 30D horizons
- **Rolling statistics** for hit rate and average returns
- **Beautiful dashboard** with real-time signal states

## Signals

| Signal | Category | Frequency | Assets |
|--------|----------|-----------|--------|
| Funding Rate | Funding | Hourly | BTC, ETH |
| Open Interest | Open Interest | Hourly | BTC, ETH |
| RSI (14) | Technical | Daily | BTC, ETH |
| 200-Day MA Regime | Technical | Daily | BTC, ETH |
| Stablecoin Supply | Macro | Weekly | GLOBAL |
| DXY Trend | Macro | Weekly | GLOBAL |
| Fed Balance Sheet YoY | Macro | Weekly | GLOBAL |

## Signal States

- **STRONG_BUY**: Highly bullish condition
- **BUY**: Moderately bullish
- **NEUTRAL**: No clear direction
- **SELL**: Moderately bearish
- **STRONG_SELL**: Highly bearish condition

## Data Providers

- **CoinGecko**: BTC/ETH prices and OHLCV data (free tier)
- **DeFiLlama**: Stablecoin supply (USDT + USDC)
- **FRED**: DXY proxy and Fed balance sheet data
- **CoinGlass**: Funding rates and open interest (requires API key)

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="mysql://root:password@localhost:3306/crypto_signals"

# API Keys
COINGLASS_API_KEY="your_coinglass_api_key"
FRED_API_KEY="your_fred_api_key"

# Job Authentication (for cron-job.org)
JOB_TOKEN="your_secure_job_token"

# Optional
NODE_ENV="development"
```

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start MySQL** (or use Docker):
   ```bash
   docker run -d \
     --name crypto-mysql \
     -e MYSQL_ROOT_PASSWORD=password \
     -e MYSQL_DATABASE=crypto_signals \
     -p 3306:3306 \
     mysql:8.0
   ```

3. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Generate Prisma client:**
   ```bash
   npm run db:generate
   ```

5. **Start development servers:**
   ```bash
   # Terminal 1: Web app
   npm run web:dev
   
   # Terminal 2: Worker (optional, for local cron)
   npm run worker:dev
   ```

6. **Access dashboard:**
   Open http://localhost:3000

### Manual Job Execution

```bash
# Run specific jobs
cd apps/worker
npm run job:hourly
npm run job:daily
npm run job:weekly
```

### Docker Deployment

1. **Build and start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Run migrations:**
   ```bash
   docker-compose run --rm migrate
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f web worker
   ```

## API Endpoints

### Job Triggers (Authenticated)

```bash
# Hourly job
curl -X POST http://localhost:3000/api/jobs/hourly \
  -H "Authorization: Bearer YOUR_JOB_TOKEN"

# Daily job
curl -X POST http://localhost:3000/api/jobs/daily \
  -H "Authorization: Bearer YOUR_JOB_TOKEN"

# Weekly job
curl -X POST http://localhost:3000/api/jobs/weekly \
  -H "Authorization: Bearer YOUR_JOB_TOKEN"
```

### Read Endpoints (Public)

```bash
# Current signal states
GET /api/snapshot

# Signal events (last N days)
GET /api/events?days=30

# Performance statistics
GET /api/stats
```

## Scheduling with cron-job.org

1. Create accounts at [cron-job.org](https://cron-job.org)
2. Set up webhooks for each job frequency:

| Job | Cron Expression | URL |
|-----|----------------|-----|
| Hourly | `0 * * * *` | `POST https://your-domain/api/jobs/hourly` |
| Daily | `0 0 * * *` | `POST https://your-domain/api/jobs/daily` |
| Weekly | `0 0 * * 0` | `POST https://your-domain/api/jobs/weekly` |

3. Add header: `Authorization: Bearer YOUR_JOB_TOKEN`

## Success Thresholds

| Horizon | Threshold |
|---------|-----------|
| 1 Day | ±1% |
| 7 Days | ±3% |
| 30 Days | ±7% |

- **BUY signals**: Success if forward return > +threshold
- **SELL signals**: Success if forward return < -threshold
- **NEUTRAL signals**: Not evaluated

## Database Schema

- **Price**: OHLCV data from providers
- **SignalState**: Current state of each signal
- **SignalEvent**: State transitions (logged events)
- **SignalOutcome**: Evaluation results after horizons mature
- **SignalStats**: Rolling statistics (90d and 365d windows)
- **JobRun**: Job execution tracking with locking

## Project Structure

```
packages/shared/src/
├── types/           # TypeScript types and enums
│   ├── index.ts     # Core types
│   └── registry.ts  # Signal configurations
├── utils/           # Utility functions
├── providers/       # Data provider clients
│   ├── coingecko.ts
│   ├── defillama.ts
│   ├── fred.ts
│   └── coinglass.ts
└── signals/         # Signal computation functions
    ├── fundingRate.ts
    ├── openInterest.ts
    ├── rsi.ts
    ├── ma200Regime.ts
    ├── stablecoinSupply.ts
    ├── dxyTrend.ts
    └── fedBalanceSheetYoY.ts
```

## License

MIT

