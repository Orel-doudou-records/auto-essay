import { describe, expect, it, vi } from "vitest";
import { withProjectWriteLock } from "../src/services/projectWriteLock.js";

describe("withProjectWriteLock", () => {
  it("serializes writers for one project", async () => {
    const events: string[] = [];
    let releaseFirst = () => undefined;
    const first = withProjectWriteLock("project-1", async () => {
      events.push("first-start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      events.push("first-end");
    });
    await vi.waitFor(() => expect(events).toEqual(["first-start"]));
    const second = withProjectWriteLock("project-1", async () => {
      events.push("second");
    });

    expect(events).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "first-end", "second"]);
  });
});
