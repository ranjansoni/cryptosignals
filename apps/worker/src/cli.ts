import 'dotenv/config';
import { runHourlyJob, runDailyJob, runWeeklyJob } from './jobs';

async function main(): Promise<void> {
  const jobType = process.argv[2];

  if (!jobType) {
    console.error('Usage: ts-node cli.ts <hourly|daily|weekly>');
    process.exit(1);
  }

  console.log(`Starting ${jobType} job...`);

  try {
    switch (jobType) {
      case 'hourly':
        await runHourlyJob();
        break;
      case 'daily':
        await runDailyJob();
        break;
      case 'weekly':
        await runWeeklyJob();
        break;
      default:
        console.error(`Unknown job type: ${jobType}`);
        console.error('Valid options: hourly, daily, weekly');
        process.exit(1);
    }

    console.log(`${jobType} job completed`);
    process.exit(0);
  } catch (error) {
    console.error(`${jobType} job failed:`, error);
    process.exit(1);
  }
}

main();

