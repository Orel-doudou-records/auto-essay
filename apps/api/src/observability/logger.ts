export function logInfo(message: string, context?: Record<string, unknown>): void {
  process.stdout.write(`${message}${context ? ` ${JSON.stringify(context)}` : ""}\n`);
}

export function logError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const details = error instanceof Error
    ? { errorName: error.name, message: error.message }
    : { error: String(error) };
  process.stderr.write(`${message} ${JSON.stringify({ ...context, ...details })}\n`);
}
