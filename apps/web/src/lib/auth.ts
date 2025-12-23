import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate job authentication token
 * For /api/jobs/* routes
 */
export function validateJobAuth(request: NextRequest): { valid: boolean; error?: string } {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer') {
    return { valid: false, error: 'Invalid Authorization type. Expected: Bearer' };
  }

  const jobToken = process.env.JOB_TOKEN;

  if (!jobToken) {
    console.error('JOB_TOKEN environment variable not set');
    return { valid: false, error: 'Server configuration error' };
  }

  if (token !== jobToken) {
    return { valid: false, error: 'Invalid token' };
  }

  return { valid: true };
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(error: string): NextResponse {
  return NextResponse.json(
    { success: false, error },
    { status: 401 }
  );
}

