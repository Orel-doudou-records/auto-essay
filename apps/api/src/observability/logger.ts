export interface LogSink {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
}

export function createLogger(sink: LogSink): Logger {
  return {
    info(message, context) {
      sink.info(message, context);
    },
    error(message, error, context) {
      const details = error instanceof Error ? { errorName: error.name, message: error.message } : { error: String(error) };
      sink.error(message, { ...context, ...details });
    },
  };
}

const processSink: LogSink = {
  info(message, context) {
    process.stdout.write(`${message}${context ? ` ${JSON.stringify(context)}` : ""}\n`);
  },
  error(message, context) {
    process.stderr.write(`${message}${context ? ` ${JSON.stringify(context)}` : ""}\n`);
  },
};

export const logger = createLogger(processSink);
