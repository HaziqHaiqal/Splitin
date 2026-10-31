"use client";

import { useEffect, useRef } from "react";
import { loadBillDoc, saveBill } from "@/app/actions";
import { useI18n } from "@/i18n/client";
import { latestAddedAt, mergeFriendItems, type BillDoc } from "@/lib/bill";
import { getDraft, getOwnerToken, saveDraft, type Draft } from "@/lib/store";
import { useToast } from "./toast";

function applyServerDoc(billId: string, server: BillDoc) {
  const current = getDraft();
  if (current?.billId !== billId) return;
  const seenAt = current.seenAt ?? "";
  const doc = mergeFriendItems(server, current.doc, seenAt);
  const latest = latestAddedAt(server, seenAt);
  if (latest === seenAt && JSON.stringify(doc.items) === JSON.stringify(current.doc.items)) return;
  saveDraft({ ...current, doc, seenAt: latest });
}

export function useDraftSync(draft: Draft | null | undefined) {
  const { t } = useI18n();
  const toast = useToast();
  const last = useRef<string | null>(null);
  const billId = draft?.billId;

  useEffect(() => {
    if (!billId) return;
    const pull = async () => {
      const result = await loadBillDoc(billId);
      if (result.ok) applyServerDoc(billId, result.data.doc);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    void pull();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [billId]);

  useEffect(() => {
    if (!draft?.billId) {
      last.current = null;
      return;
    }
    const json = JSON.stringify(draft.doc);
    if (last.current === null) {
      last.current = json;
      return;
    }
    if (json === last.current) return;
    const id = draft.billId;
    const timer = setTimeout(async () => {
      const token = getOwnerToken(id);
      if (!token) return;
      const result = await saveBill(id, token, draft.doc, draft.seenAt ?? "");
      if (result.ok) {
        last.current = json;
        applyServerDoc(id, result.data.doc);
      } else toast({ message: t.common.generic });
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, t, toast]);
}
