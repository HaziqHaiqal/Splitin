import "server-only";
import { replyText, SCAN_PROMPT, SCAN_SCHEMA, toScan, type Scan, type ScanError } from "./receipt-scan";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = "gemini-3.5-flash-lite";

type Read = { ok: true; scan: Scan } | { ok: false; error: ScanError };

async function ask(key: string, photo: Blob): Promise<Read> {
  const data = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key, "Api-Revision": "2026-05-20" },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL || MODEL,
      system_instruction: SCAN_PROMPT,
      input: [
        { type: "text", text: "Read this receipt." },
        { type: "image", data, mime_type: photo.type },
      ],
      response_format: { type: "text", mime_type: "application/json", schema: SCAN_SCHEMA },
      store: false,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (response.status === 429 || response.status === 503) return { ok: false, error: "busy" };
  if (!response.ok) {
    console.error("[splitin] scan failed:", response.status, (await response.text()).slice(0, 500));
    return { ok: false, error: "failed" };
  }
  const text = replyText(await response.json());
  if (!text) return { ok: false, error: "unreadable" };
  try {
    return toScan(JSON.parse(text));
  } catch {
    return { ok: false, error: "unreadable" };
  }
}

export async function readReceipt(key: string, photo: Blob): Promise<Read> {
  try {
    return await ask(key, photo);
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") return { ok: false, error: "busy" };
    throw error;
  }
}
