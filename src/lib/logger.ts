import pino from 'pino';

// Vercel 환경에서는 구조화 JSON 로그가 읽기 좋음.
// console.* 사용 금지(.eslintrc.json). 항상 이 logger로.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { svc: 'gng' },
  redact: {
    paths: ['req.headers.authorization', 'password', 'passwordHash', '*.password', 'phone', 'email'],
    censor: '[redacted]',
  },
});
