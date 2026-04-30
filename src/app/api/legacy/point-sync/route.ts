// Legacy source: legacy/www/api/point_sync.php
// Compatibility route for rewrite /api/point_sync.php -> /api/legacy/point-sync.

import { NextRequest } from 'next/server';
import {
  isLegacyAuthorized,
  legacyLoggedJson,
  legacyOptions,
  readJsonBody,
} from '@/app/api/legacy/_shared';
import {
  type LegacyMemberListFilters,
  listLegacyMembers,
  registerLegacyMember,
  syncLegacyPoint,
} from '@/server/services/legacy-api.service';
import { legacyPointSyncSchema, legacyRegisterMemberSchema } from '@/schemas/legacy-api';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return legacyOptions();
}

function readMemberFilters(searchParams: URLSearchParams): LegacyMemberListFilters {
  return {
    userid: searchParams.get('userid')?.trim() || undefined,
    loginId: searchParams.get('loginId')?.trim() || undefined,
    name: searchParams.get('name')?.trim() || undefined,
    email: searchParams.get('email')?.trim() || undefined,
    hp: searchParams.get('hp')?.trim() || undefined,
    phone: searchParams.get('phone')?.trim() || undefined,
  };
}

function readBodyAction(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('action' in body)) return null;
  const action = String((body as { action: unknown }).action).trim();
  return action || null;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  if (!isLegacyAuthorized(req)) {
    return legacyLoggedJson(req, {
      service: 'point-sync',
      startedAt,
      requestPayload: Object.fromEntries(req.nextUrl.searchParams.entries()),
      responsePayload: { success: false, message: 'Unauthorized Access: Key Mismatch' },
      status: 401,
      errorMessage: 'Unauthorized Access: Key Mismatch',
    });
  }

  const action = req.nextUrl.searchParams.get('action') ?? '';
  if (action !== 'list_members') {
    return legacyLoggedJson(req, {
      service: 'point-sync',
      startedAt,
      action,
      requestPayload: Object.fromEntries(req.nextUrl.searchParams.entries()),
      responsePayload: { success: false, message: 'No valid action or data provided.' },
      errorMessage: 'No valid action or data provided.',
    });
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? 1) || 1);
  const limit = Math.min(
    200,
    Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50),
  );
  const search = req.nextUrl.searchParams.get('search')?.trim() ?? '';
  const filters = readMemberFilters(req.nextUrl.searchParams);

  try {
    const result = await listLegacyMembers({ page, limit, search, filters });
    return legacyLoggedJson(req, {
      service: 'point-sync',
      startedAt,
      action,
      requestPayload: Object.fromEntries(req.nextUrl.searchParams.entries()),
      responsePayload: result,
    });
  } catch (err) {
    logger.error({ err }, 'legacy point-sync list_members failed');
    return legacyLoggedJson(req, {
      service: 'point-sync',
      startedAt,
      action,
      requestPayload: Object.fromEntries(req.nextUrl.searchParams.entries()),
      responsePayload: { success: false, message: 'Database error' },
      status: 500,
      errorMessage: 'Database error',
    });
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  if (!isLegacyAuthorized(req)) {
    return legacyLoggedJson(req, {
      service: 'point-sync',
      startedAt,
      responsePayload: { success: false, message: 'Unauthorized Access: Key Mismatch' },
      status: 401,
      errorMessage: 'Unauthorized Access: Key Mismatch',
    });
  }

  const body = await readJsonBody(req);
  const queryAction = req.nextUrl.searchParams.get('action');
  const action = queryAction ?? '';
  const loggedAction = queryAction?.trim() || readBodyAction(body) || '';

  try {
    if (action === 'register_member') {
      const parsed = legacyRegisterMemberSchema.safeParse(body);
      if (!parsed.success) {
        return legacyLoggedJson(req, {
          service: 'point-sync',
          startedAt,
          action,
          requestPayload: body,
          responsePayload: {
            success: false,
            message: 'Missing required fields (userid, password)',
          },
          errorMessage: 'Missing required fields (userid, password)',
        });
      }
      const result = await registerLegacyMember(parsed.data);
      return legacyLoggedJson(req, {
        service: 'point-sync',
        startedAt,
        action,
        requestPayload: body,
        responsePayload: result,
        errorMessage: result.success ? null : result.message,
      });
    }

    const point = legacyPointSyncSchema.safeParse(body);
    if (point.success) {
      const result = await syncLegacyPoint(point.data);
      return legacyLoggedJson(req, {
        service: 'point-sync',
        startedAt,
        action: 'point_sync',
        requestPayload: body,
        responsePayload: result,
        errorMessage: result.success ? null : result.message,
      });
    }

    return legacyLoggedJson(req, {
      service: 'point-sync',
      startedAt,
      action: loggedAction,
      requestPayload: body,
      responsePayload: { success: false, message: 'No valid action or data provided.' },
      errorMessage: 'No valid action or data provided.',
    });
  } catch (err) {
    logger.error({ err }, 'legacy point-sync POST failed');
    return legacyLoggedJson(req, {
      service: 'point-sync',
      startedAt,
      action: loggedAction,
      requestPayload: body,
      responsePayload: { success: false, message: 'Database error' },
      status: 500,
      errorMessage: 'Database error',
    });
  }
}
