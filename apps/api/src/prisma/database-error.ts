const TRANSIENT_PRISMA_ERROR_CODES = new Set([
  'P1001', // Can't reach database server.
  'P1002', // Database server timed out.
  'P1017', // Server closed connection.
  'P2024', // Timed out fetching connection from pool.
]);

const TRANSIENT_CONNECTION_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  '57P01', // admin_shutdown
  '53300', // too_many_connections
]);

const TRANSIENT_DB_MESSAGE_SNIPPETS = [
  'connection terminated due to connection timeout',
  'connection terminated unexpectedly',
  'server closed the connection unexpectedly',
  "can't reach database server",
  'failed to connect to database',
  'timed out fetching a new connection from the connection pool',
  'timeout fetching a new connection from the connection pool',
  'remaining connection slots are reserved',
  'sorry, too many clients already',
];

type ErrorLike = {
  code?: unknown;
  cause?: unknown;
  errorCode?: unknown;
  message?: unknown;
};

const getStringValue = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const matchesTransientMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return TRANSIENT_DB_MESSAGE_SNIPPETS.some((snippet) => normalized.includes(snippet));
};

const isTransientCode = (code: string): boolean => {
  return (
    TRANSIENT_PRISMA_ERROR_CODES.has(code) ||
    TRANSIENT_CONNECTION_ERROR_CODES.has(code.toUpperCase())
  );
};

const getErrorCode = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const error = value as ErrorLike;
  return getStringValue(error.code) ?? getStringValue(error.errorCode);
};

const getErrorMessage = (value: unknown): string | null => {
  if (value instanceof Error) {
    return getStringValue(value.message);
  }

  if (!value || typeof value !== 'object') {
    return getStringValue(value);
  }

  return getStringValue((value as ErrorLike).message);
};

const getErrorCause = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return (value as ErrorLike).cause ?? null;
};

export const isTransientDatabaseError = (error: unknown): boolean => {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (current && !visited.has(current)) {
    visited.add(current);

    const code = getErrorCode(current);
    if (code && isTransientCode(code)) {
      return true;
    }

    const message = getErrorMessage(current);
    if (message && matchesTransientMessage(message)) {
      return true;
    }

    current = getErrorCause(current);
  }

  return false;
};
