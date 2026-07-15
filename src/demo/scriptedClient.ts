import type { StructuredModelClient } from "../evaluation/evaluateEssay";

export type StructuredResponseFactory = (
  prompt: string,
  callIndex: number
) => unknown | Promise<unknown>;

export interface ScriptedResponse {
  label: string;
  match: string | RegExp;
  respond: unknown | StructuredResponseFactory;
  remainingUses?: number;
}

export interface StructuredClientCall {
  label: string;
  prompt: string;
  callIndex: number;
}

/**
 * Client déterministe pour démonstrateurs et tests d'intégration.
 * Chaque appel doit correspondre à une route explicite.
 */
export class ScriptedStructuredClient implements StructuredModelClient {
  private readonly routes: Array<ScriptedResponse & { remaining: number }>;
  private readonly calls: StructuredClientCall[] = [];

  constructor(routes: ScriptedResponse[]) {
    this.routes = routes.map((route) => ({
      ...route,
      remaining: route.remainingUses ?? 1,
    }));
  }

  async generateJson(prompt: string): Promise<unknown> {
    const route = this.routes.find(
      (candidate) =>
        candidate.remaining > 0 && matches(candidate.match, prompt)
    );

    if (!route) {
      throw new Error(
        `No scripted structured response matches prompt #${this.calls.length}`
      );
    }

    const callIndex = this.calls.length;
    route.remaining -= 1;
    this.calls.push({ label: route.label, prompt, callIndex });

    return typeof route.respond === "function"
      ? route.respond(prompt, callIndex)
      : structuredClone(route.respond);
  }

  getCalls(): StructuredClientCall[] {
    return [...this.calls];
  }

  assertAllRequiredResponsesUsed(): void {
    const unused = this.routes.filter((route) => route.remaining > 0);

    if (unused.length > 0) {
      throw new Error(
        `Unused scripted responses: ${unused
          .map((route) => `${route.label} (${route.remaining})`)
          .join(", ")}`
      );
    }
  }
}

export class CallbackStructuredClient implements StructuredModelClient {
  private callIndex = 0;

  constructor(private readonly respond: StructuredResponseFactory) {}

  async generateJson(prompt: string): Promise<unknown> {
    const currentIndex = this.callIndex;
    this.callIndex += 1;
    return this.respond(prompt, currentIndex);
  }
}

function matches(pattern: string | RegExp, prompt: string): boolean {
  return typeof pattern === "string"
    ? prompt.includes(pattern)
    : new RegExp(pattern.source, pattern.flags).test(prompt);
}
