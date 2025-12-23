import { NextRequest, NextResponse } from 'next/server';
import { validateJobAuth, unauthorizedResponse } from '@/lib/auth';
import { runDailyJob } from '@/lib/jobs';

export async function POST(request: NextRequest) {
  // Validate authentication
  const auth = validateJobAuth(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error!);
  }

  try {
    const started = await runDailyJob();

    if (!started) {
      return NextResponse.json({
        success: true,
        message: 'Job already running or completed for this time bucket',
        started: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Daily job completed successfully',
      started: true,
    });
  } catch (error) {
    console.error('Daily job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

