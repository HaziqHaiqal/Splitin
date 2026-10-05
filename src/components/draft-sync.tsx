"use client";

import { useEffect, useRef } from "react";
import { saveBill } from "@/app/actions";
import { useI18n } from "@/i18n/client";
import { getOwnerToken, type Draft } from "@/lib/store";
import { useToast } from "./toast";

/** Once a bill is shared, keep the server copy in step with edits made on this device. */
export function useDraftSync(draft: Draft | null | undefined) {
  const { t } = useI18n();
  const toast = useToast();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!draft?.billId) {
      last.current = null; // cleared or not shared: the next shared bill starts fresh
      return;
    }
    const json = JSON.stringify(draft.doc);
    if (last.current === null) {
      last.current = json;
      return;
    }
    if (json === last.current) return;
    const billId = draft.billId;
    const timer = setTimeout(async () => {
      const token = getOwnerToken(billId);
      if (!token) return;
      const result = await saveBill(billId, token, draft.doc);
      if (result.ok) last.current = json;
      else toast({ message: t.common.generic });
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, t, toast]);
}
