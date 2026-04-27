// 도메인 에러 타입. Route Handler 최상단 try/catch 에서 toApiError() 로 변환.
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input', fields?: Record<string, string[]>) {
    super('VALIDATION', message, 400, fields);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too Many Requests') {
    super('RATE_LIMIT', message, 429);
    this.name = 'RateLimitError';
  }
}

/** 표준 API 에러 응답 형식. docs/04-conventions.md 참조. */
export function toApiError(err: unknown): { status: number; body: unknown } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: {
        ok: false,
        error: { code: err.code, message: err.message, fields: err.fields },
      },
    };
  }
  return {
    status: 500,
    body: { ok: false, error: { code: 'INTERNAL', message: 'Internal Server Error' } },
  };
}
