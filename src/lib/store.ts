"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { BillDoc } from "@/lib/bill";

/* ───────── tiny localStorage store with change notifications ───────── */

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
  } catch {
    // private mode / storage full: the app keeps working for this visit
  }
  listeners.forEach((l) => l());
}

/** `undefined` while server-rendering / hydrating, then the stored string or null. */
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

/* ───────── the bill being edited on this device ───────── */

export type Draft = { doc: BillDoc; billId: string | null };

const DRAFT_KEY = "splitin:draft:v2";

export function emptyDraft(title: string): Draft {
  return { doc: { title, currency: "MYR", createdAt: new Date().toISOString(), people: [], items: [] }, billId: null };
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

/** `undefined` until hydrated; `null` when nothing has been started on this device. */
export function useDraft(): Draft | null | undefined {
  const raw = useStored(DRAFT_KEY);
  return useMemo(() => (raw === undefined ? undefined : parseDraft(raw)), [raw]);
}

export function saveDraft(draft: Draft | null) {
  write(DRAFT_KEY, draft ? JSON.stringify(draft) : null);
}

export function updateDraft(fallbackTitle: string, fn: (draft: Draft) => Draft) {
  const current = parseDraft(read(DRAFT_KEY)) ?? emptyDraft(fallbackTitle);
  saveDraft(fn(current));
}

/* ───────── per shared bill: owner secret and "which one are you" ───────── */

const ownerKey = (billId: string) => `splitin:owner:${billId}`;
const meKey = (billId: string) => `splitin:me:${billId}`;

export const useOwnerToken = (billId: string) => useStored(ownerKey(billId));
export const getOwnerToken = (billId: string) => read(ownerKey(billId));
export const setOwnerToken = (billId: string, token: string) => write(ownerKey(billId), token);

export const useMe = (billId: string) => useStored(meKey(billId));
export const setMe = (billId: string, personId: string | null) => write(meKey(billId), personId);
