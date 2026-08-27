import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/observability/logger.js";

describe("logger applicatif", () => {
  it("délègue les informations et erreurs à des sorties injectées", () => {
    const info = vi.fn();
    const error = vi.fn();
    const logger = createLogger({ info, error });

    logger.info("API démarrée", { port: 3000 });
    logger.error("Échec interne", new Error("indisponible"), { requestId: "request-1" });

    expect(info).toHaveBeenCalledWith("API démarrée", { port: 3000 });
    expect(error).toHaveBeenCalledWith("Échec interne", expect.objectContaining({
      message: "indisponible",
      requestId: "request-1",
    }));
  });
});
