"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { publishBill } from "@/app/actions";
import { PickOrType } from "@/components/name-chip";
import { Receipt } from "@/components/receipt/receipt";
import { ShareSheet } from "@/components/receipt/share-sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { ownerOf, repeatedName, type BillDoc } from "@/lib/bill";
import { saveDraft, setOwnerToken, type Draft } from "@/lib/store";
import { newId } from "@/lib/utils";

const LIFETIME = 30 * 24 * 60 * 60 * 1000;

type Shared = { id: string; doc: BillDoc; expiresAt: string };

export function useShareReceipt(draft: Draft | null | undefined) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const paper = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [back, setBack] = useState<{ to: () => void } | null>(null);
  const [shared, setShared] = useState<Shared | null>(null);
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
      setShared({
        id: result.data.id,
        doc: current.doc,
        expiresAt: new Date(Date.now() + LIFETIME).toISOString(),
      });
      saveDraft({ ...current, billId: result.data.id });
    });
  };

  const share = (to?: () => void) => {
    if (!draft || draft.billId) return;
    setBack(to ? { to } : null);
    setOpen(true);
    if (draft.doc.ownerId !== undefined) publish(draft);
  };

  const close = (next: boolean) => {
    if (next) return;
    setOpen(false);
    if (shared) router.push(`/bill/${shared.id}`);
  };

  const pickOwner = (ownerId: string, people = draft?.doc.people ?? []) => {
    if (!draft) return;
    const next = { ...draft, doc: { ...draft.doc, people, ownerId } };
    saveDraft(next);
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

  const doc = shared?.doc ?? draft?.doc;
  const asking = Boolean(draft && !shared && draft.doc.ownerId === undefined);

  const sheet = doc ? (
    <>
      {open ? (
        <div inert className="fixed top-0 left-[-9999px] w-[380px]">
          <Receipt
            ref={paper}
            doc={doc}
            billId={shared?.id}
            expiresAt={shared?.expiresAt}
            sharedBy={ownerOf(doc)?.name}
          />
        </div>
      ) : null}
      <ShareSheet
        open={open}
        onOpenChange={close}
        billId={shared?.id ?? null}
        doc={doc}
        receiptRef={paper}
        waiting={pending}
        onPublish={draft && !asking ? () => publish(draft) : undefined}
        onBack={
          back && !shared
            ? () => {
                setOpen(false);
                back.to();
              }
            : undefined
        }
        ask={
          asking && draft ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[15px] font-bold text-ink">{t.share.whichTitle}</h3>
              <p className="m-0 text-[13px] leading-[1.45] text-muted">{t.share.whichDesc}</p>
              <PickOrType
                people={draft.doc.people}
                button={t.share.go}
                pending={pending}
                onPick={(id) => pickOwner(id)}
                onName={typeOwner}
              />
            </div>
          ) : null
        }
      />
    </>
  ) : null;

  return { share, pending: pending || open, leaving: Boolean(shared), sheet };
}
