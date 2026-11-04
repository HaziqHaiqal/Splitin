import { waitUntil } from "@vercel/functions";
import type { Instrumentation } from "next";
import { alarmFor } from "@/lib/alarm";

const lastSent = new Map<string, number>();

export const onRequestError: Instrumentation.onRequestError = (error, _request, context) => {
  const token = process.env.GITHUB_ALERT_TOKEN;
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const repo = process.env.VERCEL_GIT_REPO_SLUG;
  if (!token || !owner || !repo || process.env.VERCEL_ENV !== "production") return;

  const { title, details } = alarmFor(error, context, process.env.VERCEL_GIT_COMMIT_SHA);
  if (Date.now() - (lastSent.get(title) ?? 0) < 10 * 60_000) return;
  lastSent.set(title, Date.now());

  waitUntil(
    fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/orbis.yml/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      body: JSON.stringify({ ref: "main", inputs: { title, details } }),
    }).catch(() => undefined),
  );
};
