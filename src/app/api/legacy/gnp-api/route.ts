// Legacy source: legacy/www/api/gnp-api.php
// Compatibility route for rewrite /api/gnp-api.php -> /api/legacy/gnp-api.

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

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  if (!isLegacyAuthorized(req)) {
    return legacyLoggedJson(req, {
      service: 'gng-api',
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
      service: 'gng-api',
      startedAt,
      action,
      requestPayload: Object.fromEntries(req.nextUrl.searchParams.entries()),
      responsePayload: { success: false, message: 'No Action' },
      errorMessage: 'No Action',
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
      service: 'gng-api',
      startedAt,
      action,
      requestPayload: Object.fromEntries(req.nextUrl.searchParams.entries()),
      responsePayload: result,
    });
  } catch (err) {
    logger.error({ err }, 'legacy gnp-api list_members failed');
    return legacyLoggedJson(req, {
      service: 'gng-api',
      startedAt,
      action,
      requestPayload: Object.fromEntries(req.nextUrl.searchParams.entries()),
      responsePayload: { success: false, message: 'DB Error' },
      status: 500,
      errorMessage: 'DB Error',
    });
  }
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  if (!isLegacyAuthorized(req)) {
    return legacyLoggedJson(req, {
      service: 'gng-api',
      startedAt,
      responsePayload: { success: false, message: 'Unauthorized Access: Key Mismatch' },
      status: 401,
      errorMessage: 'Unauthorized Access: Key Mismatch',
    });
  }

  const body = await readJsonBody(req);
  const action =
    req.nextUrl.searchParams.get('action') ??
    (body && typeof body === 'object' && 'action' in body ? String(body.action) : '');

  try {
    if (action === 'register_member') {
      const parsed = legacyRegisterMemberSchema.safeParse(body);
      if (!parsed.success) {
        return legacyLoggedJson(req, {
          service: 'gng-api',
          startedAt,
          action,
          requestPayload: body,
          responsePayload: { success: false, message: 'Missing fields' },
          errorMessage: 'Missing fields',
        });
      }
      const result = await registerLegacyMember(parsed.data);
      if (result.success) {
        return legacyLoggedJson(req, {
          service: 'gng-api',
          startedAt,
          action,
          requestPayload: body,
          responsePayload: { success: true },
        });
      }
      if (result.message === 'User already exists') {
        return legacyLoggedJson(req, {
          service: 'gng-api',
          startedAt,
          action,
          requestPayload: body,
          responsePayload: { success: false, message: 'Already exists' },
          errorMessage: 'Already exists',
        });
      }
      return legacyLoggedJson(req, {
        service: 'gng-api',
        startedAt,
        action,
        requestPayload: body,
        responsePayload: result,
        errorMessage: result.message,
      });
    }

    const point = legacyPointSyncSchema.safeParse(body);
    if (point.success) {
      const result = await syncLegacyPoint(point.data);
      if (result.success) {
        return legacyLoggedJson(req, {
          service: 'gng-api',
          startedAt,
          action: 'point_sync',
          requestPayload: body,
          responsePayload: { success: true, message: 'Success' },
        });
      }
      return legacyLoggedJson(req, {
        service: 'gng-api',
        startedAt,
        action: 'point_sync',
        requestPayload: body,
        responsePayload: result,
        errorMessage: result.message,
      });
    }

    return legacyLoggedJson(req, {
      service: 'gng-api',
      startedAt,
      action,
      requestPayload: body,
      responsePayload: { success: false, message: 'No Action' },
      errorMessage: 'No Action',
    });
  } catch (err) {
    logger.error({ err }, 'legacy gnp-api POST failed');
    return legacyLoggedJson(req, {
      service: 'gng-api',
      startedAt,
      action,
      requestPayload: body,
      responsePayload: { success: false, message: 'DB Error' },
      status: 500,
      errorMessage: 'DB Error',
    });
  }
}
