import { PrismaClient } from '@prisma/client';

// Vercel 서버리스 환경에서 함수 인스턴스가 재사용될 때 커넥션 폭증을 막기 위한 싱글턴.
// docs/05-vercel.md, docs/07-traffic.md 참조.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
