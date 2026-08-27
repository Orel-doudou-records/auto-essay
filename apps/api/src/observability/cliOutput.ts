export interface CliSink {
  writeStdout(message: string): void;
  writeStderr(message: string): void;
}

export interface CliOutput {
  success(message: string): void;
  error(message: string): void;
}

export function createCliOutput(sink: CliSink): CliOutput {
  return {
    success(message) {
      sink.writeStdout(`${message}\n`);
    },
    error(message) {
      sink.writeStderr(`${message}\n`);
    },
  };
}

export const cliOutput = createCliOutput({
  writeStdout(message) {
    process.stdout.write(message);
  },
  writeStderr(message) {
    process.stderr.write(message);
  },
});
