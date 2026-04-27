// Legacy source: legacy/www/api/gnp-api.php
// Compatibility route for rewrite /api/gnp-api.php -> /api/legacy/gnp-api.

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

  const action = req.nextUrl.searchParams.get('action') ?? '';
  if (action !== 'list_members') {
    return legacyJson({ success: false, message: 'No Action' });
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
    logger.error({ err }, 'legacy gnp-api list_members failed');
    return legacyJson({ success: false, message: 'DB Error' }, 500);
  }
}

export async function POST(req: NextRequest) {
  if (!isLegacyAuthorized(req)) {
    return legacyJson({ success: false, message: 'Unauthorized Access: Key Mismatch' }, 401);
  }

  const body = await readJsonBody(req);
  const action = req.nextUrl.searchParams.get('action') ?? (
    body && typeof body === 'object' && 'action' in body ? String(body.action) : ''
  );

  try {
    if (action === 'register_member') {
      const parsed = legacyRegisterMemberSchema.safeParse(body);
      if (!parsed.success) {
        return legacyJson({ success: false, message: 'Missing fields' });
      }
      const result = await registerLegacyMember(parsed.data);
      if (result.success) return legacyJson({ success: true });
      if (result.message === 'User already exists') {
        return legacyJson({ success: false, message: 'Already exists' });
      }
      return legacyJson(result);
    }

    const point = legacyPointSyncSchema.safeParse(body);
    if (point.success) {
      const result = await syncLegacyPoint(point.data);
      if (result.success) return legacyJson({ success: true, message: 'Success' });
      return legacyJson(result);
    }

    return legacyJson({ success: false, message: 'No Action' });
  } catch (err) {
    logger.error({ err }, 'legacy gnp-api POST failed');
    return legacyJson({ success: false, message: 'DB Error' }, 500);
  }
}
