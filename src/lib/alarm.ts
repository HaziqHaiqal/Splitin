import type { Instrumentation } from "next";

type ErrorContext = Parameters<Instrumentation.onRequestError>[2];

export function scrub(text: string) {
  return text
    .replace(/(["'`]).*?\1/g, "…")
    .replace(/=\([^)]*\)/g, "=(…)")
    .replace(/\b[A-Z0-9]{8,16}\b|\b(?=[A-Za-z]*\d)[A-Za-z0-9]{8,16}\b|\d{4,}/g, "…")
    .slice(0, 300);
}

export function alarmFor(error: unknown, context: ErrorContext, commit = "unknown") {
  const err = error instanceof Error ? error : new Error(String(error));
  const where = `${context.routeType} ${context.routePath}`;
  const digest = (err as { digest?: unknown }).digest;
  const frames = (err.stack ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, 5);
  return {
    title: `API error: ${err.name} in ${where}`,
    details: [
      `${err.name} in ${where} on commit ${commit}.`,
      `Message: ${scrub(err.message.split("\n")[0])}`,
      typeof digest === "string" ? `Digest: ${digest} (search for it in the Vercel logs)` : "",
      ...frames,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
