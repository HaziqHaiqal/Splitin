import { describe, expect, it } from "vitest";
import { alarmFor, scrub } from "./alarm";

const context = {
  routerKind: "App Router",
  routePath: "/bill/[id]",
  routeType: "action",
  revalidateReason: undefined,
} as const;

describe("scrub", () => {
  it.each([
    ['Name "Haziq" is taken', "Name … is taken"],
    ["Key (bill_id, name)=(K7QM3XPH, Haziq) already exists", "Key (bill_id, name)=(…) already exists"],
    ["Bill K7QM3XPH not found", "Bill … not found"],
    ["Bill aB3dEfGhJk not found", "Bill … not found"],
    ["Account 1234567890 failed", "Account … failed"],
    ["Cannot read properties of undefined (reading 'name')", "Cannot read properties of undefined (reading …)"],
    ["duplicate key value violates unique constraint", "duplicate key value violates unique constraint"],
  ])("turns %j into %j", (input, output) => {
    expect(scrub(input)).toBe(output);
  });

  it("keeps it short", () => {
    expect(scrub("x".repeat(500))).toHaveLength(300);
  });
});

describe("alarmFor", () => {
  it("names the error and the route pattern, not the real link", () => {
    const { title, details } = alarmFor(new TypeError("boom"), context, "abc123");
    expect(title).toBe("API error: TypeError in action /bill/[id]");
    expect(details).toContain("TypeError in action /bill/[id] on commit abc123.");
    expect(details).toContain("Message: boom");
  });

  it("keeps the first line of the message, the digest and the stack frames", () => {
    const error = Object.assign(new Error("first line\nsecond line"), {
      digest: "12345",
      stack: "Error: first line\nsecond line\n    at save (/var/task/a.js:1:2)\n    at run (/var/task/b.js:3:4)",
    });
    const { details } = alarmFor(error, context);
    expect(details).toContain("Message: first line\n");
    expect(details).toContain("Digest: 12345");
    expect(details).toContain("at save (/var/task/a.js:1:2)\nat run (/var/task/b.js:3:4)");
    expect(details).not.toContain("second line");
  });

  it("handles things thrown that aren't errors", () => {
    expect(alarmFor("oops", context).title).toBe("API error: Error in action /bill/[id]");
  });
});
