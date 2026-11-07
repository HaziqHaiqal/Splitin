import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";

const COOKIE = "splitin-browser";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function browserHash(): Promise<string | null> {
  const key = (await cookies()).get(COOKIE)?.value;
  return key ? hashToken(key) : null;
}

export async function ensureBrowserHash(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return hashToken(existing);
  const key = randomBytes(32).toString("base64url");
  store.set(COOKIE, key, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return hashToken(key);
}

export async function ipHash(): Promise<string> {
  const key = process.env.BILL_SIGNING_SECRET;
  if (!key) throw new Error("BILL_SIGNING_SECRET is not set");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 32);
}
