type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

const REDACTED = '[REDACTED]';
const SENSITIVE_FIELD = /(authorization|cookie|password|secret|token|content|message|email|phone|address|lat|lng)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[TRUNCATED]';
  if (value instanceof Error) {
    return { name: value.name };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitize(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_FIELD.test(key) ? REDACTED : sanitize(item, depth + 1),
    ]),
  );
}

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(fields) as LogFields,
  });

  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => write('debug', event, fields),
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields),
};
