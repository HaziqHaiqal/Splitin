import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

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
