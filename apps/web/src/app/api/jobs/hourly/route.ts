import { NextRequest, NextResponse } from 'next/server';
import { validateJobAuth, unauthorizedResponse } from '@/lib/auth';
import { runHourlyJob } from '@/lib/jobs';

export async function POST(request: NextRequest) {
  // Validate authentication
  const auth = validateJobAuth(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error!);
  }

  try {
    const started = await runHourlyJob();

    if (!started) {
      return NextResponse.json({
        success: true,
        message: 'Job already running or completed for this time bucket',
        started: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Hourly job completed successfully',
      started: true,
    });
  } catch (error) {
    console.error('Hourly job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

