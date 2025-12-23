import 'dotenv/config';
import { runHourlyJob, runDailyJob, runWeeklyJob } from './jobs';

// Export jobs for use by Next.js API routes or external callers
export { runHourlyJob, runDailyJob, runWeeklyJob };

// Simple cron runner for local development
// In production, use cron-job.org to call API routes
async function runLocalCron(): Promise<void> {
  console.log('Worker started in cron mode');

  const runAllJobs = async () => {
    const now = new Date();
    const hour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();
    const minute = now.getUTCMinutes();

    // Run hourly job at the top of each hour
    if (minute < 5) {
      console.log('Running hourly job...');
      try {
        await runHourlyJob();
      } catch (error) {
        console.error('Hourly job error:', error);
      }
    }

    // Run daily job at 00:00 UTC
    if (hour === 0 && minute < 5) {
      console.log('Running daily job...');
      try {
        await runDailyJob();
      } catch (error) {
        console.error('Daily job error:', error);
      }
    }

    // Run weekly job on Sunday at 00:00 UTC
    if (dayOfWeek === 0 && hour === 0 && minute < 5) {
      console.log('Running weekly job...');
      try {
        await runWeeklyJob();
      } catch (error) {
        console.error('Weekly job error:', error);
      }
    }
  };

  // Initial run
  await runAllJobs();

  // Check every minute
  setInterval(runAllJobs, 60 * 1000);
}

// Run if executed directly
if (require.main === module) {
  const mode = process.argv[2];

  if (mode === 'cron') {
    runLocalCron().catch(console.error);
  } else {
    console.log('Worker module loaded. Use CLI for manual job runs or "cron" mode for local scheduling.');
    console.log('Usage: npm run start cron');
  }
}

