"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { useToast } from "@/components/toast";
import { fmt } from "@/i18n";
import { useI18n } from "@/i18n/client";
import { withoutPerson, type BillDoc, type Person } from "@/lib/bill";
import { cn } from "@/lib/utils";
import { BankFields, useBankDetails } from "./bank-fields";

type FormProps = {
  person: Person;
  doc: BillDoc;
  update: (fn: (doc: BillDoc) => BillDoc) => void;
  onDone: () => void;
  pinned?: boolean;
};

export function PersonForm({ person, doc, update, onDone, pinned = false }: FormProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(person.name);
  const details = useBankDetails(person);
  const displayName = name.trim() || person.name;
  const { bankName, accountNo, payQr } = details;

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
              payQr,
            }
          : p,
      ),
    }));
    onDone();
  };

  const remove = () => {
    if (doc.items.some((i) => i.paidBy === person.id)) {
      toast({ message: fmt(t.person.paidABill, { name: person.name }) });
      return;
    }
    const previous = doc;
    update((d) => withoutPerson(d, person.id));
    onDone();
    toast({
      message: fmt(t.person.removed, { name: person.name }),
      action: { label: t.common.undo, onClick: () => update(() => previous) },
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className={cn("flex flex-col gap-4", pinned ? "mt-1.5" : "-mt-1.5")}
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

      <div
        className={cn(
          "flex flex-col gap-1",
          pinned &&
            "sticky bottom-0 -mx-4 -mb-[max(16px,env(safe-area-inset-bottom))] border-t border-line bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]",
        )}
      >
        <button
          type="submit"
          disabled={!name.trim()}
          className="h-[54px] rounded-2xl bg-green text-[16px] font-bold text-white disabled:bg-disabled disabled:text-disabled-ink"
        >
          {t.common.save}
        </button>
        <button type="button" onClick={remove} className="h-10 text-[15px] font-bold text-owe">
          {fmt(t.person.remove, { name: person.name })}
        </button>
      </div>
    </form>
  );
}
