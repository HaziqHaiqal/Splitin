"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { BillDoc } from "@/lib/bill";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {}
  listeners.forEach((l) => l());
}

function useStored(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => undefined,
  );
}

const noop = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export type Draft = { doc: BillDoc; billId: string | null; seenAt?: string };

const DRAFT_KEY = "splitin:draft:v2";

export function emptyDraft(): Draft {
  return {
    doc: { title: "", currency: "MYR", createdAt: new Date().toISOString(), people: [], items: [] },
    billId: null,
  };
}

function parseDraft(raw: string | null | undefined): Draft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Draft;
    return value && value.doc && Array.isArray(value.doc.people) ? value : null;
  } catch {
    return null;
  }
}

export function useDraft(): Draft | null | undefined {
  const raw = useStored(DRAFT_KEY);
  return useMemo(() => (raw === undefined ? undefined : parseDraft(raw)), [raw]);
}

export const getDraft = () => parseDraft(read(DRAFT_KEY));

export function saveDraft(draft: Draft | null) {
  write(DRAFT_KEY, draft ? JSON.stringify(draft) : null);
}

export function updateDraft(fn: (draft: Draft) => Draft) {
  const current = parseDraft(read(DRAFT_KEY)) ?? emptyDraft();
  saveDraft(fn(current));
}

const ownerKey = (billId: string) => `splitin:owner:${billId}`;

export const useOwnerToken = (billId: string) => useStored(ownerKey(billId));
export const getOwnerToken = (billId: string) => read(ownerKey(billId));
export const setOwnerToken = (billId: string, token: string) => write(ownerKey(billId), token);

const meKey = (billId: string) => `splitin:me:${billId}`;

export const useMe = (billId: string) => useStored(meKey(billId));
export const getMe = (billId: string) => read(meKey(billId)) ?? undefined;
export const setMe = (billId: string, personId: string | null) => write(meKey(billId), personId);

const askedKey = (billId: string) => `splitin:asked:${billId}`;

export const getAsked = (billId: string) => read(askedKey(billId)) !== null;
export const setAsked = (billId: string) => write(askedKey(billId), "1");

function parseTokens(raw: string | null | undefined): Record<string, string> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function useTokens(key: string): Record<string, string> {
  const raw = useStored(key);
  return useMemo(() => parseTokens(raw), [raw]);
}

function setToken(key: string, id: string, token: string | null) {
  const tokens = parseTokens(read(key));
  if (token) tokens[id] = token;
  else delete tokens[id];
  write(key, JSON.stringify(tokens));
}

const mineKey = (billId: string) => `splitin:mine:${billId}`;
export const useMyItems = (billId: string) => useTokens(mineKey(billId));
export const setMyItem = (billId: string, itemId: string, token: string | null) =>
  setToken(mineKey(billId), itemId, token);

const joinsKey = (billId: string) => `splitin:joins:${billId}`;
export const useMyJoins = (billId: string) => useTokens(joinsKey(billId));
export const setMyJoin = (billId: string, itemId: string, token: string | null) =>
  setToken(joinsKey(billId), itemId, token);

const namesKey = (billId: string) => `splitin:names:${billId}`;
export const useMyNames = (billId: string) => useTokens(namesKey(billId));
export const setMyName = (billId: string, personId: string, key: string) => setToken(namesKey(billId), personId, key);

const seenKey = (billId: string) => `splitin:seen:${billId}`;
export const getSeen = (billId: string) => read(seenKey(billId));
export const setSeen = (billId: string, at: string) => write(seenKey(billId), at);
