"use client";

import { useState, useTransition } from "react";
import { personHasPayments } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { withoutPerson, type BillDoc, type Person } from "@/lib/bill";
import { BankFields, useBankDetails } from "./bank-fields";

export function PersonSheet({
  open,
  onOpenChange,
  person,
  doc,
  billId,
  update,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: Person | null;
  doc: BillDoc;
  billId?: string | null;
  update: (fn: (doc: BillDoc) => BillDoc) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(person?.name ?? "");
  const details = useBankDetails(person);
  const [pending, start] = useTransition();

  if (!person) return null;
  const displayName = name.trim() || person.name;
  const { bankName, accountNo } = details;

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update((d) => ({
      ...d,
      people: d.people.map((p) =>
        p.id === person.id
          ? {
              ...p,
              name: trimmed.slice(0, 30),
              bank: bankName || null,
              accountNo: bankName ? accountNo.trim() || null : null,
            }
          : p,
      ),
    }));
    onOpenChange(false);
  };

  const remove = () =>
    start(async () => {
      if (doc.items.some((i) => i.paidBy === person.id)) {
        toast({ message: fmt(t.person.paidABill, { name: person.name }) });
        return;
      }
      if (billId) {
        const result = await personHasPayments(billId, person.id);
        if (!result.ok) return void toast({ message: t.common.generic });
        if (result.data.has) {
          toast({ message: fmt(t.person.hasPayment, { name: person.name }) });
          return;
        }
      }
      update((d) => withoutPerson(d, person.id));
      onOpenChange(false);
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={<span className="sr-only">{person.name}</span>}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="-mt-[14px] flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <Avatar name={displayName} color={person.color} size={48} />
          <label className="flex-1">
            <span className="sr-only">{t.person.name}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="h-12 w-full rounded-xl border border-border bg-card px-[14px] text-[18px] font-bold text-ink outline-none focus:border-green"
            />
          </label>
        </div>

        <BankFields name={displayName} details={details} />

        <button
          type="submit"
          disabled={!name.trim()}
          className="h-[54px] rounded-2xl bg-green text-[16px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink"
        >
          {t.common.save}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="-mt-1.5 h-10 text-[15px] font-bold text-owe disabled:opacity-60"
        >
          {fmt(t.person.remove, { name: person.name })}
        </button>
      </form>
    </Sheet>
  );
}
