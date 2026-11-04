"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publishBill } from "@/app/actions";
import { PickOrType } from "@/components/name-chip";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { repeatedName } from "@/lib/bill";
import { saveDraft, setOwnerToken, setShareNext, type Draft } from "@/lib/store";
import { newId } from "@/lib/utils";

export function useShareReceipt(draft: Draft | null | undefined) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pending, start] = useTransition();

  const publish = (current: Draft) => {
    start(async () => {
      const result = await publishBill(current.doc);
      if (!result.ok) {
        const name = repeatedName(current.doc);
        if (result.error === "duplicate" && name) toast({ message: fmt(t.home.duplicateName, { name }) });
        else toast({ message: result.error === "rate_limited" ? t.share.rateLimited : t.common.generic });
        return;
      }
      setOwnerToken(result.data.id, result.data.ownerToken);
      setLeaving(true);
      saveDraft({ ...current, billId: result.data.id });
      setShareNext(result.data.id);
      router.push(`/bill/${result.data.id}`);
    });
  };

  const share = () => {
    if (!draft || draft.billId) return;
    if (draft.doc.ownerId === undefined) setAsking(true);
    else publish(draft);
  };

  const pickOwner = (ownerId: string | null, people = draft?.doc.people ?? []) => {
    if (!draft) return;
    const next = { ...draft, doc: { ...draft.doc, people, ownerId } };
    saveDraft(next);
    setAsking(false);
    publish(next);
  };

  const typeOwner = (name: string) => {
    if (!draft) return;
    const { people } = draft.doc;
    const same = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (same) return pickOwner(same.id);
    const id = newId(6);
    const color = people.reduce((max, p) => Math.max(max, p.color + 1), 0) % 100;
    pickOwner(id, [...people, { id, name, color }]);
  };

  const sheet = draft ? (
    <Sheet open={asking} onOpenChange={setAsking} title={t.share.whichTitle}>
      <p className="m-0 text-[14px] text-muted">{t.share.whichDesc}</p>
      <PickOrType
        people={draft.doc.people}
        button={t.share.go}
        pending={pending}
        onPick={pickOwner}
        onName={typeOwner}
      />
    </Sheet>
  ) : null;

  return { share, pending: pending || leaving, leaving, sheet };
}
