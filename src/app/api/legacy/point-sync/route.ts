// Legacy source: legacy/www/api/point_sync.php
// Compatibility route for rewrite /api/point_sync.php -> /api/legacy/point-sync.

import { NextRequest } from 'next/server';
import {
  isLegacyAuthorized,
  legacyJson,
  legacyOptions,
  readJsonBody,
} from '@/app/api/legacy/_shared';
import {
  listLegacyMembers,
  registerLegacyMember,
  syncLegacyPoint,
} from '@/server/services/legacy-api.service';
import {
  legacyPointSyncSchema,
  legacyRegisterMemberSchema,
} from '@/schemas/legacy-api';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return legacyOptions();
}

export async function GET(req: NextRequest) {
  if (!isLegacyAuthorized(req)) {
    return legacyJson({ success: false, message: 'Unauthorized Access: Key Mismatch' }, 401);
  }

  if (req.nextUrl.searchParams.get('action') !== 'list_members') {
    return legacyJson({ success: false, message: 'No valid action or data provided.' });
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? 1) || 1);
  const limit = Math.min(
    200,
    Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 50) || 50),
  );
  const search = req.nextUrl.searchParams.get('search')?.trim() ?? '';

  try {
    return legacyJson(await listLegacyMembers({ page, limit, search }));
  } catch (err) {
    logger.error({ err }, 'legacy point-sync list_members failed');
    return legacyJson({ success: false, message: 'Database error' }, 500);
  }
}

export async function POST(req: NextRequest) {
  if (!isLegacyAuthorized(req)) {
    return legacyJson({ success: false, message: 'Unauthorized Access: Key Mismatch' }, 401);
  }

  const body = await readJsonBody(req);
  const action = req.nextUrl.searchParams.get('action') ?? '';

  try {
    if (action === 'register_member') {
      const parsed = legacyRegisterMemberSchema.safeParse(body);
      if (!parsed.success) {
        return legacyJson({ success: false, message: 'Missing required fields (userid, password)' });
      }
      return legacyJson(await registerLegacyMember(parsed.data));
    }

    const point = legacyPointSyncSchema.safeParse(body);
    if (point.success) {
      return legacyJson(await syncLegacyPoint(point.data));
    }

    return legacyJson({ success: false, message: 'No valid action or data provided.' });
  } catch (err) {
    logger.error({ err }, 'legacy point-sync POST failed');
    return legacyJson({ success: false, message: 'Database error' }, 500);
  }
}
