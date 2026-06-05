const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function timestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, args: unknown[]): string {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;
  return args
    .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a, null, 2) : String(a)))
    .join(' ');
}

export const logger = {
  debug(...args: unknown[]): void {
    console.debug(formatMessage('debug', args));
  },
  info(...args: unknown[]): void {
    console.info(formatMessage('info', args));
  },
  warn(...args: unknown[]): void {
    console.warn(formatMessage('warn', args));
  },
  error(...args: unknown[]): void {
    console.error(formatMessage('error', args));
  },
};
