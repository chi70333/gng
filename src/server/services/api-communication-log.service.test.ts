import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  API_COMMUNICATION_LOG_RETENTION_DAYS,
  getApiCommunicationLogRetentionCutoff,
  pruneOldApiCommunicationLogs,
} from './api-communication-log.service';

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    $executeRaw: mocks.executeRaw,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

describe('api communication log retention', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://test';
    mocks.executeRaw.mockReset();
    mocks.loggerError.mockReset();
    mocks.loggerInfo.mockReset();
  });

  it('uses a three day retention cutoff', () => {
    const cutoff = getApiCommunicationLogRetentionCutoff(new Date('2026-05-02T12:30:00.000Z'));

    expect(API_COMMUNICATION_LOG_RETENTION_DAYS).toBe(3);
    expect(cutoff.toISOString()).toBe('2026-04-29T12:30:00.000Z');
  });

  it('deletes API logs older than the cutoff', async () => {
    mocks.executeRaw.mockResolvedValue(12);

    const result = await pruneOldApiCommunicationLogs(new Date('2026-05-02T12:30:00.000Z'));

    expect(result).toEqual({
      cutoff: new Date('2026-04-29T12:30:00.000Z'),
      deletedCount: 12,
      retentionDays: 3,
    });
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.executeRaw.mock.calls[0]?.[1]).toEqual(new Date('2026-04-29T12:30:00.000Z'));
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      {
        cutoff: '2026-04-29T12:30:00.000Z',
        deletedCount: 12,
        retentionDays: 3,
      },
      'Old API communication logs pruned',
    );
  });

  it('skips the database call when DATABASE_URL is absent', async () => {
    delete process.env.DATABASE_URL;

    const result = await pruneOldApiCommunicationLogs(new Date('2026-05-02T12:30:00.000Z'));

    expect(result.deletedCount).toBe(0);
    expect(result.retentionDays).toBe(3);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });
});
